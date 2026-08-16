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
inline int src(VarPool* data, const int form, const int x)
{
    return form ? VarPool::unsafeReadVar(data, x) : data->data.link((double)x);
}
inline int pv(VarPool* data, const int form, const int x)
{
    return form ? static_cast<int>(data->data.get(VarPool::unsafeReadVar(data, x)).num) : x;
}
inline int dst(VarPool* data, const int form, const int x)
{
    return form ? data->data.link((double)x) : x;
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
    VarPool* pool = nullptr;
    bool alive=true;
    Command* command=nullptr;
    int* thread=nullptr;
    Stack<bool> blockStack;
    Stack<int> indexStack;
    Stack<int> stack;
    Runner* runner=nullptr;
    std::unordered_map<int,int> param;
    Join _join;
    Manage* m;
    int block;
    int index=0;
    void run()override{
        while (true)
        {
            if (!alive)break;
            //command 是指针,须先解引用再按块/下标取指令(原 command[block][index] 是指针数组下标,语义错误)
            if (index >= static_cast<int>((*command)[block].size()))alive=false;
            (*runner)(this,(*command)[block][index]);
            index++;
        }
    }
};
class Manage
{
    std::vector<Runtime> thread;
    int thread_num;
    VarPool pool;
    ValueSet value;
    OffSet offset;
    NameSet name;
    Command command;
    uint64_t M;
    uint64_t Old_M;
    Runner runner;
public:
    Manage(const std::unordered_map<int,double>& num, const std::unordered_map<int,std::string>& str,
        const Command& c,const Runner& r)
    {
        thread_num=1;
        //先扩容再访问,原代码空 vector 直接 thread[0] 是越界UB
        thread.resize(1);
        pool.init(num, str);
        command=c;
        value=VarPool::unsafeWriteVar;
        offset=VarPool::unsafeWriteOffset;
        name=VarPool::unsafeWriteName;
        thread[0].pool=&pool;
        thread[0].thread=&thread_num;
        thread[0].command=&command;
        thread[0]._join=&join;
        thread[0].m=this;
        thread[0].runner=&runner;
        runner=r;
        Old_M=Memory();
        M=Memory();
    }
    void gc()
    {
        pool.data.gc();
        thread.erase(std::remove_if(thread.begin(), thread.end(), [](Runtime& t)
       {
           if (t.alive) return false;
           t.join();
           return true;
       }), thread.end());
    }
    void start()
    {
        thread[0].block=0;
        thread[0].start();
        while (true)
        {
            M=Memory();
            if (M>=15*Old_M/10)gc();
            Old_M=M;
            std::this_thread::sleep_for(std::chrono::milliseconds(1000));
        }
    }
    static void join(Manage* m,const int block)
    {
        m->thread[m->thread.size()-1].pool=&m->pool;
        m->thread[m->thread.size()-1].thread=&m->thread_num;
        m->thread[m->thread.size()-1].command=&m->command;
        m->thread[m->thread.size()-1].block=block;
        m->thread[m->thread.size()-1].m=m;
        m->thread[m->thread.size()-1].runner=&m->runner;
        m->thread[m->thread.size()-1].run();
    }
};
#endif