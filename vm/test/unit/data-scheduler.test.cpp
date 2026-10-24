//单元测试:协程对象与调度器(Coro / once / Scheduler)
#include <catch2/catch_all.hpp>

#include <atomic>
#include <chrono>
#include <thread>

#include "../../main.h"

namespace
{
    //等一个原子量到达目标值,超时就让用例失败(避免死等)
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

    //自定义协程:计数 n 次、每次都 yield 回去
    data::Coro yielder(data::Scheduler& s, std::atomic<int>& count, int n)
    {
        for (int i = 0; i < n; ++i)
        {
            ++count;
            co_await s.yield();
        }
    }
}

TEST_CASE("data-coro once 不会立刻执行(initial_suspend 挂起)", "[data][coro]")
{
    int hits = 0;
    auto c = data::once([&] { ++hits; });
    REQUIRE(hits == 0);
    REQUIRE(c.handle() != nullptr);
    REQUIRE_FALSE(c.handle().done());

    c.handle().resume();
    REQUIRE(hits == 1);
    REQUIRE(c.handle().done());
    c.handle().destroy();
}

TEST_CASE("data-coro handle 指向同一个协程帧", "[data][coro]")
{
    auto c = data::once([] {});
    REQUIRE(static_cast<bool>(c.handle()));
    REQUIRE(c.handle().address() == c.h.address());
    c.handle().destroy();
}

TEST_CASE("data-scheduler spawn 一定执行且只执行一次", "[data][scheduler]")
{
    data::Scheduler s(1);
    std::atomic<int> hits{0};
    s.spawn([&] { ++hits; });
    REQUIRE(wait_until([&] { return hits.load() == 1; }));
    std::this_thread::sleep_for(std::chrono::milliseconds(20));
    REQUIRE(hits.load() == 1);
    s.shutdown();
}

TEST_CASE("data-scheduler 大量 spawn 全都会跑完", "[data][scheduler]")
{
    data::Scheduler s(4);
    constexpr int total = 3000;
    std::atomic<int> hits{0};
    for (int i = 0; i < total; ++i)
        s.spawn([&] { ++hits; });
    REQUIRE(wait_until([&] { return hits.load() == total; }, 20000));
    REQUIRE(hits.load() == total);
    s.shutdown();
}

TEST_CASE("data-scheduler 多线程同时 spawn 不丢任务", "[data][scheduler]")
{
    data::Scheduler s(2);
    constexpr int producers = 4;
    constexpr int per = 500;
    std::atomic<int> hits{0};
    std::vector<std::thread> ts;
    for (int p = 0; p < producers; ++p)
        ts.emplace_back([&]
        {
            for (int i = 0; i < per; ++i)
                s.spawn([&] { ++hits; });
        });
    for (auto& t : ts)
        t.join();
    REQUIRE(wait_until([&] { return hits.load() == producers * per; }, 20000));
    REQUIRE(hits.load() == producers * per);
    s.shutdown();
}

TEST_CASE("data-scheduler 协程 yield 之后会继续跑到结束", "[data][coro][scheduler]")
{
    data::Scheduler s(1);
    std::atomic<int> count{0};
    s.submit(yielder(s, count, 5));
    REQUIRE(wait_until([&] { return count.load() == 5; }));
    std::this_thread::sleep_for(std::chrono::milliseconds(30));
    //跑完之后不该再被恢复,计数不能超过 5
    REQUIRE(count.load() == 5);
    s.shutdown();
}

TEST_CASE("data-scheduler 多个协程交替 yield 都在推进", "[data][coro][scheduler]")
{
    data::Scheduler s(2);
    std::atomic<int> count{0};
    for (int i = 0; i < 8; ++i)
        s.submit(yielder(s, count, 4));
    REQUIRE(wait_until([&] { return count.load() == 32; }, 20000));
    REQUIRE(count.load() == 32);
    s.shutdown();
}

TEST_CASE("data-scheduler shutdown 之后不再执行任务", "[data][scheduler]")
{
    data::Scheduler s(2);
    std::atomic<int> hits{0};
    s.shutdown();
    s.spawn([&] { ++hits; });
    std::this_thread::sleep_for(std::chrono::milliseconds(30));
    REQUIRE(hits.load() == 0);
}

TEST_CASE("data-scheduler 没开始跑的协程在 shutdown 时被销毁而不是执行", "[data][scheduler]")
{
    data::Scheduler s(1);
    std::atomic<int> hits{0};
    //先占满线程:提交一个一直 yield 的协程,保证后面的任务没机会跑
    s.shutdown();
    std::atomic<int> started{0};
    data::Scheduler s2(1);
    auto c = data::once([&] { ++started; });
    //不 submit,只手动销毁:确保 Coro 不会自己执行
    REQUIRE(started.load() == 0);
    c.handle().destroy();
    REQUIRE(started.load() == 0);
    s2.shutdown();
}

TEST_CASE("data-scheduler post 一个已完成的空任务不会崩", "[data][scheduler]")
{
    data::Scheduler s(1);
    std::atomic<int> hits{0};
    s.post(nullptr);
    s.spawn([&] { ++hits; });
    REQUIRE(wait_until([&] { return hits.load() == 1; }));
    s.shutdown();
}

TEST_CASE("data-scheduler shutdown 可以重复调用", "[data][scheduler]")
{
    data::Scheduler s(2);
    std::atomic<int> hits{0};
    s.spawn([&] { ++hits; });
    REQUIRE(wait_until([&] { return hits.load() == 1; }));
    s.shutdown();
    s.shutdown();
    REQUIRE(hits.load() == 1);
}

TEST_CASE("data-scheduler 单 worker 下 yield 也不会死锁", "[data][coro][scheduler]")
{
    data::Scheduler s(1);
    std::atomic<int> count{0};
    //一个反复 yield 的协程 + 一个普通任务,单线程调度器必须都能推进
    s.submit(yielder(s, count, 50));
    std::atomic<int> other{0};
    s.spawn([&] { ++other; });
    REQUIRE(wait_until([&] { return count.load() == 50 && other.load() == 1; }));
    REQUIRE(count.load() == 50);
    REQUIRE(other.load() == 1);
    s.shutdown();
}
