#ifndef SLANG_RUNTIME_H
#define SLANG_RUNTIME_H
#include <algorithm>
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
    bool alive=true;
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
    std::unordered_map<int,CommandRun>* _run;
    std::vector<int> io_array;
    int block;
    int index=0;
    void run()override{
        //const 引用取块:at() 只读访问。多线程并发执行同一函数块时,非 const operator[]
        //是数据竞争(实测两个线程同调一函数 stl_vector 越界崩溃)
        const Command& cmds=*command;
        while (true)
        {
            if (!alive)break;
            //越界即块执行完毕:有帧则弹帧继续(cz 跳空块/自然走完的块),无帧才结束
            if (index >= static_cast<int>(cmds.at(block).size()))
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
            (*runner)(this,cmds.at(block)[index]);
            index++;
        }
    }
};
inline void r(Runtime* runtime,std::array<int,4> c)
{
    //at() 只读:多线程并发取指令时非 const operator[] 是数据竞争
    const auto& run_map=*runtime->_run;
    run_map.at(c[0])(runtime, c[1], c[2], c[3]);
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
    std::unordered_map<int,CommandRun> _run;
    //thread 数组互斥:join(子线程 push_back)与 start 遍历/gc erase 并发,vector 竞争会崩溃
    std::mutex tmtx;
public:
    std::vector<std::string> args;
    NetRuntime net;
    Manage(const std::unordered_map<int,double>& num, const std::unordered_map<int,std::string>& str,
        const Command& c,const Runner& r,const std::vector<std::string>& a)
    {
        args=a;
        thread_num=1;
        pool.init(num, str);
        command=c;
        value=VarPool::unsafeWriteVar;
        offset=VarPool::unsafeWriteOffset;
        name=VarPool::unsafeWriteName;
        for (auto [k,v]:basic())
            _run[k]=v;
        for (auto [k,v]:io())
            _run[k]=v;
        for (auto [k,v]:math())
            _run[k]=v;
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
    }
    void gc()
    {
        pool.data.gc();
        //锁内取出死线程并从容器移除;join 在锁外等待(避免持锁阻塞并发 join)
        std::vector<std::unique_ptr<Runtime>> dead;
        {
            std::lock_guard<std::mutex> lock(tmtx);
            for (auto& t:thread)
                if (!t->alive)
                    dead.push_back(std::move(t));
            thread.erase(std::remove_if(thread.begin(),thread.end(),
                [](std::unique_ptr<Runtime>& t){return !t->alive;}),thread.end());
        }
        for (auto& t:dead)
            t->join();
    }
    void start()
    {
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
            if (!running) break;
            std::this_thread::sleep_for(std::chrono::milliseconds(1000));
        }
    }
    ~Manage(){
        for (auto& t:thread)
            t->join();
    }
    static void join(Manage* m,const int block)
    {
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