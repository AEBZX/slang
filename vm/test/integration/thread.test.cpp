//并发探测:多个线程同时调用同一函数块(thread 指令路径)
//关注点:1)Manage::join 的 thread 数组并发 push_back 是否崩溃(vector 竞争)
//        2)共享槽(编译器槽号全局)并发读写是否导致结果错乱(不崩但错)
//测试名一律 ASCII
#include "main.h"
#include <catch2/catch_test_macros.hpp>
#include <atomic>
#include <thread>

namespace {
//函数块:add(a,b)=a+b
//param_load[1,1] param_load[2,2] add[3,1,2] param_set[0,3] retn
//槽1/2/3 全局共享,两个线程并发执行同一块会互相覆盖(预期数值错乱,重点观察是否崩溃)
Command build_add_block(){
    Command cmds;
    cmds[0]={{169,0,0,0}};      //入口块:直接返回
    cmds[1]={
        {163,1,1,0},   //param_load var[1]=param[1]
        {163,2,2,0},   //param_load var[2]=param[2]
        {7,3,1,2},     //add var[3]=var[1]+var[2]
        {159,0,3,0},   //param_set param[0]=var[3]
        {169,0,0,0}    //retn
    };
    return cmds;
}
std::unordered_map<int,CommandRun> all_runs(){
    std::unordered_map<int,CommandRun> _run;
    for(auto [k,v]:basic())_run[k]=v;
    for(auto [k,v]:io())_run[k]=v;
    for(auto [k,v]:math())_run[k]=v;
    return _run;
}
//两个 Runtime 共享 pool/command/_run,并发执行块1(参数 a,b),结果写 out
struct SharedRunner{
    VarPool pool;
    Command cmds;
    std::unordered_map<int,CommandRun> _run;
    Runner runner;
    explicit SharedRunner(Command c):cmds(std::move(c)),_run(all_runs()),runner(r){}
    void run(const int a,const int b,int* out,std::atomic<bool>* go){
        while(!go->load()){}
        Runtime rt;
        rt.pool=&pool;
        rt.command=&cmds;
        rt.block=1;
        rt.index=0;
        rt.alive=true;
        rt.runner=&runner;
        rt._run=&_run;
        rt.param[1]=a;
        rt.param[2]=b;
        rt.run();
        *out=rt.param[0];
    }
};
}

//并发 join:两个线程同时 THREAD/join 同一块,验证 thread 数组并发修改不崩溃
TEST_CASE("thread: 并发 join 同一块不崩溃(thread 数组竞争)", "[thread]")
{
    for(int round=0;round<200;round++){
        Command cmds=build_add_block();
        Manage m(std::unordered_map<int,double>{},std::unordered_map<int,std::string>{},cmds,r);
        std::atomic<bool> go=false;
        std::thread a([&]{
            while(!go.load()){}
            for(int i=0;i<5;i++)m.join(&m,1);
        });
        std::thread b([&]{
            while(!go.load()){}
            for(int i=0;i<5;i++)m.join(&m,1);
        });
        go=true;
        a.join();
        b.join();
    }
}

//并发执行同一函数块:槽共享导致结果错乱,但不崩溃;数值必须是参数组合之一
TEST_CASE("thread: 两线程共享槽并发执行同一函数块", "[thread]")
{
    SharedRunner sr(build_add_block());
    for(int round=0;round<500;round++){
        int out_a=0,out_b=0;
        std::atomic<bool> go=false;
        std::thread ta([&]{sr.run(1,2,&out_a,&go);});
        std::thread tb([&]{sr.run(3,4,&out_b,&go);});
        go=true;
        ta.join();
        tb.join();
        //参数组合:1+2=3,3+4=7,交叉 1+4=5,3+2=5;槽覆盖后两者可能相同
        const bool a_ok=(out_a==3||out_a==5||out_a==7);
        const bool b_ok=(out_b==3||out_b==5||out_b==7);
        REQUIRE(a_ok);
        REQUIRE(b_ok);
    }
}
