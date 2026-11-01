//单元测试:常量池的 id 分配与引用计数(runtime::ConstPool)
#include <catch2/catch_all.hpp>

#include <atomic>
#include <chrono>
#include <set>
#include <thread>
#include <vector>

#include "../../main.h"

namespace
{
    template <class Pred>
    bool wait_until(Pred pred, int ms = 5000)
    {
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(ms);
        while (std::chrono::steady_clock::now() < deadline)
        {
            if (pred())
                return true;
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
        return pred();
    }

    runtime::ConstPool make_pool()
    {
        return runtime::ConstPool(
            std::unordered_map<int, std::string>{{1, "one"}, {2, "two"}},
            std::unordered_map<int, double>{{3, 3.5}, {4, 4.5}});
    }
}

TEST_CASE("runtime-pool 构造后正反表都填好", "[runtime]")
{
    auto pool = make_pool();
    REQUIRE(pool.number_pool.size() == 2);
    REQUIRE(pool.string_pool.size() == 2);
    REQUIRE(pool.number_pool.at(3) == 3.5);
    REQUIRE(pool.number_pool_rev.at(3.5) == 3);
    REQUIRE(pool.string_pool.at(1) == "one");
    REQUIRE(pool.string_pool_rev.at(std::string_view("one")) == 1);
}

TEST_CASE("runtime-pool id_number 同一个数永远给同一个 id", "[runtime]")
{
    auto pool = make_pool();
    const int a = pool.id_number(1.5);
    const int b = pool.id_number(1.5);
    REQUIRE(a == b);
    REQUIRE(pool.number_pool.at(a) == 1.5);
    REQUIRE(pool.number_pool_rev.at(1.5) == a);
}

TEST_CASE("runtime-pool id_string 同一个串永远给同一个 id", "[runtime]")
{
    auto pool = make_pool();
    const int a = pool.id_string("hello");
    const int b = pool.id_string("hello");
    REQUIRE(a == b);
    REQUIRE(pool.string_pool.at(a) == "hello");
}

TEST_CASE("runtime-pool 新建的 id 不和已有的撞", "[runtime]")
{
    auto pool = make_pool();
    std::set<int> used{1, 2, 3, 4};
    for (int i = 0; i < 2000; ++i)
    {
        //+0.125 避开构造时预置的 3.5 / 4.5(同值本来就会复用同一个 id)
        const int id = (i % 2 == 0) ? pool.id_number(i * 0.25 + 0.125) : pool.id_string("s" + std::to_string(i));
        INFO("i=" << i << " id=" << id);
        REQUIRE_FALSE(used.count(id));
        used.insert(id);
    }
}

TEST_CASE("runtime-pool 预置值的 id 会被复用而不是新分配", "[runtime]")
{
    auto pool = make_pool();
    REQUIRE(pool.id_number(3.5) == 3);
    REQUIRE(pool.id_number(4.5) == 4);
    REQUIRE(pool.id_string("one") == 1);
    REQUIRE(pool.id_string("two") == 2);
    REQUIRE(pool.number_pool.size() == 2);
    REQUIRE(pool.string_pool.size() == 2);
}

TEST_CASE("runtime-pool link 之后引用计数变成 1", "[runtime][pool-task]")
{
    auto pool = make_pool();
    const int id = pool.id_number(9.5);
    pool.link(id);
    REQUIRE(wait_until([&] { return pool.ref_count(id) == 1; }));
    REQUIRE_FALSE(pool.pending_gc(id));
}

TEST_CASE("runtime-pool unlink 到 0 之后进入待回收表", "[runtime][pool-task]")
{
    auto pool = make_pool();
    const int id = pool.id_number(9.75);
    pool.link(id);
    REQUIRE(wait_until([&] { return pool.ref_count(id) == 1; }));
    pool.unlink(id);
    REQUIRE(wait_until([&] { return pool.pending_gc(id); }));
    REQUIRE(pool.has(id));
}

TEST_CASE("runtime-pool link 会把待回收的 id 救回来", "[runtime][pool-task]")
{
    auto pool = make_pool();
    const int id = pool.id_number(8.25);
    pool.link(id);
    REQUIRE(wait_until([&] { return pool.ref_count(id) == 1; }));
    pool.unlink(id);
    REQUIRE(wait_until([&] { return pool.pending_gc(id); }));
    pool.link(id);
    REQUIRE(wait_until([&] { return !pool.pending_gc(id); }));
    REQUIRE(wait_until([&] { return pool.ref_count(id) == 1; }));
}

TEST_CASE("runtime-pool gc 把待回收的 id 从正反表里删掉", "[runtime][pool-task]")
{
    auto pool = make_pool();
    const int num = pool.id_number(7.5);
    const int str = pool.id_string("dead");
    pool.link(num);
    pool.link(str);
    REQUIRE(wait_until([&] { return pool.ref_count(num) == 1 && pool.ref_count(str) == 1; }));
    pool.unlink(num);
    pool.unlink(str);
    REQUIRE(wait_until([&] { return pool.pending_gc(num) && pool.pending_gc(str); }));
    pool.gc();
    REQUIRE(wait_until([&] { return !pool.has(num) && !pool.has(str); }));
    REQUIRE_FALSE(pool.number_pool_rev.contains(7.5));
    REQUIRE(pool.ref_count(num) == 0);
}

TEST_CASE("runtime-pool 重复 unlink 同一个 id 不会把计数压成负数", "[runtime][pool-task]")
{
    auto pool = make_pool();
    const int id = pool.id_number(6.5);
    pool.link(id);
    REQUIRE(wait_until([&] { return pool.ref_count(id) == 1; }));
    pool.unlink(id);
    pool.unlink(id);
    REQUIRE(wait_until([&] { return pool.pending_gc(id); }));
    //已经进了待回收表,再 unlink 不应继续减
    REQUIRE(pool.ref_count(id) >= 0);
}

TEST_CASE("runtime-pool 有任务在排队时 stop 能返回", "[runtime][pool-task]")
{
    auto pool = make_pool();
    pool.id_number(5.5);
    pool.link(1);
    //stop 不能因为"这一批没人跑"而永久卡住
    pool.stop();
    REQUIRE(true);
}
