#ifndef SLANG_MODEL_H
#define SLANG_MODEL_H
#include <algorithm>
#include <array>
#include <cstring>
#include <atomic>
#include <bit>
#include <climits>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>
#include <mutex>
class VarPool;
template <typename T>
class Stack
{
private:
    std::vector<T> data;
public:
    void push(T value)
    {
        data.push_back(value);
    }
    T pop()
    {
        //空栈弹栈=字节码栈不平衡:抛错由 main 统一处理(此前空栈 back() 是 UB/崩溃)
        if (data.empty())
            throw std::runtime_error("栈为空(字节码栈不平衡)");
        T value=data.back();
        data.pop_back();
        return value;
    }
    T peek(){
        return data.back();
    }
    [[nodiscard]] size_t size() const
    {
        return data.size();
    }
};
struct Const
{
    bool type{};
    //当实际值消失,一定是被gc了,此时一定不会被访问
    std::string_view str;
    double num{};
};
//无锁常量池(ConstPool 完整类体)
class ConstPool
{
private:
    //===== 一、静态常量:从 sbin 装载进来的程序静态数据 =====
    //init() 之后内容不变、也不再回收(与字符串字面量池同理),于是 get/is_pool/retain/delete_/link
    //对静态 id 全部无锁。用开放寻址表而不是"按 id 下标的数组":实测真实产物的池 id 很稀疏
    //(40 条语句 66 个常量但 maxId=702),按 maxId 定容既白占内存、又会在 id 上界超容量时把优化整体关掉。
    std::vector<Const> st_val;
    std::vector<int> st_key;
    std::vector<uint8_t> st_used;
    uint32_t st_mask=0;
    int st_shift=0;
    std::vector<std::pair<uint64_t,int>> static_nums;   //bit_cast<uint64_t>(double) → id
    struct StaticStr
    {
        uint64_t hash;
        std::string_view view;
        int id;
    };
    std::vector<StaticStr> static_strs;
    std::unordered_map<int,std::string> static_str_store;   //静态字符串本体(节点稳定 → view 不失效)

    //===== 二、运行期【数字】常量:无锁开放寻址表(热路径的主角)=====
    //为什么值得单独做:这个 VM 里"值就是池 id",所以**每一次算术结果**都要 link 进池;
    //此前那是一把全局锁 —— 实测 4 线程算术循环的聚合吞吐从 3.0× 掉到 0.75×。
    //做法:槽内联 {state,ref,gen,num},state 既当状态又当锁(0=占用/-1=空/-2=墓碑/-3=认领中),用 CAS 认领;
    //      id 直接编码【槽号 + 代】,于是 get(id) 是"减基址直取槽"(比查哈希还快),
    //      而"代"保证被回收复用的槽绝不会让旧 id 读到新值(旧 id 只会 get 到空)。
    static constexpr int DYN_BASE=0x10000000;               //运行期数字 id 基址(避开静态小整数与 alloc 的 0x40000000)
    static constexpr int SLOT_BITS=15;                      //32768 槽,负载 ≤0.5 → 约 1.6 万个存活数字常量
    static constexpr int SLOT_COUNT=1<<SLOT_BITS;
    static constexpr int SLOT_MASK=SLOT_COUNT-1;
    static constexpr int GEN_BITS=12;                       //每个槽 4096 代
    static constexpr int GEN_MASK=(1<<GEN_BITS)-1;
    static constexpr int DYN_NUM_LIMIT=DYN_BASE+(1<<(SLOT_BITS+GEN_BITS));   //0x18000000
    static constexpr int32_t NS_OCC=0;      //占用(已发布)
    static constexpr int32_t NS_EMPTY=-1;   //空:探测到此终止
    static constexpr int32_t NS_TOMB=-2;    //墓碑:值已回收,可被复用,但探测要继续
    static constexpr int32_t NS_CLAIM=-3;   //已认领、正在写(读者自旋等它发布)
    struct NumSlot
    {
        std::atomic<int32_t> state{NS_EMPTY};
        std::atomic<int32_t> ref{0};
        std::atomic<int32_t> gen{0};
        std::atomic<uint64_t> key{0};       //double 的二进制位;发布后不再改动(读者靠 state 的 acquire 拿到它)
    };
    std::atomic<NumSlot*> ntab{nullptr};    //懒分配(32768×24B = 768KB,不用就不占)
    std::mutex ntab_mtx;
    std::atomic<int> nused{0};              //存活数字常量数的近似计数:把表负载压在 50% 以下
                                            //(空槽充足 → 探测永远常数级)。它只决定"新值进表还是进溢出表",
                                            //近似不影响正确性

    //===== 三、运行期【字符串】常量:同样一张无锁开放寻址表 =====
    //槽里放的是**不可变的字符串本体指针**(发布后不再改动),所以 get 完全无锁;
    //键用 64 位散列,hash 相同再比内容(所以槽里要存 entry 指针)。
    //回收:引用归零 → 标墓碑 + 旧 entry 挂到 retired 列表,gc() 时统一释放(延迟释放:
    //      读者可能刚拿到 view,直接 free 会有悬垂/崩溃风险;延迟一个 gc 周期足够安全)
    static constexpr int DYN_STR_BASE=0x20000000;
    static constexpr int SS_BITS=15;                        //32768 槽(负载 ≤0.5 → 约 1.6 万个存活字符串)
    static constexpr int SS_COUNT=1<<SS_BITS;
    static constexpr int SS_MASK=SS_COUNT-1;
    static constexpr int SS_GEN_BITS=12;
    static constexpr int SS_GEN_MASK=(1<<SS_GEN_BITS)-1;
    static constexpr int DYN_STR_LIMIT=DYN_STR_BASE+(1<<(SS_BITS+SS_GEN_BITS));   //0x28000000
    struct StrEntry
    {
        std::string s;
        explicit StrEntry(const std::string& v) : s(v) {}
    };
    struct StrSlot
    {
        std::atomic<int32_t> state{NS_EMPTY};
        std::atomic<int32_t> ref{0};
        std::atomic<int32_t> gen{0};
        std::atomic<uint64_t> hash{0};
        std::atomic<StrEntry*> entry{nullptr};
    };
    std::atomic<StrSlot*> stab{nullptr};
    std::mutex stab_mtx;
    std::atomic<int> sused{0};
    mutable std::mutex sret_mtx;
    std::vector<StrEntry*> sretired;        //待释放的旧字符串(gc() 里统一 delete)

    //===== 四、表满之后的溢出段:按值的散列分片(冷路径)=====
    static constexpr int DYN_SOVER_BASE=DYN_STR_LIMIT;      //0x28000000:字符串表满之后的溢出段
    static constexpr int DYN_OVER_BASE=DYN_NUM_LIMIT;       //0x18000000:数字表满之后的溢出段
    static constexpr int DYN_SOVER_LIMIT=0x40000000;        //VarPool::alloc() 的起点
    static constexpr int SHARD_BITS=6;
    static constexpr int SHARD_COUNT=1<<SHARD_BITS;
    static constexpr int SHARD_LOCAL_SHIFT=20;
    static constexpr int SHARD_LOCAL_MASK=(1<<SHARD_LOCAL_SHIFT)-1;
    struct Shard
    {
        std::mutex mtx;
        std::unordered_map<uint64_t,int> numI;          //溢出数字:bits → 本地 id
        std::unordered_map<int,double> number;          //本地 id → 值
        std::unordered_map<std::string_view,int> strI;  //溢出字符串:view → 本地 id(view 指向 string 的节点)
        std::unordered_map<int,std::string> string;     //本地 id → 字符串本体(节点稳定)
        std::unordered_map<int,Const> value;            //本地 id → Const(get 用)
        std::unordered_map<int,int> refCount;
        int next_local=0;                               //本地 id 单调递增,**绝不复用**
    };
    mutable std::array<Shard,SHARD_COUNT> shards;

    static uint32_t hash_id(const int id)
    {
        //Fibonacci 散列:乘 2^32/φ 后让它自然回绕,再取高位。
        //不能写成 (uint64)id*C>>32 —— 那样小整数 id 得到的是线性递增的槽号,顺序 id 全挤在一起
        return static_cast<uint32_t>(static_cast<uint32_t>(id)*2654435761u);
    }
    static uint32_t hash_bits(const uint64_t bits)
    {
        const uint32_t h=static_cast<uint32_t>(bits)^static_cast<uint32_t>(bits>>32);
        return h*2654435761u;
    }
    int find_static(const int id) const
    {
        if (st_mask==0) return -1;
        uint32_t s=(hash_id(id)>>st_shift)&st_mask;
        while (st_used[s])
        {
            if (st_key[s]==id) return static_cast<int>(s);
            s=(s+1)&st_mask;
        }
        return -1;
    }
    static int shard_of_str(const std::string& v)
    {
        const uint64_t h=std::hash<std::string_view>{}(std::string_view(v));
        return static_cast<int>((h*0x9E3779B97F4A7C15ull)>>(64-SHARD_BITS));
    }
    static uint64_t hash_str(const std::string& v)
    {
        return std::hash<std::string_view>{}(std::string_view(v));
    }
    static int shard_of_num_bits(const uint64_t bits)
    {
        return static_cast<int>(hash_bits(bits)>>(32-SHARD_BITS));
    }
    //id 分段(四段互不重叠,且都低于 alloc() 的 0x40000000)
    static bool is_num(const int id) { return id>=DYN_BASE&&id<DYN_NUM_LIMIT; }              //数字无锁表
    static bool is_over(const int id) { return id>=DYN_OVER_BASE&&id<DYN_STR_BASE; }         //数字溢出分片表
    static bool is_str(const int id) { return id>=DYN_STR_BASE&&id<DYN_STR_LIMIT; }          //字符串无锁表
    static bool is_sover(const int id) { return id>=DYN_SOVER_BASE&&id<DYN_SOVER_LIMIT; }    //字符串溢出分片表
    static int slot_of(const int id) { return (id-DYN_BASE)&SLOT_MASK; }
    static int gen_of(const int id) { return ((id-DYN_BASE)>>SLOT_BITS)&GEN_MASK; }
    static int make_num_id(const int slot,const int gen) { return DYN_BASE|(gen<<SLOT_BITS)|slot; }
    static int ss_slot_of(const int id) { return (id-DYN_STR_BASE)&SS_MASK; }
    static int ss_gen_of(const int id) { return ((id-DYN_STR_BASE)>>SS_BITS)&SS_GEN_MASK; }
    static int make_ss_id(const int slot,const int gen) { return DYN_STR_BASE|(gen<<SS_BITS)|slot; }
    static int shard_of_shard_id(const int id,const int base) { return ((id-base)>>SHARD_LOCAL_SHIFT)&(SHARD_COUNT-1); }
    static int local_of_shard_id(const int id) { return id&SHARD_LOCAL_MASK; }
    static int make_shard_id(const int base,const int shard,const int local)
    {
        return base|(shard<<SHARD_LOCAL_SHIFT)|local;
    }
    NumSlot* num_table()
    {
        NumSlot* t=ntab.load(std::memory_order_acquire);
        if (t) return t;
        std::lock_guard<std::mutex> lock(ntab_mtx);
        t=ntab.load(std::memory_order_relaxed);
        if (!t)
        {
            t=new NumSlot[SLOT_COUNT];
            ntab.store(t,std::memory_order_release);
        }
        return t;
    }
    StrSlot* str_table()
    {
        StrSlot* t=stab.load(std::memory_order_acquire);
        if (t) return t;
        std::lock_guard<std::mutex> lock(stab_mtx);
        t=stab.load(std::memory_order_relaxed);
        if (!t)
        {
            t=new StrSlot[SS_COUNT];
            stab.store(t,std::memory_order_release);
        }
        return t;
    }
    //该字符串 id 是否活着(并回传本体指针):无锁
    bool str_alive(const int id,StrEntry*& out) const
    {
        StrSlot* t=stab.load(std::memory_order_acquire);
        if (!t) return false;
        const int slot=ss_slot_of(id);
        const int32_t st=t[slot].state.load(std::memory_order_acquire);
        if (st!=NS_OCC) return false;
        if (t[slot].gen.load(std::memory_order_relaxed)!=ss_gen_of(id)) return false;
        out=t[slot].entry.load(std::memory_order_relaxed);   //state 的 acquire 已保证可见
        return out!=nullptr;
    }
    //该数字 id 是否活着(并回传槽号):无锁
    bool num_alive(const int id,int& slot_out) const
    {
        NumSlot* t=ntab.load(std::memory_order_acquire);
        if (!t) return false;
        const int slot=slot_of(id);
        slot_out=slot;
        const int32_t st=t[slot].state.load(std::memory_order_acquire);
        if (st!=NS_OCC) return false;                     //空/墓碑/认领中(认领中时还没有人能拿到这个 id)
        return t[slot].gen.load(std::memory_order_relaxed)==gen_of(id);
    }
    //分片表的通用小工具(调用者已持锁)
    Const shard_value(Shard& sh,const int local) const
    {
        const auto it=sh.value.find(local);
        return it==sh.value.end()?Const{}:it->second;
    }
public:
    ConstPool()=default;
    ~ConstPool()
    {
        delete[] ntab.load(std::memory_order_relaxed);
        delete[] stab.load(std::memory_order_relaxed);
    }
    ConstPool(const ConstPool&)=delete;
    ConstPool& operator=(const ConstPool&)=delete;

    void delete_(const int id)
    {
        //静态常量不回收:省掉一次锁
        if (find_static(id)>=0) return;
        if (is_num(id))
        {
            int slot=0;
            if (!num_alive(id,slot)) return;
            NumSlot* t=ntab.load(std::memory_order_acquire);
            int32_t r=t[slot].ref.load(std::memory_order_relaxed);
            for (;;)
            {
                if (r<=0) return;   //未知/已归零:忽略(此前无下界保护会让计数变负、条目永不回收)
                if (t[slot].ref.compare_exchange_weak(r,r-1,std::memory_order_acq_rel,std::memory_order_relaxed))
                {
                    if (r-1==0)
                    {
                        //引用归零 → **立刻**标墓碑(不再等 gc):
                        //否则死值会一直占着槽,表被填满后每次插入都要全表扫(实测慢 40 倍),
                        //而且内存会随"曾经创建过的常量数"增长。墓碑可被后续插入复用,代际保证旧 id 读不到新值。
                        int32_t expect=NS_OCC;
                        if (t[slot].state.compare_exchange_strong(expect,NS_TOMB,
                                std::memory_order_acq_rel,std::memory_order_acquire))
                        {
                            t[slot].gen.store((gen_of(id)+1)&GEN_MASK,std::memory_order_relaxed);
                            nused.fetch_sub(1,std::memory_order_relaxed);
                        }
                    }
                    return;
                }
            }
        }
        if (is_str(id))
        {
            //字符串无锁表:引用归零 → 立即标墓碑 + 推进"代",旧本体挂到待释放列表(延迟到 gc 释放,
            //避免读者手里刚拿到的 view 被 free 掉)
            StrEntry* e=nullptr;
            if (!str_alive(id,e)) return;
            StrSlot* t=stab.load(std::memory_order_acquire);
            const int slot=ss_slot_of(id);
            int32_t r=t[slot].ref.load(std::memory_order_relaxed);
            for (;;)
            {
                if (r<=0) return;
                if (t[slot].ref.compare_exchange_weak(r,r-1,std::memory_order_acq_rel,std::memory_order_relaxed))
                {
                    if (r-1==0)
                    {
                        int32_t expect=NS_OCC;
                        if (t[slot].state.compare_exchange_strong(expect,NS_TOMB,
                                std::memory_order_acq_rel,std::memory_order_acquire))
                        {
                            t[slot].gen.store((ss_gen_of(id)+1)&SS_GEN_MASK,std::memory_order_relaxed);
                            sused.fetch_sub(1,std::memory_order_relaxed);
                            std::lock_guard<std::mutex> lock(sret_mtx);
                            sretired.push_back(e);
                        }
                    }
                    return;
                }
            }
        }
        if (!is_over(id)&&!is_sover(id)) return;
        Shard& sh=shards[shard_of_shard_id(id,is_over(id)?DYN_OVER_BASE:DYN_SOVER_BASE)];
        std::lock_guard<std::mutex> lock(sh.mtx);
        const int local=local_of_shard_id(id);
        const auto it=sh.refCount.find(local);
        if (it==sh.refCount.end()||it->second<=0) return;
        if (--it->second==0)
        {
            //同样立刻回收:分片表也必须只随**存活**常量增长
            const auto v=sh.value.find(local);
            if (v!=sh.value.end())
            {
                if (v->second.type)
                {
                    const auto n=sh.number.find(local);
                    if (n!=sh.number.end())
                    {
                        sh.numI.erase(std::bit_cast<uint64_t>(n->second));
                        sh.number.erase(n);
                    }
                }
                else
                {
                    const auto s=sh.string.find(local);
                    if (s!=sh.string.end())
                    {
                        sh.strI.erase(std::string_view(s->second));   //先删反表(view 指向本体)
                        sh.string.erase(s);
                    }
                }
                sh.value.erase(v);
            }
            sh.refCount.erase(local);
        }
    }
    void retain(const int id)
    {
        if (find_static(id)>=0) return;      //静态常量永不释放,无需计数 → 无锁
        if (is_num(id))
        {
            int slot=0;
            if (!num_alive(id,slot)) return;
            ntab.load(std::memory_order_acquire)[slot].ref.fetch_add(1,std::memory_order_relaxed);
            return;
        }
        if (is_str(id))
        {
            StrEntry* e=nullptr;
            if (!str_alive(id,e)) return;
            stab.load(std::memory_order_acquire)[ss_slot_of(id)].ref.fetch_add(1,std::memory_order_relaxed);
            return;
        }
        if (!is_over(id)&&!is_sover(id)) return;
        Shard& sh=shards[shard_of_shard_id(id,is_over(id)?DYN_OVER_BASE:DYN_SOVER_BASE)];
        std::lock_guard<std::mutex> lock(sh.mtx);
        const auto it=sh.refCount.find(local_of_shard_id(id));
        if (it!=sh.refCount.end()) it->second++;
    }
    bool is_pool(const int id) const
    {
        if (find_static(id)>=0) return true;
        if (is_num(id)) { int slot=0; return num_alive(id,slot); }
        if (is_str(id)) { StrEntry* e=nullptr; return str_alive(id,e); }
        if (!is_over(id)&&!is_sover(id)) return false;
        Shard& sh=shards[shard_of_shard_id(id,is_over(id)?DYN_OVER_BASE:DYN_SOVER_BASE)];
        std::lock_guard<std::mutex> lock(sh.mtx);
        return sh.value.contains(local_of_shard_id(id));
    }
    bool find_static_num(const uint64_t k,int& out) const
    {
        const auto it=std::lower_bound(static_nums.begin(),static_nums.end(),k,
            [](const std::pair<uint64_t,int>& e,const uint64_t v){return e.first<v;});
        if (it==static_nums.end()||it->first!=k) return false;
        out=it->second;
        return true;
    }
    bool find_static_str(const std::string& v,int& out) const
    {
        if (static_strs.empty()) return false;
        const uint64_t h=std::hash<std::string_view>{}(std::string_view(v));
        auto it=std::lower_bound(static_strs.begin(),static_strs.end(),h,
            [](const StaticStr& e,const uint64_t x){return e.hash<x;});
        while (it!=static_strs.end()&&it->hash==h)
        {
            if (it->view==v) { out=it->id; return true; }
            ++it;
        }
        return false;
    }
    int link(const double v)
    {
        int sid=0;
        const uint64_t k=std::bit_cast<uint64_t>(v);
        if (find_static_num(k,sid)) return sid;        //装载常量:无锁命中
        NumSlot* t=num_table();
        const int start=static_cast<int>(hash_bits(k)>>(32-SLOT_BITS));
        for (int round=0;round<4;round++)              //外层:槽被抢走就整体重来(极少)
        {
            int tomb=-1, empty=-1;
            int s=start;
            for (int probe=0;probe<SLOT_COUNT;probe++,s=(s+1)&SLOT_MASK)
            {
                int32_t st=t[s].state.load(std::memory_order_acquire);
                if (st==NS_CLAIM)
                {
                    //别人正在写这个槽:自旋等它发布后重新判断(写者不持锁,窗口只有几条指令)
                    while (t[s].state.load(std::memory_order_acquire)==NS_CLAIM)
                        std::this_thread::yield();
                    st=t[s].state.load(std::memory_order_acquire);
                }
                if (st==NS_OCC)
                {
                    if (t[s].key.load(std::memory_order_acquire)==k)
                    {
                        t[s].ref.fetch_add(1,std::memory_order_relaxed);
                        return make_num_id(s,t[s].gen.load(std::memory_order_relaxed));
                    }
                    continue;
                }
                if (st==NS_TOMB) { if (tomb<0) tomb=s; continue; }
                empty=s;
                break;                                  //NS_EMPTY
            }
            const int target=tomb>=0?tomb:empty;
            if (target<0) break;                        //整表占满 → 溢出兜底
            //负载闸门:存活数到 50% 就不再往表里插,保证空槽充足(否则探测会退化成全表扫,
            //实测 1 线程慢 40 倍)。新值改走分片哈希表;表里已有的值仍然查得到(探测很短就撞到空槽)
            if (nused.load(std::memory_order_relaxed)>=SLOT_COUNT/2) break;
            int32_t expect=NS_EMPTY;
            if (!t[target].state.compare_exchange_strong(expect,NS_CLAIM,
                    std::memory_order_acq_rel,std::memory_order_acquire))
                continue;                               //被别人抢先:重来
            const int gen=(t[target].gen.load(std::memory_order_relaxed)+1)&GEN_MASK;
            t[target].key.store(k,std::memory_order_relaxed);
            t[target].ref.store(1,std::memory_order_relaxed);
            t[target].gen.store(gen,std::memory_order_relaxed);
            t[target].state.store(NS_OCC,std::memory_order_release);   //发布
            nused.fetch_add(1,std::memory_order_relaxed);
            return make_num_id(target,gen);
        }
        //溢出兜底:存活数字常量超过 1.6 万(或表被占满)→ 退回分片哈希表,正确但慢
        const int si=shard_of_num_bits(k);
        Shard& sh=shards[si];
        std::lock_guard<std::mutex> lock(sh.mtx);
        if (const auto it=sh.numI.find(k);it!=sh.numI.end())
        {
            sh.refCount[it->second]++;
            return make_shard_id(DYN_OVER_BASE,si,it->second);
        }
        if (sh.next_local>SHARD_LOCAL_MASK)
            throw std::runtime_error("常量池分片 "+std::to_string(si)+" 的运行期 id 空间耗尽");
        const int local=sh.next_local++;
        sh.number.emplace(local,v);
        sh.numI.emplace(k,local);
        Const c;
        c.type=true;
        c.num=v;
        sh.value.emplace(local,c);
        sh.refCount[local]=1;
        return make_shard_id(DYN_OVER_BASE,si,local);
    }
    int link(const std::string& v)
    {
        //静态常量命中:直接返回 id(无锁;静态常量不回收,故不必计引用)
        int sid=0;
        if (find_static_str(v,sid)) return sid;
        //运行期字符串:走和数字同一套无锁表(CAS 认领 + 自旋 + 墓碑 + 代际)。
        //槽里放的是**不可变本体指针**,发布后不再改动 → 命中路径完全无锁;
        //hash 相同再比内容,所以同一槽位的不同字符串靠探测继续区分。
        StrSlot* t=str_table();
        const uint64_t h=hash_str(v);
        const int start=static_cast<int>(h>>(64-SS_BITS));
        for (int round=0;round<4;round++)              //外层:槽被抢走就整体重来(极少)
        {
            int tomb=-1, empty=-1;
            int s=start;
            for (int probe=0;probe<SS_COUNT;probe++,s=(s+1)&SS_MASK)
            {
                int32_t st=t[s].state.load(std::memory_order_acquire);
                if (st==NS_CLAIM)
                {
                    while (t[s].state.load(std::memory_order_acquire)==NS_CLAIM)
                        std::this_thread::yield();
                    st=t[s].state.load(std::memory_order_acquire);
                }
                if (st==NS_OCC)
                {
                    if (t[s].hash.load(std::memory_order_relaxed)==h)
                    {
                        StrEntry* e=t[s].entry.load(std::memory_order_relaxed);
                        if (e&&e->s==v)
                        {
                            t[s].ref.fetch_add(1,std::memory_order_relaxed);
                            return make_ss_id(s,t[s].gen.load(std::memory_order_relaxed));
                        }
                    }
                    continue;
                }
                if (st==NS_TOMB) { if (tomb<0) tomb=s; continue; }
                empty=s;
                break;                                  //NS_EMPTY
            }
            const int target=tomb>=0?tomb:empty;
            if (target<0) break;                        //整表占满 → 溢出
            //负载闸门:与数字一样压在 50%,保证探测是常数级
            if (sused.load(std::memory_order_relaxed)>=SS_COUNT/2) break;
            int32_t expect=NS_EMPTY;
            if (!t[target].state.compare_exchange_strong(expect,NS_CLAIM,
                    std::memory_order_acq_rel,std::memory_order_acquire))
                continue;                               //被别人抢先:重来(此时还没分配任何东西 → 零泄漏)
            const int gen=(t[target].gen.load(std::memory_order_relaxed)+1)&SS_GEN_MASK;
            StrEntry* e=new StrEntry(v);                //认领成功后才分配,输掉那次不会泄漏
            t[target].hash.store(h,std::memory_order_relaxed);
            t[target].entry.store(e,std::memory_order_relaxed);
            t[target].ref.store(1,std::memory_order_relaxed);
            t[target].gen.store(gen,std::memory_order_relaxed);
            t[target].state.store(NS_OCC,std::memory_order_release);   //发布
            sused.fetch_add(1,std::memory_order_relaxed);
            return make_ss_id(target,gen);
        }
        //溢出兜底:存活字符串超过 1.6 万(或表被占满)→ 分片哈希表,正确但慢
        const int si=shard_of_str(v);
        Shard& sh=shards[si];
        std::lock_guard<std::mutex> lock(sh.mtx);
        if (const auto it=sh.strI.find(std::string_view(v));it!=sh.strI.end())
        {
            sh.refCount[it->second]++;
            return make_shard_id(DYN_SOVER_BASE,si,it->second);
        }
        if (sh.next_local>SHARD_LOCAL_MASK)
            throw std::runtime_error("常量池分片 "+std::to_string(si)+" 的运行期 id 空间耗尽");
        const int local=sh.next_local++;
        auto [node,ok]=sh.string.emplace(local,v);
        sh.strI.emplace(std::string_view(node->second),local);
        Const c;
        c.type=false;
        c.str=std::string_view(node->second);
        sh.value.emplace(local,c);
        sh.refCount[local]=1;
        return make_shard_id(DYN_SOVER_BASE,si,local);
    }
    void init(std::unordered_map<int,double> num,std::unordered_map<int,std::string> str)
    {
        //静态字符串本体:节点稳定(静态条目永不回收)→ 指向它的 view 不会失效
        static_str_store=std::move(str);
        std::vector<std::pair<int,Const>> entries;
        entries.reserve(num.size()+static_str_store.size());
        static_nums.reserve(num.size());
        static_strs.reserve(static_str_store.size());
        for (const auto& [key,value]:num)
        {
            Const c;
            c.type=true;
            c.num=value;
            entries.emplace_back(key,c);
            static_nums.emplace_back(std::bit_cast<uint64_t>(value),key);
        }
        for (const auto& [key,value]:static_str_store)
        {
            Const c;
            c.type=false;
            c.str=std::string_view(value);
            entries.emplace_back(key,c);
            static_strs.push_back(StaticStr{std::hash<std::string_view>{}(std::string_view(value)),
                std::string_view(value),key});
        }
        std::sort(static_nums.begin(),static_nums.end());
        std::sort(static_strs.begin(),static_strs.end(),[](const StaticStr& a,const StaticStr& b){
            if (a.hash!=b.hash) return a.hash<b.hash;
            return a.view<b.view;
        });
        if (!entries.empty())
        {
            size_t sz=16;
            while (sz<entries.size()*2) sz<<=1;
            st_val.assign(sz,Const{});
            st_key.assign(sz,0);
            st_used.assign(sz,0);
            st_mask=static_cast<uint32_t>(sz-1);
            int k=0;
            while ((static_cast<size_t>(1)<<k)<sz) k++;   //k = log2(sz)
            st_shift=32-k;
            for (const auto& [id,c]:entries)
            {
                uint32_t s=(hash_id(id)>>st_shift)&st_mask;
                while (st_used[s]) s=(s+1)&st_mask;
                st_used[s]=1;
                st_key[s]=id;
                st_val[s]=c;
            }
        }
    }
    void gc()
    {
        //常量池现在是"引用归零即刻回收"(数字/字符串标墓碑并可被复用,分片溢出表直接摘除)。
        //这里只做一件事:释放被回收的字符串本体 —— 延迟到 gc 释放而不是立刻 free,
        //是因为读者可能刚拿到指向它的 view。
        std::vector<StrEntry*> dead;
        {
            std::lock_guard<std::mutex> lock(sret_mtx);
            dead.swap(sretired);
        }
        for (StrEntry* e:dead) delete e;
    }
    Const get(const int id)
    {
        //静态常量:不可变表直查(无锁)
        if (const int s=find_static(id);s>=0) return st_val[s];
        if (is_num(id))
        {
            int slot=0;
            if (!num_alive(id,slot)) return {};
            NumSlot* t=ntab.load(std::memory_order_acquire);
            const uint64_t b=t[slot].key.load(std::memory_order_relaxed);   //state 的 acquire 已保证可见
            Const c;
            c.type=true;
            std::memcpy(&c.num,&b,sizeof(double));
            return c;
        }
        if (is_str(id))
        {
            StrEntry* e=nullptr;
            if (!str_alive(id,e)) return {};
            Const c;
            c.type=false;
            c.str=std::string_view(e->s);      //本体不可变且延迟释放 → view 安全
            return c;
        }
        if (!is_over(id)&&!is_sover(id)) return {};
        Shard& sh=shards[shard_of_shard_id(id,is_over(id)?DYN_OVER_BASE:DYN_SOVER_BASE)];
        std::lock_guard<std::mutex> lock(sh.mtx);
        return shard_value(sh,local_of_shard_id(id));
    }
};

struct TaskCond
{
    //var
    int id;
    bool prefix;
    //可能的offset
    int offset;
    //可能的name
    std::string name;
};
using TaskRun=void(*)(VarPool*,void(*)(VarPool*,int,int),void(*)(VarPool*,int,int,int),void(*)(VarPool*,int,const std::string&,int),int,int,int);
//【热路径优化】Task 改为 POD(整块 trivially copyable):
//此前是 Task{std::vector<TaskCond> cond, run},而 TaskCond 带 std::string name,
//于是**每条指令**都构造一次 vector(堆分配)+ 若干 std::string(实测占一条 mov 的 ~680ns/860ns)。
//现在热路径直接把操作数塞进 POD,且只在"槽被占用需要延迟执行"时(罕见)才入队。
//cond 的语义:前 n 个操作数是"读的槽",若该槽正被占用(var_lock)则整个任务延迟执行。
struct Task
{
    TaskRun run;
    int a;
    int b;
    int c;
    int n;   //需要检查的槽操作数个数(1..3)
};
using TaskQueue=std::vector<Task>;
class VarPool
{
private:
    //【热路径优化】槽表数组化:编译器槽号是**全局唯一且连续的小整数**(HScope::id() 走统一计数器;
    //实测 23 行程序 125 个槽、最大 138),故 var/var_lock 对小 id 改用下标直取的数组:
    //  1) 省掉每条指令的 hash 查找(实测 4 次 hash ≈118ns,占一条 xor 指令的 1/6);
    //  2) 不同下标的元素是**独立内存位置**,两个 Runtime 读写不同槽根本不构成数据竞争,
    //     于是热路径(readVar/writeVar/oper 的占用检查)彻底不再碰 vmtx —— 这是多线程不扩展的根因。
    //运行期 alloc() 出来的 id 恒 >= 0x40000000,永不落进数组区间;超出 arr_n 的静态 id 同样兜底走 hash 表。
    //元素必须是 atomic:槽是**共享**的(同一函数被多个 Runtime 并发调用),裸 int 并发读写是 UB。
    std::vector<std::atomic<int>> var_arr;
    std::vector<std::atomic<uint8_t>> var_lock_arr;
    int arr_n=0;
    //队列长度(原子读):槽释放时据此跳过 drain_queue,避免写一个槽也去抢队列锁
    std::atomic<int> qlen{0};
    std::unordered_map<int,int> var;
    std::unordered_map<int,bool> var_lock;
    //===== 成员槽(alloc() 出来的 id):同样是"下标直取"的无锁数组 =====
    //alloc id 从 alloc_base() 起、单调递增,所以 idx = id - alloc_base() 是稠密的 →
    //分块数组 + 块指针原子发布(只分配不移动),读写完全无锁。
    //否则每次容器 offset_get/offset_set 都要抢一把全局 vmtx(实测 8 线程容器负载只有 0.04×)。
    static constexpr int VB_BITS=10;                    //每块 1024 个槽
    static constexpr int VB_SIZE=1<<VB_BITS;
    static constexpr int VB_MASK=VB_SIZE-1;
    static constexpr int VB_COUNT=1024;                 //上限 1M 个成员槽
    struct VarBlock
    {
        std::atomic<int> v[VB_SIZE];
        std::atomic<uint8_t> lock[VB_SIZE];
        VarBlock()
        {
            for (int i=0;i<VB_SIZE;i++)
            {
                v[i].store(0,std::memory_order_relaxed);
                lock[i].store(0,std::memory_order_relaxed);
            }
        }
    };
    std::array<std::atomic<VarBlock*>,VB_COUNT> vblocks{};
    std::mutex vblock_mtx;
    //===== 对象成员表(offset):扁平无锁开放寻址,键 = (对象 id, 键 id) =====
    //offset_set/get/addr 与 io.cpp 的 field() 都要过这里(容器、print 的热路径),
    //此前是"嵌套 unordered_map + 一把全局 vmtx"。现在改成扁平表 + CAS 认领:
    //  · 已存在的键:读/写都是 O(1) 原子操作,**完全无锁**(值就地更新);
    //  · 新键:CAS 认领一个空槽后发布;
    //  · 表负载到 50% 之后新键走按 (obj,key) 散列的分片表兜底(冷路径,正确但慢)。
    //offset 的条目**从不删除**(与旧实现一致:成员槽由 gc/编译器 delete 管,表只增),
    //所以不需要墓碑复用,也不需要代际。
    static constexpr int OSLOT_BITS=15;                 //32768 槽 × 16B = 512KB(懒分配)
    static constexpr int OSLOT_COUNT=1<<OSLOT_BITS;
    static constexpr int OSLOT_MASK=OSLOT_COUNT-1;
    static constexpr int32_t OF_OCC=0, OF_EMPTY=-1, OF_CLAIM=-3;
    struct OffSlot
    {
        std::atomic<int32_t> state{OF_EMPTY};
        std::atomic<int32_t> obj{0};
        std::atomic<int32_t> key{0};
        std::atomic<int32_t> vid{0};
    };
    std::atomic<OffSlot*> otab{nullptr};
    std::mutex otab_mtx;
    std::atomic<int> oused{0};
    std::atomic<bool> ooverflowed{false};               //曾经溢出过?没溢出时"表里没有 = 就没有",省掉分片锁
    static constexpr int OF_SHARD_BITS=6;
    static constexpr int OF_SHARD_COUNT=1<<OF_SHARD_BITS;
    struct OffShard
    {
        std::mutex mtx;
        std::unordered_map<uint64_t,int> m;             //(obj<<32|key) → vid
    };
    mutable std::array<OffShard,OF_SHARD_COUNT> oshards;
    //name 路径:运行时已经没有任何调用点(writeName/readName/name_lock 全是死代码),保留接口但用独立小锁
    std::unordered_map<int,std::unordered_map<std::string,int>> name;
    mutable std::mutex name_mtx;
    TaskQueue task_queue;
    //alloc 起点:基于 this 地址的随机高位(>=1<<30),远离编译器槽号/池id区间;单调递增保证不撞
    std::atomic<int> nextId{0};
    //var/offset/name 并发访问互斥(thread 指令多线程共享 VarPool)
    mutable std::mutex vmtx;
    int alloc_base() const
    {
        return static_cast<int>(0x40000000 | (0x3FFFFFFF & (uintptr_t)this));
    }
    //成员槽下标(负数 = 不在本池的成员槽区间内)
    int member_idx(const int id) const
    {
        const long long idx=static_cast<long long>(id)-alloc_base();
        if (idx<0||idx>=static_cast<long long>(VB_COUNT)*VB_SIZE) return -1;
        return static_cast<int>(idx);
    }
    VarBlock* member_block(const int idx,bool create)
    {
        VarBlock* b=vblocks[idx>>VB_BITS].load(std::memory_order_acquire);
        if (b||!create) return b;
        std::lock_guard<std::mutex> lock(vblock_mtx);
        b=vblocks[idx>>VB_BITS].load(std::memory_order_relaxed);
        if (!b)
        {
            b=new VarBlock();
            vblocks[idx>>VB_BITS].store(b,std::memory_order_release);
        }
        return b;
    }
    int member_read(const int idx) const
    {
        VarBlock* b=vblocks[idx>>VB_BITS].load(std::memory_order_acquire);
        return b?b->v[idx&VB_MASK].load(std::memory_order_relaxed):0;
    }
    void member_write(const int idx,const int value)
    {
        VarBlock* b=member_block(idx,true);
        b->v[idx&VB_MASK].store(value,std::memory_order_relaxed);
    }
    bool member_locked(const int idx) const
    {
        VarBlock* b=vblocks[idx>>VB_BITS].load(std::memory_order_acquire);
        return b&&b->lock[idx&VB_MASK].load(std::memory_order_acquire)!=0;
    }
public:
    ConstPool data;
    //数组化的槽号上限:实测真实产物的槽号**稠密**(稀疏度 1.1×,但每条约 16 个槽:
    //40 条语句→645 个槽、200 条语句→3205 个槽),所以按 maxId 下标定容是合适的;
    //上限取 2^18 可覆盖约 16000 条语句的程序,内存硬上界 = 2^18*(4+1) ≈ 1.3MB。
    //超过上限的槽号(以及 alloc() 的运行期 id,恒 ≥0x40000000)一律走 hash 兜底,只是慢,不影响正确性。
    static constexpr int SLOT_LIMIT=1<<18;
    VarPool() { nextId.store(alloc_base(),std::memory_order_relaxed); }
    ~VarPool() { delete[] otab.load(std::memory_order_relaxed); }
    //槽表定容(n = 最大操作数+1)。n 可能来自用户写的巨大字面量,故用 long long 收口后再夹到
    //SLOT_LIMIT:一是不会 int 溢出,二是内存硬上界 = SLOT_LIMIT*(sizeof(int)+sizeof(uint8_t)) ≈ 320KB。
    //超出这个范围的槽号(以及 alloc() 的运行期 id)一律走 hash 兜底 —— 只是慢,不影响正确性。
    void init_slots(const long long n)
    {
        long long want=n<8?8:n;
        if (want>SLOT_LIMIT) want=SLOT_LIMIT;
        arr_n=static_cast<int>(want);
        var_arr=std::vector<std::atomic<int>>(arr_n);
        var_lock_arr=std::vector<std::atomic<uint8_t>>(arr_n);
        for (int i=0;i<arr_n;i++)
        {
            var_arr[i].store(0,std::memory_order_relaxed);
            var_lock_arr[i].store(0,std::memory_order_relaxed);
        }
    }
    //该 id 是否走数组(编译器槽号);alloc() 的 id 恒 >= 0x40000000 → 必然为 false
    bool is_arr(const int id) const
    {
        return static_cast<unsigned>(id)<static_cast<unsigned>(arr_n);
    }
    //该 id 是否是本池 alloc() 出来的成员槽(→ 走无锁分块数组)
    bool is_member(const int id) const { return member_idx(id)>=0; }
    //槽是否被占用(= 可能有别的 Runtime 正在写同一槽,当前指令需延迟执行)
    bool locked(const int id) const
    {
        if (is_arr(id))
            return var_lock_arr[id].load(std::memory_order_acquire)!=0;
        const int mi=member_idx(id);
        if (mi>=0) return member_locked(mi);
        const auto it=var_lock.find(id);
        return it!=var_lock.end()&&it->second;
    }
    //===== offset 扁平无锁表的小工具 =====
    static uint32_t off_hash(const int obj,const int key)
    {
        const uint64_t x=(static_cast<uint64_t>(static_cast<uint32_t>(obj))<<32)|static_cast<uint32_t>(key);
        return static_cast<uint32_t>((x*0x9E3779B97F4A7C15ull)>>32);
    }
    static uint64_t off_pair(const int obj,const int key)
    {
        return (static_cast<uint64_t>(static_cast<uint32_t>(obj))<<32)|static_cast<uint32_t>(key);
    }
    static int off_shard(const int obj,const int key)
    {
        return static_cast<int>(off_hash(obj,key)>>(32-OF_SHARD_BITS));
    }
    OffSlot* off_table()
    {
        OffSlot* t=otab.load(std::memory_order_acquire);
        if (t) return t;
        std::lock_guard<std::mutex> lock(otab_mtx);
        t=otab.load(std::memory_order_relaxed);
        if (!t)
        {
            t=new OffSlot[OSLOT_COUNT];
            otab.store(t,std::memory_order_release);
        }
        return t;
    }
    //查表:命中返回槽下标,未命中返回 -1(只查无锁表,不含溢出面)
    int off_find(const int obj,const int key) const
    {
        OffSlot* t=otab.load(std::memory_order_acquire);
        if (!t) return -1;
        uint32_t s=off_hash(obj,key)>>(32-OSLOT_BITS);
        for (int probe=0;probe<OSLOT_COUNT;probe++)
        {
            const int32_t st=t[s].state.load(std::memory_order_acquire);
            if (st==OF_CLAIM)
            {
                //有人在写这个槽:自旋等它发布(写者不持锁,窗口几条指令)
                while (t[s].state.load(std::memory_order_acquire)==OF_CLAIM)
                    std::this_thread::yield();
                continue;
            }
            if (st==OF_OCC)
            {
                if (t[s].obj.load(std::memory_order_relaxed)==obj&&t[s].key.load(std::memory_order_relaxed)==key)
                    return static_cast<int>(s);
                s=(s+1)&OSLOT_MASK;
                continue;
            }
            return -1;   //OF_EMPTY:没找到
        }
        return -1;
    }
    //查表(含溢出兜底):命中返回 true 并写回 vid
    bool off_get(const int obj,const int key,int& vid) const
    {
        const int s=off_find(obj,key);
        if (s>=0)
        {
            OffSlot* t=otab.load(std::memory_order_acquire);
            vid=t[s].vid.load(std::memory_order_relaxed);
            return true;
        }
        if (!ooverflowed.load(std::memory_order_relaxed)) return false;
        OffShard& sh=oshards[off_shard(obj,key)];
        std::lock_guard<std::mutex> lock(sh.mtx);
        const auto it=sh.m.find(off_pair(obj,key));
        if (it==sh.m.end()) return false;
        vid=it->second;
        return true;
    }
    bool off_has(const int obj,const int key) const
    {
        int v=0;
        return off_get(obj,key,v);
    }
    //新建一个变量槽(offset_set 建成员变量用),返回其 var_id
    int alloc()
    {
        //无锁:nextId 是单调递增的原子计数器,起点在 0x40000000 以上(编译器槽号/对象句柄都到不了),
        //所以不需要再去 var 里查重 —— 这样"并行给容器建新成员键"也不会再抢一把全局锁。
        return nextId.fetch_add(1,std::memory_order_relaxed);
    }
    //offset 键是否存在
    bool hasOffset(const int id,const int off) const
    {
        return off_has(id,off);
    }
    void init(const std::unordered_map<int,double>& num, const std::unordered_map<int,std::string>& str)
    {
        data.init(num,str);
    }
    //===== 槽占用标志 =====
    //数组化的槽走原子标志,不需要 vmtx;只有 alloc() 出来的 id / 超限 id 才回落到锁表 hash。
    //(offset/name 的占用标志此前是死代码 —— 运行时的 Cond 只检查 var 槽 —— 已删除)
    static void lock_var(VarPool* data,const int id)
    {
        if (data->is_arr(id))
        {
            data->var_lock_arr[id].store(1,std::memory_order_release);
            return;
        }
        if (const int mi=data->member_idx(id);mi>=0)
        {
            data->member_block(mi,true)->lock[mi&VB_MASK].store(1,std::memory_order_release);
            return;
        }
        std::lock_guard lock(data->vmtx);
        if (!data->var_lock[id])
            data->var_lock[id]=true;
    }
    static void unlock_var(VarPool* data,const int id)
    {
        if (data->is_arr(id))
            data->var_lock_arr[id].store(0,std::memory_order_release);
        else if (const int mi=data->member_idx(id);mi>=0)
        {
            VarBlock* b=data->member_block(mi,false);
            if (b) b->lock[mi&VB_MASK].store(0,std::memory_order_release);
        }
        else
        {
            std::lock_guard lock(data->vmtx);
            if (data->var_lock[id])
                data->var_lock[id]=false;
        }
        //队列空时(绝大多数)连队列锁都不进
        if (data->qlen.load(std::memory_order_relaxed)!=0) drain_queue(data);
    }
    static void writeVar(VarPool* data,const int id, const int value)
    {
        //槽里存的是池 id/变量 id/块 id,装载与搬运都不增加引用计数(编译器按作用域 emit delete 释放),
        //因此这里**不能释放旧值**:此前把 var_lock[id](bool)当池 id 传给 delete_,
        //导致每次变量写都误释放池 id 0 → 一次 gc 就把仍在使用的常量删掉(常量静默变空串/0)。
        //改为:若写入的是池条目则 retain 一次,使槽引用被计数,GC 不会误删。
        if (data->data.is_pool(value))
            data->data.retain(value);
        if (data->is_arr(id))
        {
            //先置占用再写值(与 oper 的检查配对;槽是共享的,并发写同一槽仍靠 Cond 协作式延迟)
            data->var_lock_arr[id].store(1,std::memory_order_release);
            data->var_arr[id].store(value,std::memory_order_relaxed);
        }
        else if (const int mi=data->member_idx(id);mi>=0)
        {
            //成员槽:块内原子标志 + 原子写,完全无锁
            VarBlock* b=data->member_block(mi,true);
            b->lock[mi&VB_MASK].store(1,std::memory_order_release);
            b->v[mi&VB_MASK].store(value,std::memory_order_relaxed);
        }
        else
        {
            std::lock_guard<std::mutex> lock(data->vmtx);
            if (!data->var_lock[id])
                data->var_lock[id]=true;
            data->var[id]=value;
        }
        unlock_var(data,id);
    }
    //offset_set:member[obj][key] = value。已存在的键就地原子更新(无锁);新键 CAS 认领空槽后发布
    static void writeOffset(VarPool* data,const int id, const int off, const int value)
    {
        //与旧实现一致:写入池条目时 retain 一次,避免槽引用被 gc 误删
        if (data->data.is_pool(value))
            data->data.retain(value);
        OffSlot* t=data->off_table();
        uint32_t s=off_hash(id,off)>>(32-OSLOT_BITS);
        for (int probe=0;probe<OSLOT_COUNT;probe++)
        {
            int32_t st=t[s].state.load(std::memory_order_acquire);
            if (st==OF_CLAIM)
            {
                while (t[s].state.load(std::memory_order_acquire)==OF_CLAIM)
                    std::this_thread::yield();
                continue;
            }
            if (st==OF_OCC)
            {
                if (t[s].obj.load(std::memory_order_relaxed)==id&&t[s].key.load(std::memory_order_relaxed)==off)
                {
                    t[s].vid.store(value,std::memory_order_relaxed);   //已存在 → 就地更新,无锁
                    return;
                }
                s=(s+1)&OSLOT_MASK;
                continue;
            }
            //负载闸门:表负载到 50% 后新键走溢出分片表(保证空槽充足、探测常数级)
            if (data->oused.load(std::memory_order_relaxed)>=OSLOT_COUNT/2) break;
            int32_t expect=OF_EMPTY;
            if (!t[s].state.compare_exchange_strong(expect,OF_CLAIM,
                    std::memory_order_acq_rel,std::memory_order_acquire))
                continue;                                          //被别人抢先:重来
            t[s].obj.store(id,std::memory_order_relaxed);
            t[s].key.store(off,std::memory_order_relaxed);
            t[s].vid.store(value,std::memory_order_relaxed);
            t[s].state.store(OF_OCC,std::memory_order_release);     //发布
            data->oused.fetch_add(1,std::memory_order_relaxed);
            return;
        }
        //溢出兜底
        data->ooverflowed.store(true,std::memory_order_relaxed);
        OffShard& sh=data->oshards[off_shard(id,off)];
        std::lock_guard<std::mutex> lock(sh.mtx);
        sh.m[off_pair(id,off)]=value;
    }
    //name 路径:运行时已无调用点(死代码),保留接口但不再用 vmtx
    static void writeName(VarPool* data,const int id, const std::string& n, const int value)
    {
        if (data->data.is_pool(value))
            data->data.retain(value);
        std::lock_guard<std::mutex> lock(data->name_mtx);
        data->name[id][n]=value;
    }
    //读路径一律用 find:此前 operator[] 会为缺失键插入 0,污染 hasOffset,
    //使后续 offset_set/offset_addr 复用 vid=0(哨兵) → 写进槽 0(容器新键写入静默失效)
    //数组槽则直接下标直取(无锁、无 hash)
    static int readVar(VarPool* data,const int id)
    {
        if (data->is_arr(id))
            return data->var_arr[id].load(std::memory_order_relaxed);
        if (const int mi=data->member_idx(id);mi>=0)
            return data->member_read(mi);          //成员槽:无锁分块数组
        std::lock_guard<std::mutex> lock(data->vmtx);
        const auto it=data->var.find(id);
        return it==data->var.end()?0:it->second;
    }
    static int readOffset(VarPool* data,const int id, const int off)
    {
        int v=0;
        return data->off_get(id,off,v)?v:0;      //无锁
    }
    static int readName(VarPool* data,const int id, const std::string& n)
    {
        std::lock_guard<std::mutex> lock(data->name_mtx);
        const auto it=data->name.find(id);
        if (it==data->name.end())return 0;
        const auto v=it->second.find(n);
        return v==it->second.end()?0:v->second;
    }
    static void unsafeWriteVar(VarPool* data,const int id, const int value)
    {
        if (data->is_arr(id))
        {
            data->var_arr[id].store(value,std::memory_order_relaxed);
            return;
        }
        if (const int mi=data->member_idx(id);mi>=0)
        {
            data->member_write(mi,value);        //成员槽:无锁
            return;
        }
        std::lock_guard<std::mutex> lock(data->vmtx);
        data->var[id]=value;
    }
    static void unsafeWriteOffset(VarPool* data,const int id, const int off, const int value)
    {
        //offset 表已经无锁(已存在的键就地原子更新,新键 CAS 认领)→ 与 writeOffset 同一实现。
        //注意:这里**不**做 retain —— 保持原 unsafe 语义(调用方自己管引用计数,见 io.cpp 的数组反序列化)
        OffSlot* t=data->off_table();
        uint32_t s=off_hash(id,off)>>(32-OSLOT_BITS);
        for (int probe=0;probe<OSLOT_COUNT;probe++)
        {
            int32_t st=t[s].state.load(std::memory_order_acquire);
            if (st==OF_CLAIM)
            {
                while (t[s].state.load(std::memory_order_acquire)==OF_CLAIM)
                    std::this_thread::yield();
                continue;
            }
            if (st==OF_OCC)
            {
                if (t[s].obj.load(std::memory_order_relaxed)==id&&t[s].key.load(std::memory_order_relaxed)==off)
                {
                    t[s].vid.store(value,std::memory_order_relaxed);
                    return;
                }
                s=(s+1)&OSLOT_MASK;
                continue;
            }
            if (data->oused.load(std::memory_order_relaxed)>=OSLOT_COUNT/2) break;
            int32_t expect=OF_EMPTY;
            if (!t[s].state.compare_exchange_strong(expect,OF_CLAIM,
                    std::memory_order_acq_rel,std::memory_order_acquire))
                continue;
            t[s].obj.store(id,std::memory_order_relaxed);
            t[s].key.store(off,std::memory_order_relaxed);
            t[s].vid.store(value,std::memory_order_relaxed);
            t[s].state.store(OF_OCC,std::memory_order_release);
            data->oused.fetch_add(1,std::memory_order_relaxed);
            return;
        }
        data->ooverflowed.store(true,std::memory_order_relaxed);
        OffShard& sh=data->oshards[off_shard(id,off)];
        std::lock_guard<std::mutex> lock(sh.mtx);
        sh.m[off_pair(id,off)]=value;
    }
    static void unsafeWriteName(VarPool* data,const int id, const std::string& n, const int value)
    {
        std::lock_guard<std::mutex> lock(data->name_mtx);
        data->name[id][n]=value;
    }
    static int unsafeReadVar(VarPool* data,const int id)
    {
        if (data->is_arr(id))
            return data->var_arr[id].load(std::memory_order_relaxed);
        if (const int mi=data->member_idx(id);mi>=0)
            return data->member_read(mi);          //成员槽:无锁分块数组
        std::lock_guard<std::mutex> lock(data->vmtx);
        const auto it=data->var.find(id);
        return it==data->var.end()?0:it->second;
    }
    static int unsafeReadOffset(VarPool* data,const int id, const int off)
    {
        int v=0;
        return data->off_get(id,off,v)?v:0;      //无锁(命中在无锁表里;未命中且曾溢出才查分片表)
    }
    static int unsafeReadName(VarPool* data,const int id, const std::string& n)
    {
        std::lock_guard<std::mutex> lock(data->name_mtx);
        const auto it=data->name.find(id);
        if (it==data->name.end())return 0;
        const auto v=it->second.find(n);
        return v==it->second.end()?0:v->second;
    }
    //【热路径】直接收操作数,不再构造 Task/vector/string:
    //1) 检查前 n 个操作数所在槽是否被占用(占用=可能有别的 Runtime 在写同一槽);
    //   槽表数组化后这一步是纯原子读,**不再需要 vmtx**(无关指令之间零竞争);
    //2) 没有被占用就地调用 handler(handler 内部的槽访问走数组,同样无锁);
    //3) 只有被占用时才抢队列锁,构造一个 POD Task 入队,等槽释放后由 drain_queue 重试。
    void oper(const int a,const int b,const int c,const int n,TaskRun fn)
    {
        const int ops[3]={a,b,c};
        bool has=true;
        for (int i=0;i<n;i++)
        {
            if (locked(ops[i]))
            {
                has=false;
                break;
            }
        }
        if (has)
        {
            fn(this,writeVar,writeOffset,writeName,a,b,c);
            return;
        }
        std::lock_guard<std::mutex> lock(vmtx);
        task_queue.push_back(Task{fn,a,b,c,n});
        qlen.store(static_cast<int>(task_queue.size()),std::memory_order_relaxed);
    }
    //槽释放后把队首可执行的任务取出执行(执行仍走 oper,以便再次竞争时重新入队)
    static void drain_queue(VarPool* data)
    {
        while (true)
        {
            Task task{};
            bool run_it=false;
            {
                std::lock_guard<std::mutex> lock(data->vmtx);
                if (data->task_queue.empty())
                {
                    data->qlen.store(0,std::memory_order_relaxed);
                    break;
                }
                const Task& t=data->task_queue.front();
                if (!data->task_ready(t)) break;
                task=t;
                data->task_queue.erase(data->task_queue.begin());
                data->qlen.store(static_cast<int>(data->task_queue.size()),std::memory_order_relaxed);
                run_it=true;
            }
            if (run_it) data->oper(task.a,task.b,task.c,task.n,task.run);
        }
    }
    //任务是否可执行:其 n 个操作数对应的槽都未被占用(调用时已持有 vmtx,故 locked() 内不能再取锁)
    bool task_ready(const Task& t)
    {
        const int ops[3]={t.a,t.b,t.c};
        for (int i=0;i<t.n;i++)
            if (locked(ops[i])) return false;
        return true;
    }
};
#endif