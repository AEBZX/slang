//model.h 单元测试:Stack/ConstPool(引用计数GC)/VarPool(读写+任务队列)
//测试名一律 ASCII:Windows+MinGW 下中文测试名经 ctest 传参会编码错乱
#include "model.h"
#include <catch2/catch_test_macros.hpp>
#include <atomic>
#include <barrier>
#include <thread>
#include <unordered_map>

TEST_CASE("stack: push/pop/peek/size", "[model]")
{
    Stack<int> s;
    REQUIRE(s.size() == 0);
    s.push(1);
    s.push(2);
    s.push(3);
    REQUIRE(s.size() == 3);
    REQUIRE(s.peek() == 3);
    REQUIRE(s.pop() == 3);
    REQUIRE(s.pop() == 2);
    REQUIRE(s.pop() == 1);
    REQUIRE(s.size() == 0);
}

TEST_CASE("const pool: link dedup", "[model]")
{
    ConstPool pool;
    const int s1 = pool.link(std::string("hello"));
    const int s2 = pool.link(std::string("hello"));
    REQUIRE(s1 == s2);
    const int n1 = pool.link(1.5);
    const int n2 = pool.link(1.5);
    REQUIRE(n1 == n2);
    //数字与字符串互不影响
    REQUIRE(pool.link(2.5) != s1);
}

TEST_CASE("const pool: string refcount gc frees", "[model]")
{
    ConstPool pool;
    const int id = pool.link(std::string("hello"));
    pool.link(std::string("hello"));   //引用计数+1
    pool.delete_(id);
    pool.delete_(id);                  //计数归零→入gcList
    pool.gc();
    //已释放,重新link得到新id
    REQUIRE(pool.link(std::string("hello")) != id);
}

TEST_CASE("const pool: number refcount gc frees", "[model]")
{
    //修复B:link(double)必须初始化refCount=1,否则数字常量永远无法回收
    ConstPool pool;
    const int id = pool.link(2.5);
    pool.delete_(id);
    pool.gc();
    REQUIRE(pool.link(2.5) != id);
}

TEST_CASE("const pool: init entries are immortal static data", "[model]")
{
    //【优化⑤后的契约】init 装载进来的常量 = 程序静态数据:内容不再变化、也不再回收
    //(与字符串字面量池同理;运行期 link 出来的动态常量仍按引用计数正常回收)。
    //这样 get/is_pool/retain/link 对静态 id 全部变成无锁 —— 并行不扩展的主因就是这把全局锁。
    ConstPool pool;
    std::unordered_map<int, double> num{{10, 3.14}};
    std::unordered_map<int, std::string> str{{20, "init_str"}};
    pool.init(num, str);
    pool.delete_(10);
    pool.gc();
    //不回收:id 不变,值也还在
    REQUIRE(pool.link(3.14) == 10);
    REQUIRE(pool.get(10).num == 3.14);
    pool.delete_(20);
    pool.gc();
    REQUIRE(pool.link(std::string("init_str")) == 20);
    REQUIRE(pool.get(20).str == std::string_view("init_str"));
    //对照:运行期 link 出来的动态常量仍会被回收。
    //运行期 id 现在带"分片号 + 片内序号"(不再是紧接静态 id 的小整数),
    //所以这里只断言语义:可取回、与静态 id 不冲突、回收后重新 link 会拿到新 id
    const int dyn = pool.link(std::string("dynamic"));
    REQUIRE(dyn != 20);
    REQUIRE(pool.get(dyn).str == std::string_view("dynamic"));
    REQUIRE(pool.is_pool(dyn));
    pool.delete_(dyn);
    pool.gc();
    REQUIRE_FALSE(pool.is_pool(dyn));
    REQUIRE(pool.link(std::string("dynamic")) != dyn);
}

TEST_CASE("const pool: negative/oversized ids stay dynamic", "[model]")
{
    //sbin 的池 id 字段是 uint32,>=2^31 读进来是**负数**:不能拿它当数组下标(曾越界崩溃),
    //但必须仍然可用、且和其它静态常量一样不可回收(静态表是开放寻址表,key 可以任意 int)。
    ConstPool pool;
    std::unordered_map<int, double> num{{2, 1.0}};
    std::unordered_map<int, std::string> str{{-1, "neg"}, {3, "pos"}};   // -1 模拟 2^32-1
    pool.init(num, str);
    REQUIRE(pool.get(-1).str == std::string_view("neg"));
    REQUIRE(pool.is_pool(-1));
    REQUIRE(pool.get(3).str == std::string_view("pos"));
    //值→id 反查仍能找到它(静态命中,无锁且不计引用)
    REQUIRE(pool.link(std::string("neg")) == -1);
}

TEST_CASE("var pool: slot table clamps huge sizing request", "[model]")
{
    //槽表定容的入参来自"指令流里的最大操作数",可能只是用户写的一个巨大字面量:
    //必须夹到 SLOT_LIMIT(内存硬上界 ≈320KB),负数/溢出值也不能拿去 resize
    VarPool pool;
    pool.init_slots(4000000000LL);
    pool.unsafeWriteVar(&pool, 5, 42);
    REQUIRE(VarPool::unsafeReadVar(&pool, 5) == 42);
    //超出数组范围的巨大槽号仍可读写(hash 兜底)
    pool.unsafeWriteVar(&pool, 1073741823, 7);
    REQUIRE(VarPool::unsafeReadVar(&pool, 1073741823) == 7);
    //负数槽号同样兜底
    pool.unsafeWriteVar(&pool, -1, 9);
    REQUIRE(VarPool::unsafeReadVar(&pool, -1) == 9);
    pool.init_slots(-1);
    REQUIRE(VarPool::unsafeReadVar(&pool, 5) == 0);
}

TEST_CASE("const pool: delete unknown id safe", "[model]")
{
    ConstPool pool;
    pool.delete_(999);   //未知id应无副作用
    pool.gc();
    const int id = pool.link(std::string("x"));
    REQUIRE(pool.link(std::string("x")) == id);
}

TEST_CASE("var pool: read/write var/offset/name", "[model]")
{
    VarPool pool;
    VarPool::unsafeWriteVar(&pool, 1, 100);
    REQUIRE(VarPool::unsafeReadVar(&pool, 1) == 100);
    VarPool::unsafeWriteOffset(&pool, 2, 3, 200);
    REQUIRE(VarPool::unsafeReadOffset(&pool, 2, 3) == 200);
    VarPool::unsafeWriteName(&pool, 4, "key", 300);
    REQUIRE(VarPool::unsafeReadName(&pool, 4, "key") == 300);
    //带锁版本
    VarPool::writeVar(&pool, 5, 400);
    REQUIRE(VarPool::readVar(&pool, 5) == 400);
    VarPool::writeOffset(&pool, 6, 7, 500);
    REQUIRE(VarPool::readOffset(&pool, 6, 7) == 500);
    VarPool::writeName(&pool, 8, "k2", 600);
    REQUIRE(VarPool::readName(&pool, 8, "k2") == 600);
}

//任务回调:记录收到的原始操作数(TaskRun 新签名:VarPool* 首参 + 3 个 int)
static int g_a0 = 0;
static int g_a1 = 0;
static int g_a2 = 0;
static int g_calls = 0;
static void task_run(VarPool*,
                     void(*)(VarPool*, int, int),
                     void(*)(VarPool*, int, int, int),
                     void(*)(VarPool*, int, const std::string&, int),
                     int a, int b, int c)
{
    g_a0 = a;
    g_a1 = b;
    g_a2 = c;
    g_calls++;
}

TEST_CASE("var pool: task runs when unlocked", "[model]")
{
    VarPool pool;
    VarPool::unsafeWriteVar(&pool, 5, 42);
    g_calls = 0;
    pool.oper(5, 0, 0, 1, task_run);   //var 5未锁→立即执行
    REQUIRE(g_calls == 1);
    REQUIRE(g_a0 == 5);   //传原始操作数id,不解析值
    REQUIRE(g_a1 == 0);
    REQUIRE(g_a2 == 0);   //不足3个cond时补0
}

TEST_CASE("var pool: task queued while locked then runs on unlock", "[model]")
{
    VarPool pool;
    VarPool::lock_var(&pool, 5);
    g_calls = 0;
    pool.oper(5, 0, 0, 1, task_run);   //var 5被锁→入队
    REQUIRE(g_calls == 0);
    VarPool::writeVar(&pool, 5, 100);   //writeVar内部unlock→弹出队首执行
    REQUIRE(g_calls == 1);
    REQUIRE(g_a0 == 5);
}

TEST_CASE("var pool: task with three var conds", "[model]")
{
    //TaskCond 已简化为 POD(操作数 + cond 个数):offset/name 形态此前无任何指令使用,已移除
    VarPool pool;
    VarPool::unsafeWriteVar(&pool, 3, 111);
    VarPool::unsafeWriteVar(&pool, 9, 222);
    g_calls = 0;
    pool.oper(3, 9, 11, 3, task_run);   //三个槽都空闲→立即执行,原样传三个操作数
    REQUIRE(g_calls == 1);
    REQUIRE(g_a0 == 3);
    REQUIRE(g_a1 == 9);
    REQUIRE(g_a2 == 11);
}

TEST_CASE("var pool: blocked front task not duplicated on unlock", "[model]")
{
    //修复F:解锁时弹出队首再执行;旧代码队首仍被锁时会重复入队导致同一任务执行多次
    VarPool pool;
    VarPool::lock_var(&pool, 6);
    VarPool::lock_var(&pool, 7);
    g_calls = 0;
    pool.oper(6, 0, 0, 1, task_run);
    pool.oper(7, 0, 0, 1, task_run);
    VarPool::unlock_var(&pool, 7);   //队首是6(仍锁)→不执行
    VarPool::unlock_var(&pool, 6);   //6解锁→t6执行
    VarPool::unlock_var(&pool, 7);   //7已解锁→t7执行
    //每个任务恰好执行一次;旧代码t6会因未出队被反复执行
    REQUIRE(g_calls == 2);
}

TEST_CASE("const pool: get string and number", "[model]")
{
    ConstPool pool;
    const int sid = pool.link(std::string("hello"));
    const int nid = pool.link(2.5);
    const Const sc = pool.get(sid);
    REQUIRE(sc.type == false);
    REQUIRE(std::string(sc.str) == "hello");
    const Const nc = pool.get(nid);
    REQUIRE(nc.type == true);
    REQUIRE(nc.num == 2.5);
}

TEST_CASE("const pool: get unknown id safe", "[model]")
{
    ConstPool pool;
    const Const c = pool.get(999);   //未知id:不崩溃、不污染池
    REQUIRE(c.type == false);
    REQUIRE(c.num == 0);
    REQUIRE(c.str.empty());
    const int id = pool.link(std::string("x"));
    REQUIRE(pool.link(std::string("x")) == id);
}

TEST_CASE("const pool: concurrent link dedup, reclaim and re-link", "[model]")
{
    //无锁池的 CAS 认领 / CLAIM 自旋 / 墓碑复用 / 代际校验**只有真并发才会走到**,所以这里多线程硬打。
    //断言的三条不变量(线程内只记失败,断言留给主线程 —— Catch2 断言宏不是线程安全的):
    //  1) 同一窗口内同一个值,任何线程拿到的 id 必须一致(全局去重);
    //  2) link 之后立刻 get 必须取回原值(自己那份引用还在,不可能被回收);
    //  3) 所有引用都 delete 掉再 gc 之后,旧 id 必须失效(墓碑),且旧 id 绝不能读到复用后的新值。
    ConstPool pool;
    constexpr int THREADS=8, VALUES=64, ROUNDS=200;
    constexpr double BASE=1000.0;
    std::barrier sync(THREADS);
    std::vector<std::vector<int>> got(THREADS, std::vector<int>(VALUES, -1));
    std::atomic<int> bad{0};
    std::vector<std::thread> ts;
    ts.reserve(THREADS);
    for (int t=0;t<THREADS;t++)
    {
        ts.emplace_back([&,t]{
            for (int round=0;round<ROUNDS;round++)
            {
                int* mine=got[t].data();
                for (int v=0;v<VALUES;v++)
                {
                    const double val=BASE+round*VALUES+v;
                    const int id=pool.link(val);
                    mine[v]=id;
                    if (!pool.is_pool(id)) bad.fetch_add(1);
                    if (pool.get(id).num!=val) bad.fetch_add(1);
                }
                sync.arrive_and_wait();          //① 全部 link 完,互相可见
                if (t==0)                        //② 同一窗口内必须全局去重
                    for (int tt=1;tt<THREADS;tt++)
                        for (int v=0;v<VALUES;v++)
                            if (got[tt][v]!=got[0][v]) bad.fetch_add(1);
                sync.arrive_and_wait();
                for (int v=0;v<VALUES;v++)       //③ 各自释放自己那份引用
                    pool.delete_(mine[v]);
                sync.arrive_and_wait();
                if (t==0) pool.gc();             //④ 计数归零 → 标墓碑
                sync.arrive_and_wait();
                if (t==0)                        //⑤ 墓碑后旧 id 必须失效
                    for (int v=0;v<VALUES;v++)
                    {
                        const int old=got[0][v];
                        if (pool.is_pool(old)) bad.fetch_add(1);
                        if (pool.get(old).num!=0.0) bad.fetch_add(1);   //墓碑 → 空 Const(num=0)
                    }
            }
        });
    }
    for (auto& th:ts) th.join();
    REQUIRE(bad.load()==0);
    //收尾:再 link 一遍必须仍然全局一致(此刻槽是复用过的,走的是"墓碑 + 新代"路径)
    std::vector<int> a(VALUES), b(VALUES);
    for (int v=0;v<VALUES;v++) a[v]=pool.link(9999.0+v);
    for (int v=0;v<VALUES;v++) b[v]=pool.link(9999.0+v);
    for (int v=0;v<VALUES;v++) REQUIRE(a[v]==b[v]);
}

TEST_CASE("const pool: concurrent string link dedup and reclaim", "[model]")
{
    //字符串走的是"hash + 内容比较 + 不可变本体指针"那条路(与数字同构),同样用屏障对齐硬打:
    //  1) 同窗口同字符串,任何线程拿到的 id 必须一致(去重);
    //  2) link 之后 get 的**内容**必须正确(本体指针/视图这条链不能错);
    //  3) 删净后旧 id 失效;重新 link 仍然全局一致。
    ConstPool pool;
    constexpr int THREADS=8, VALUES=32, ROUNDS=100;
    std::barrier sync(THREADS);
    std::vector<std::vector<int>> got(THREADS, std::vector<int>(VALUES, -1));
    std::atomic<int> bad{0};
    std::vector<std::thread> ts;
    ts.reserve(THREADS);
    for (int t=0;t<THREADS;t++)
    {
        ts.emplace_back([&,t]{
            for (int round=0;round<ROUNDS;round++)
            {
                int* mine=got[t].data();
                for (int v=0;v<VALUES;v++)
                {
                    const std::string s="s_"+std::to_string(round*VALUES+v);
                    const int id=pool.link(s);
                    mine[v]=id;
                    if (!pool.is_pool(id)) bad.fetch_add(1);
                    if (pool.get(id).str!=std::string_view(s)) bad.fetch_add(1);
                }
                sync.arrive_and_wait();
                if (t==0)
                    for (int tt=1;tt<THREADS;tt++)
                        for (int v=0;v<VALUES;v++)
                            if (got[tt][v]!=got[0][v]) bad.fetch_add(1);
                sync.arrive_and_wait();
                for (int v=0;v<VALUES;v++) pool.delete_(mine[v]);
                sync.arrive_and_wait();
                if (t==0) pool.gc();          //字符串本体是延迟释放的,这里顺带压 gc
                sync.arrive_and_wait();
                if (t==0)
                    for (int v=0;v<VALUES;v++)
                        if (pool.is_pool(got[0][v])) bad.fetch_add(1);
            }
        });
    }
    for (auto& th:ts) th.join();
    REQUIRE(bad.load()==0);
}

TEST_CASE("var pool: concurrent offset writes to distinct keys", "[model]")
{
    //offset 现在是扁平无锁表((对象,键) → 槽)。多线程往同一个对象里写**互不相同的键**必须全部成功,
    //且每个键都能被别的线程读到 —— 这是"容器并行填充/并行读"的最小要求。
    VarPool pool;
    constexpr int THREADS=8, KEYS=256;
    constexpr int OBJ=12345;          //对象 id(自引用句柄语义,随便一个整数即可)
    std::barrier sync(THREADS);
    std::atomic<int> bad{0};
    std::vector<std::thread> ts;
    ts.reserve(THREADS);
    for (int t=0;t<THREADS;t++)
    {
        ts.emplace_back([&,t]{
            for (int k=0;k<KEYS;k++)
            {
                const int key=t*KEYS+k;
                VarPool::unsafeWriteOffset(&pool,OBJ,key,key*7+1);
            }
            sync.arrive_and_wait();
            for (int tt=0;tt<THREADS;tt++)
                for (int k=0;k<KEYS;k++)
                {
                    const int key=tt*KEYS+k;
                    if (!pool.hasOffset(OBJ,key)) { bad.fetch_add(1); continue; }
                    if (VarPool::unsafeReadOffset(&pool,OBJ,key)!=key*7+1) bad.fetch_add(1);
                }
        });
    }
    for (auto& th:ts) th.join();
    REQUIRE(bad.load()==0);
    //就地更新(已有的键再写一次必须覆盖,不能插出第二个条目)
    VarPool::unsafeWriteOffset(&pool,OBJ,7,999);
    REQUIRE(VarPool::unsafeReadOffset(&pool,OBJ,7)==999);
    REQUIRE(pool.hasOffset(OBJ,7));
    REQUIRE_FALSE(pool.hasOffset(OBJ,THREADS*KEYS+12345));   //不存在的键必须是 false
}
TEST_CASE("var pool: init loads const pool", "[model]")
{
    VarPool pool;
    std::unordered_map<int, double> num{{10, 3.14}};
    std::unordered_map<int, std::string> str{{20, "s"}};
    pool.init(num, str);
    const Const n = pool.data.get(10);
    REQUIRE(n.type == true);
    REQUIRE(n.num == 3.14);
    const Const s = pool.data.get(20);
    REQUIRE(s.type == false);
    REQUIRE(std::string(s.str) == "s");
}
