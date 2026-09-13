#ifndef SLANG_RUNTIME_H
#define SLANG_RUNTIME_H
#include <algorithm>
#include <atomic>
#include <condition_variable>
#include <cstdlib>
#include <deque>
#include <iostream>
#include <stdexcept>
#include <string>
#include "../model.h"
#include "../utils.h"
class Runtime;
class Manage;
using Command=std::unordered_map<int,std::vector<std::array<int,4>>>;
using ValueSet=void(*)(VarPool*,int,int);
using OffSet=void(*)(VarPool*,int,int,int);
using NameSet=void(*)(VarPool*,int,const std::string&,int);
using Join=void(*)(Manage*,int);
using CommandRun=void(*)(Runtime*,int,int,int);
//【热路径优化】opcode 直查表:此前每条指令都要 unordered_map::find(≈65ns),
//现在数组下标直取(≈1ns)。未注册项为 nullptr → 报"未知操作码"。
using RunTable=std::vector<CommandRun>;
constexpr int OPCODE_MAX=256;
using Runner=void(*)(Runtime*,std::array<int,4>);
using PoolValue=void(*)(VarPool*,int,int);
using PoolOffset=void(*)(VarPool*,int,int,int);
using PoolName=void(*)(VarPool*,int,const std::string&,int);
std::unordered_map<int,CommandRun> basic();
std::unordered_map<int,CommandRun> math();
std::unordered_map<int,CommandRun> io();
//源解析:reg=原样值(槽号/地址/字面量,编译器 mov reg 源即此语义);value=var[x](槽内pool_id)
//注:常量加载由 load 特例(reg=池id原样)承担,故 reg 源不需要池反查
inline int src(VarPool* data, const int form, const int x)
{
    return form ? VarPool::unsafeReadVar(data, x) : x;
}
inline int pv(VarPool* data, const int form, const int x)
{
    return form ? static_cast<int>(data->data.get(VarPool::unsafeReadVar(data, x)).num) : x;
}
//目标槽:reg=x原样;value=var[x](解引用写,编译器 mov value X value Y 语义:var[var[X]]=...)
inline int dst(VarPool* data, const int form, const int x)
{
    return form ? VarPool::unsafeReadVar(data, x) : x;
}
inline int key(VarPool* data, const int form, const int x)
{
    return form ? VarPool::unsafeReadVar(data, x) : x;
}
inline TaskCond valueCond(const int v)
{
    return {.id = v,.prefix = false,.offset = 0,.name = ""};
}
inline TaskCond offsetCond(const int v, const int o)
{
    return {.id = v,.prefix = true,.offset = o,.name = ""};
}
inline TaskCond nameCond(const int v,const std::string& n)
{
    //offset==-1 才是 name 访问(model.h cond()/run() 判定),之前误设 0 会走 offset 分支
    return {.id = v,.prefix = true,.offset = -1,.name = n};
}
class Runtime:public Thread
{
public:
    std::vector<std::string>* args;
    VarPool* pool = nullptr;
    //跨线程读写(运行线程写、supervisor 在 Manage::start/gc 里读),必须是原子量:
    //裸 bool 是 data race(UB),可能读到陈旧值
    std::atomic<bool> alive{true};
    Command* command=nullptr;
    int* thread=nullptr;
    Stack<int> blockStack;
    Stack<int> indexStack;
    Stack<int> stack;
    Runner* runner=nullptr;
    std::unordered_map<int,int> param;
    Join _join;
    Manage* m;
    int io_result = -1;
    bool io_wait_recv = false;
    int io_net_id = -1;
    const RunTable* _run=nullptr;
    std::vector<int> io_array;
    int block;
    int index=0;
    void run()override{
        //const 引用取块:at() 只读访问。多线程并发执行同一函数块时,非 const operator[]
        //是数据竞争(实测两个线程同调一函数 stl_vector 越界崩溃)
        const Command& cmds=*command;
        //【热路径优化】缓存"当前块"的指令数组指针:此前每条指令都要 cmds.at(block)(哈希+边界)
        //只有 block 变化时(跳转/弹帧/调用)才重新取一次。map 构造后不再修改,指针稳定。
        const std::vector<std::array<int,4>>* code=nullptr;
        int cached_block=-1;
        while (true)
        {
            if (!alive)break;
            if (block!=cached_block)
            {
                code=&cmds.at(block);
                cached_block=block;
            }
            //越界即块执行完毕:有帧则弹帧继续(cz 跳空块/自然走完的块),无帧才结束
            if (index >= static_cast<int>(code->size()))
            {
                if (blockStack.size() > 0)
                {
                    const int ret_idx = indexStack.pop();
                    const int ret_blk = indexStack.pop();
                    blockStack.pop();
                    block = ret_blk;
                    index = ret_idx;   //continue 跳过 index++,直接指向帧下一条
                    continue;
                }
                alive=false;
                break;
            }
            (*runner)(this,(*code)[index]);
            index++;
        }
    }
};
inline void r(Runtime* runtime,std::array<int,4> c)
{
    //数组下标直查(热路径),省掉每条指令一次 unordered_map::find
    const RunTable& run_map=*runtime->_run;
    if (c[0]<0||c[0]>=OPCODE_MAX||!run_map[c[0]])
        throw std::runtime_error("未知操作码 "+std::to_string(c[0]));
    run_map[c[0]](runtime, c[1], c[2], c[3]);
}
class Manage
{
    std::vector<std::unique_ptr<Runtime>> thread;
    int thread_num;
    VarPool pool;
    ValueSet value;
    OffSet offset;
    NameSet name;
    Command command;
    uint64_t M;
    uint64_t Old_M;
    Runner runner;
    RunTable _run;
    //thread 数组互斥:join(子线程 push_back)与 start 遍历/gc erase 并发,vector 竞争会崩溃
    std::mutex tmtx;
    //===== 任务队列模式(实验,环境变量 SLANG_TASKS=1 开启)=====
    //思路:thread/tz 不再每个都创建原生线程(≈30–50µs/个),而是把"要跑的块"作为任务
    //放进队列,由固定数量的工作线程取出后跑完(复用线程,任务入队≈百 ns 级)。
    bool task_mode=false;
    std::deque<int> task_queue;
    std::mutex qmtx;
    std::condition_variable qcv;
    std::atomic<int> pending{0};        //未完成任务数(排队 + 正在执行)
    std::vector<std::thread> workers;
    std::atomic<bool> stop_workers{false};
    int worker_num=0;
    //supervisor 轮询间隔(ms):任务模式默认 100、原生模式默认 1000;可用 SLANG_POLL_MS 统一覆盖(便于 A/B 公平对比)
    int poll_ms=1000;
public:
    std::vector<std::string> args;
    NetRuntime net;
    Manage(const std::unordered_map<int,double>& num, const std::unordered_map<int,std::string>& str,
        const Command& c,const Runner& r,const std::vector<std::string>& a)
    {
        args=a;
        thread_num=1;
        pool.init(num, str);
        //槽表定容:扫一遍指令流取最大操作数。编译器槽号是全局唯一连续小整数,故数组下标可直取;
        //必须在任何 Runtime 起动**之前**做完(此后 arr_n 只读,不存在扩容竞态)。
        //操作数可能只是用户写的一个巨大字面量(2^31-1 之类),故用 long long 累计,交给 init_slots 夹上界。
        {
            long long max_operand=0;
            for (const auto& [blk,code]:c)
                for (const auto& ins:code)
                    for (int i=0;i<4;i++)
                        if (ins[i]>max_operand) max_operand=ins[i];
            pool.init_slots(max_operand+1);
        }
        command=c;
        value=VarPool::unsafeWriteVar;
        offset=VarPool::unsafeWriteOffset;
        name=VarPool::unsafeWriteName;
        _run.assign(OPCODE_MAX,nullptr);
        auto put=[&](const std::unordered_map<int,CommandRun>& m)
        {
            for (auto [k,v]:m)
                if (k>=0&&k<OPCODE_MAX)_run[k]=v;
        };
        put(basic());
        put(io());
        put(math());
        thread.push_back(std::make_unique<Runtime>());
        thread[0]->pool=&pool;
        thread[0]->thread=&thread_num;
        thread[0]->command=&command;
        thread[0]->_join=&join;
        thread[0]->m=this;
        thread[0]->runner=&runner;
        thread[0]->_run=&_run;
        thread[0]->args=&args;
        runner=r;
        Old_M=Memory();
        M=Memory();
        //任务队列模式:**默认开启**。原生 thread/tz 每个任务要起一个原生线程并 join(实测 ≈47–85µs/任务、
        //线程创建本身 ≈30–40µs),队列模式把"要跑的块"丢给固定工作线程池(实测 ≈1.5–3µs/任务,且不随任务数上升)。
        //需要退回原生线程语义时设 SLANG_TASKS=0。
        task_mode=true;
        if (const char* v=std::getenv("SLANG_TASKS");v&&std::string(v)=="0")
            task_mode=false;
        if (const char* v=std::getenv("SLANG_TASKS_THREADS");v&&task_mode)
        {
            worker_num=std::atoi(v);
            if (worker_num<1)worker_num=1;
            if (worker_num>64)worker_num=64;
        }
        if (task_mode&&worker_num<=0)
        {
            worker_num=static_cast<int>(std::thread::hardware_concurrency());
            if (worker_num<1)worker_num=1;
            if (worker_num>32)worker_num=32;
        }
        if (task_mode) poll_ms=100;
        if (const char* v=std::getenv("SLANG_POLL_MS"))
        {
            poll_ms=std::atoi(v);
            if (poll_ms<1)poll_ms=1;
        }
    }
    void gc()
    {
        pool.data.gc();
        //锁内取出死线程并从容器移除;join 在锁外等待(避免持锁阻塞并发 join)
        //修复(C-01):此前先 for 循环把死线程 unique_ptr move 进 dead(源槽位变 nullptr),
        //紧接着的 remove_if 谓词又对同一 vector 解引用 t->alive → 空指针访问 → 0xC0000005。
        //现在把“判空 + 搬移 + 删除”放在同一次 erase 的谓词里完成。
        std::vector<std::unique_ptr<Runtime>> dead;
        {
            std::lock_guard<std::mutex> lock(tmtx);
            thread.erase(std::remove_if(thread.begin(),thread.end(),
                [&](std::unique_ptr<Runtime>& t){
                    if (!t||t->alive) return false;
                    dead.push_back(std::move(t));
                    return true;
                }),thread.end());
        }
        for (auto& t:dead)
            if (t) t->join();
    }
    void start()
    {
        //工作线程池懒启动(见 ensure_workers):没有任何 thread/tz 的程序一个线程都不建
        thread[0]->block=0;
        thread[0]->start();
        while (true)
        {
            M=Memory();
            if (M>=15*Old_M/10)gc();
            Old_M=M;
            //所有 Runtime 均结束(alive=false)即程序结束;遍历与 join 的 push_back 并发,需加锁
            bool running=false;
            {
                std::lock_guard<std::mutex> lock(tmtx);
                for (const auto& t:thread)
                    if (t->alive){ running=true; break; }
            }
            //任务模式下还要等队列排空(pending>0)
            if (!running&&pending.load()==0) break;
            std::this_thread::sleep_for(std::chrono::milliseconds(poll_ms));
        }
        if (task_mode) stop_worker_pool();
    }
    ~Manage(){
        if (task_mode) stop_worker_pool();
        for (auto& t:thread)
            t->join();
    }
    //===== 任务队列模式实现 =====
    //工作线程池**懒启动**:只有真的出现 thread/tz 才建线程池。
    //这样单线程程序(绝大多数)不为线程池付任何启动成本,但一旦要用就复用线程。
    void ensure_workers()
    {
        std::lock_guard<std::mutex> lock(qmtx);
        if (!workers.empty()) return;
        stop_workers.store(false);
        workers.reserve(worker_num);
        for (int i=0;i<worker_num;i++)
            workers.emplace_back([this]{worker_loop();});
    }
    void stop_worker_pool()
    {
        {
            std::lock_guard<std::mutex> lock(qmtx);
            stop_workers.store(true);
        }
        qcv.notify_all();
        for (auto& w:workers)
            if (w.joinable()) w.join();
        workers.clear();
    }
    //任务入队:拷贝一个块 id + 计数,≈百 ns 级(对比每个 thread 起原生线程 ≈30–50µs)
    void enqueue(const int block)
    {
        ensure_workers();
        {
            std::lock_guard<std::mutex> lock(qmtx);
            task_queue.push_back(block);
        }
        pending.fetch_add(1,std::memory_order_release);
        qcv.notify_one();
    }
    void worker_loop()
    {
        while (true)
        {
            int block=-1;
            {
                std::unique_lock<std::mutex> lock(qmtx);
                qcv.wait(lock,[this]{return stop_workers.load()||!task_queue.empty();});
                if (task_queue.empty())
                {
                    if (stop_workers.load()) return;
                    continue;
                }
                block=task_queue.front();
                task_queue.pop_front();
            }
            //每个任务用一个临时 Runtime 跑到底:复用工作线程,无需 join/销毁原生线程
            try
            {
                Runtime rt;
                rt.pool=&pool;
                rt.thread=&thread_num;
                rt.command=&command;
                rt.block=block;
                rt.index=0;
                rt.alive=true;
                rt.m=this;
                rt.runner=&runner;
                rt._run=&_run;
                rt._join=&join;
                rt.args=&args;
                rt.run();
            }
            catch (const std::exception& e)
            {
                std::cerr<<"error: "<<e.what()<<std::endl;
            }
            catch (...)
            {
                //非 std 异常也必须让 pending 归零,否则 supervisor 会永久等下去
                std::cerr<<"error: 未知异常"<<std::endl;
            }
            pending.fetch_sub(1,std::memory_order_release);
        }
    }
    static void join(Manage* m,const int block)
    {
        //任务模式:入队由工作线程池执行(不创建原生线程)
        if (m->task_mode)
        {
            m->enqueue(block);
            return;
        }
        auto t=std::make_unique<Runtime>();
        t->pool=&m->pool;
        t->thread=&m->thread_num;
        t->command=&m->command;
        t->block=block;
        t->index=0;
        t->alive=true;
        t->m=m;
        t->runner=&m->runner;
        t->_run=&m->_run;
        t->_join=&join;
        t->args=&m->args;
        Runtime* rt;
        {
            std::lock_guard lock(m->tmtx);
            m->thread.push_back(std::move(t));
            rt=m->thread.back().get();
        }
        rt->start();
    }
};
#endif



