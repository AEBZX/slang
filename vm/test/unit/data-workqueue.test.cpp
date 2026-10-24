//单元测试:协程模型的队列与自旋锁(SpinLock / SpinGuard / WorkQueue)
#include <catch2/catch_all.hpp>

#include <atomic>
#include <chrono>
#include <thread>
#include <vector>

#include "../../main.h"

namespace
{
    //把一个空 handle(默认构造)当作哨兵放进队列,用它验证出入顺序
    data::Task make_task(std::coroutine_handle<> h = nullptr)
    {
        return data::Task(h);
    }
}

TEST_CASE("data-workqueue 空队列的各种查询", "[data]")
{
    data::WorkQueue q;
    REQUIRE(q.empty());
    REQUIRE(q.size() == 0);
    data::Task out;
    REQUIRE_FALSE(q.pop_back(out));
    REQUIRE_FALSE(q.steal(out));
}

TEST_CASE("data-workqueue push/pop_back 是栈语义(后进先出)", "[data]")
{
    data::WorkQueue q;
    //用不同指针值区分任务,这里不真正 resume
    auto a = data::Task::from_address(reinterpret_cast<void*>(0x1));
    auto b = data::Task::from_address(reinterpret_cast<void*>(0x2));
    auto c = data::Task::from_address(reinterpret_cast<void*>(0x3));
    q.push_back(a);
    q.push_back(b);
    q.push_back(c);
    REQUIRE(q.size() == 3);

    data::Task out;
    REQUIRE(q.pop_back(out));
    REQUIRE(out.address() == c.address());
    REQUIRE(q.pop_back(out));
    REQUIRE(out.address() == b.address());
    REQUIRE(q.pop_back(out));
    REQUIRE(out.address() == a.address());
    REQUIRE(q.empty());
}

TEST_CASE("data-workqueue steal 是队列语义(先进先出)", "[data]")
{
    data::WorkQueue q;
    auto a = data::Task::from_address(reinterpret_cast<void*>(0x11));
    auto b = data::Task::from_address(reinterpret_cast<void*>(0x12));
    q.push_back(a);
    q.push_back(b);

    data::Task out;
    REQUIRE(q.steal(out));
    REQUIRE(out.address() == a.address());
    REQUIRE(q.steal(out));
    REQUIRE(out.address() == b.address());
    REQUIRE_FALSE(q.steal(out));
}

TEST_CASE("data-workqueue 被偷之后仍可用 pop_back 取出自己的任务", "[data]")
{
    data::WorkQueue q;
    auto a = data::Task::from_address(reinterpret_cast<void*>(0x21));
    auto b = data::Task::from_address(reinterpret_cast<void*>(0x22));
    auto c = data::Task::from_address(reinterpret_cast<void*>(0x23));
    q.push_back(a);
    q.push_back(b);
    q.push_back(c);

    data::Task out;
    REQUIRE(q.steal(out));
    REQUIRE(out.address() == a.address());
    REQUIRE(q.pop_back(out));
    REQUIRE(out.address() == c.address());
    REQUIRE(q.size() == 1);

    REQUIRE(q.steal(out));
    REQUIRE(out.address() == b.address());
    REQUIRE(q.empty());
}

TEST_CASE("data-workqueue 多线程各自推自己的队列不丢任务", "[data]")
{
    data::WorkQueue q;
    constexpr int workers = 4;
    constexpr int per = 2000;
    std::vector<std::thread> ts;
    for (int w = 0; w < workers; ++w)
        ts.emplace_back([&q, w]
        {
            for (int i = 0; i < per; ++i)
                q.push_back(data::Task::from_address(
                    reinterpret_cast<void*>(static_cast<std::uintptr_t>(w * per + i + 1))));
        });
    for (auto& t : ts)
        t.join();
    REQUIRE(q.size() == static_cast<size_t>(workers * per));

    size_t got = 0;
    data::Task out;
    while (q.pop_back(out))
        ++got;
    REQUIRE(got == static_cast<size_t>(workers * per));
}

TEST_CASE("data-workqueue 边推边偷不会丢任务也不会重复", "[data]")
{
    data::WorkQueue q;
    constexpr int total = 4000;
    std::atomic<int> stolen{0};
    std::thread producer([&q]
    {
        for (int i = 0; i < total; ++i)
            q.push_back(data::Task::from_address(
                reinterpret_cast<void*>(static_cast<std::uintptr_t>(i + 1))));
    });
    std::thread thief([&q, &stolen]
    {
        data::Task out;
        while (stolen.load() + static_cast<int>(q.size()) < total)
            if (q.steal(out))
                ++stolen;
    });
    producer.join();
    thief.join();
    int remain = 0;
    data::Task out;
    while (q.pop_back(out) || q.steal(out))
        ++remain;
    REQUIRE(stolen.load() + remain == total);
}

TEST_CASE("data-spinlock 互斥:临界区不会同时进入", "[data]")
{
    data::SpinLock lk;
    int inside = 0;
    int max_inside = 0;
    constexpr int workers = 4;
    constexpr int rounds = 5000;
    std::vector<std::thread> ts;
    for (int w = 0; w < workers; ++w)
        ts.emplace_back([&]
        {
            for (int i = 0; i < rounds; ++i)
            {
                data::SpinGuard g(lk);
                const int now = ++inside;
                if (now > max_inside)
                    max_inside = now;
                --inside;
            }
            //下面的读也放进临界区,避免数据竞争
        });
    for (auto& t : ts)
        t.join();
    REQUIRE(max_inside == 1);
    REQUIRE(inside == 0);
}

TEST_CASE("data-spinlock 累加计数所有线程的更新都生效", "[data]")
{
    data::SpinLock lk;
    long long counter = 0;
    constexpr int workers = 4;
    constexpr int rounds = 20000;
    std::vector<std::thread> ts;
    for (int w = 0; w < workers; ++w)
        ts.emplace_back([&]
        {
            for (int i = 0; i < rounds; ++i)
            {
                data::SpinGuard g(lk);
                ++counter;
            }
        });
    for (auto& t : ts)
        t.join();
    REQUIRE(counter == static_cast<long long>(workers) * rounds);
}

TEST_CASE("data-spinlock 可以重复加锁解锁", "[data]")
{
    data::SpinLock lk;
    for (int i = 0; i < 1000; ++i)
    {
        lk.lock();
        lk.unlock();
    }
    //能再次抢到说明状态没坏
    lk.lock();
    lk.unlock();
    REQUIRE(true);
}
