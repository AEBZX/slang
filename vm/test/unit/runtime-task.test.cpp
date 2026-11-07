//单元测试:步任务表的复用、自动 gc 与同一运行时的步任务串行
#include <catch2/catch_all.hpp>

#include <chrono>
#include <functional>
#include <string>
#include <thread>
#include <unordered_map>

#include "../helper.h"

using vm_test::init;

namespace
{
    bool wait_until(const std::function<bool()>& pred)
    {
        for (int i=0;i<2000;i++)
        {
            if (pred())return true;
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
        return pred();
    }

    //在块 0 末尾追加 n 条 add r10=1+1
    void add_n(sbin::commands& commands,const int n)
    {
        for (int i=0;i<n;i++)
            commands[0].emplace_back(16,data::three_key<int,int,int>(10,1,1));
    }
}

TEST_CASE("runtime-task 同一运行时只保留一条步任务", "[runtime][task]")
{
    init();
    vm_test::Machine m;
    m.manage.malloc(0,0,nullptr);
    REQUIRE(m.manage.task.size()==1);
    //已经有步任务在等/在跑时,再排同一条运行时的步任务会被丢掉
    m.manage.schedule(0);
    m.manage.schedule(0);
    REQUIRE(m.manage.task.size()==1);
}

TEST_CASE("runtime-task 队列过大时自动 gc 回收已完成项", "[runtime][task]")
{
    init();
    sbin::commands commands;
    add_n(commands,10000);
    std::unordered_map<int,std::string> strings;
    std::unordered_map<int,double> numbers;
    runtime::Manage manage(strings,numbers,std::move(commands),32);
    manage.start();
    REQUIRE(manage.pool.number(manage.reg.at(10).bind)==2);
    //没有自动 gc 的话 10000 条指令会留下 10000 条已完成任务
    REQUIRE(manage.task.size()<10000);
}

TEST_CASE("runtime-task gc 缩表后从头扫,后面的指令照样执行", "[runtime][task]")
{
    init();
    sbin::commands commands;
    add_n(commands,20);
    commands[0].emplace_back(32*8,data::three_key<int,int,int>(0,0,0)); //gc
    add_n(commands,100);
    std::unordered_map<int,std::string> strings;
    std::unordered_map<int,double> numbers;
    runtime::Manage manage(strings,numbers,std::move(commands),32);
    manage.start();
    REQUIRE(manage.pool.number(manage.reg.at(10).bind)==2);
    //gc 之后还有 100 条指令,游标没归零就会漏掉它们
    REQUIRE(manage.task.size()<200);
}

TEST_CASE("runtime-task 池过大时自动 gc 回收待回收项", "[runtime][task]")
{
    init();
    sbin::commands commands;
    add_n(commands,1);
    std::unordered_map<int,std::string> strings;
    std::unordered_map<int,double> numbers;
    runtime::Manage manage(strings,numbers,std::move(commands),128);
    const int victim=manage.pool.id_string("victim");
    manage.pool.link(victim);
    REQUIRE(wait_until([&] { return manage.pool.ref_count(victim)==1; }));
    manage.pool.unlink(victim);
    REQUIRE(wait_until([&] { return manage.pool.pending_gc(victim); }));
    //把池子推过阈值:不用显式 gc 指令,start 也应该排一次清理
    for (int i=0;i<4100;i++)manage.pool.id_string("s"+std::to_string(i));
    manage.start();
    REQUIRE(manage.pool.number(manage.reg.at(10).bind)==2);
    REQUIRE_FALSE(manage.pool.has(victim));
}
