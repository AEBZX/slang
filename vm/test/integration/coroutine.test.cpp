//集成测试:协程模型整体(调度器 + 常量池 + 多 worker + 关闭)
#include <catch2/catch_all.hpp>

#include <atomic>
#include <chrono>
#include <thread>
#include <vector>

#include "../../main.h"

namespace
{
    template <class Pred>
    bool wait_until(Pred pred, int ms = 10000)
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

    //累加型协程:每次 yield 前给计数加 1
    data::Coro counter_coro(data::Scheduler& s, std::atomic<int>& total, std::atomic<int>& off_worker, int rounds)
    {
        for (int i = 0; i < rounds; ++i)
        {
            if (data::g_current_worker < 0)
                ++off_worker;
            ++total;
            co_await s.yield();
        }
    }

    //嵌套提交:协程里再 spawn 一个协程
    data::Coro nested_coro(data::Scheduler& s, std::atomic<int>& total, std::atomic<int>& off_worker)
    {
        ++total;
        s.submit(counter_coro(s, total, off_worker, 2));
        co_await s.yield();
        ++total;
    }
}

TEST_CASE("coroutine 多 worker 下大量协程都推进到结束", "[coroutine][integration]")
{
    data::Scheduler s(4);
    std::atomic<int> total{0};
    std::atomic<int> off_worker{0};
    constexpr int coros = 200;
    constexpr int rounds = 3;
    for (int i = 0; i < coros; ++i)
        s.submit(counter_coro(s, total, off_worker, rounds));
    REQUIRE(wait_until([&] { return total.load() == coros * rounds; }));
    REQUIRE(total.load() == coros * rounds);
    s.shutdown();
}

TEST_CASE("coroutine 单 worker 下也能全部跑完(不会自己饿死)", "[coroutine][integration]")
{
    data::Scheduler s(1);
    std::atomic<int> total{0};
    std::atomic<int> off_worker{0};
    constexpr int coros = 50;
    constexpr int rounds = 4;
    for (int i = 0; i < coros; ++i)
        s.submit(counter_coro(s, total, off_worker, rounds));
    REQUIRE(wait_until([&] { return total.load() == coros * rounds; }));
    REQUIRE(total.load() == coros * rounds);
    s.shutdown();
}

TEST_CASE("coroutine 协程体在 worker 线程上执行", "[coroutine][integration]")
{
    data::Scheduler s(2);
    std::atomic<int> total{0};
    std::atomic<int> off_worker{0};
    s.submit(counter_coro(s, total, off_worker, 5));
    REQUIRE(wait_until([&] { return total.load() == 5; }));
    REQUIRE(off_worker.load() == 0);
    s.shutdown();
}

TEST_CASE("coroutine 协程里再提交协程也能完成", "[coroutine][integration]")
{
    data::Scheduler s(2);
    std::atomic<int> total{0};
    std::atomic<int> off{0};
    s.submit(nested_coro(s, total, off));
    //外层 2 次 + 内层 2 次
    REQUIRE(wait_until([&] { return total.load() >= 4; }));
    s.shutdown();
}

TEST_CASE("coroutine 关闭时正在 yield 的协程不会卡住也不会崩", "[coroutine][integration]")
{
    auto s = std::make_unique<data::Scheduler>(1);
    std::atomic<int> total{0};
    std::atomic<int> off{0};
    //这个协程永远跑不完,只能靠 shutdown 结束
    s->submit(counter_coro(*s, total, off, 1 << 20));
    REQUIRE(wait_until([&] { return total.load() > 5; }));
    s->shutdown();
    const int seen = total.load();
    std::this_thread::sleep_for(std::chrono::milliseconds(30));
    REQUIRE(total.load() == seen);
}

TEST_CASE("coroutine 调度器与常量池同时工作", "[coroutine][integration]")
{
    auto pool = std::make_unique<runtime::ConstPool>(
        std::unordered_map<int, std::string>{{100, "base"}},
        std::unordered_map<int, double>{{200, 1.5}});
    data::Scheduler s(2);
    std::atomic<int> done{0};

    constexpr int ids = 50;
    std::vector<int> allocated;
    allocated.reserve(ids);
    for (int i = 0; i < ids; ++i)
        allocated.push_back(pool->id_number(1000.0 + i));

    for (int i = 0; i < ids; ++i)
    {
        pool->link(allocated[i]);
        s.spawn([&] { ++done; });
    }
    REQUIRE(wait_until([&] { return done.load() == ids; }));
    for (int id : allocated)
        REQUIRE(wait_until([&] { return pool->ref_count(id) == 1; }));

    for (int id : allocated)
        pool->unlink(id);
    for (int id : allocated)
        REQUIRE(wait_until([&] { return pool->pending_gc(id); }));

    pool->gc();
    for (int id : allocated)
        REQUIRE(wait_until([&] { return !pool->has(id); }));

    s.shutdown();
    pool->stop();
}

TEST_CASE("coroutine 反复创建销毁调度器不出问题", "[coroutine][integration]")
{
    for (int round = 0; round < 5; ++round)
    {
        data::Scheduler s(2);
        std::atomic<int> total{0};
        for (int i = 0; i < 20; ++i)
            s.spawn([&] { ++total; });
        REQUIRE(wait_until([&] { return total.load() == 20; }));
        s.shutdown();
        REQUIRE(total.load() == 20);
    }
}

//yield 的协程必须等 resume 返回后才重新入队,否则多 worker 会同时恢复同一个协程
TEST_CASE("coroutine 多 worker 下 yield 不会让同一协程被并发恢复", "[coroutine][integration]")
{
    for (int round = 0; round < 5; ++round)
    {
        data::Scheduler s(8);
        std::atomic<int> total{0};
        std::atomic<int> off{0};
        constexpr int coros = 500;
        constexpr int rounds = 5;
        for (int i = 0; i < coros; ++i)
            s.submit(counter_coro(s, total, off, rounds));
        REQUIRE(wait_until([&] { return total.load() == coros * rounds; }, 30000));
        REQUIRE(total.load() == coros * rounds);
        s.shutdown();
    }
}

TEST_CASE("coroutine 任务里抛异常不会带崩调度器", "[coroutine][integration]")
{
    data::Scheduler s(2);
    std::atomic<int> after{0};
    s.spawn([] { throw std::runtime_error("boom"); });
    s.spawn([&] { ++after; });
    REQUIRE(wait_until([&] { return after.load() == 1; }));
    s.shutdown();
    REQUIRE(after.load() == 1);
}
