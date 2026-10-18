#include "../main.h"

void data::SpinLock::lock() noexcept
{
    while (f.test_and_set(std::memory_order_acquire))
        while (f.test(std::memory_order_relaxed))
            SLANG_SCHED_PAUSE();
}
void data::SpinLock::unlock() noexcept
{
    f.clear(std::memory_order_release);
}
void data::WorkQueue::push_back(Task t)
{
    SpinGuard g(lk); d.push_back(t);
}
bool data::WorkQueue::pop_back(Task& out)
{
    SpinGuard g(lk);
    if (d.empty())
        return false;
    out = d.back(); d.pop_back();
    return true;
}
bool data::WorkQueue::steal(Task& out)
{
    SpinGuard g(lk);
    if (d.empty())
        return false;
    out = d.front(); d.pop_front();
    return true;
}
size_t data::WorkQueue::size()
{
    SpinGuard g(lk);
    return d.size();
}
bool data::WorkQueue::empty()
{
    SpinGuard g(lk);
    return d.empty();
}
bool data::Scheduler::has_any_work() const
{
    for (auto& q : qs)
        if (!q->empty()) return true;
    return false;
}
size_t data::Scheduler::pick_queue() const
{
    if (n <= 1) return 0;
    unsigned r = sched_rand();
    size_t a = r % n, b = (r >> 13) % n;
    return qs[a]->size() <= qs[b]->size() ? a : b;
}
bool data::Scheduler::steal_any(const size_t idx, Task& out) const
{
    if (n <= 1)
        return false;
    size_t v = sched_rand() % n;
    if (v == idx) v = (v + 1) % n;
    if (qs[v]->steal(out)) return true;
    for (size_t k = 1; k < n; ++k)
    {
        size_t j = (idx + k) % n;
        if (qs[j]->steal(out))
            return true;
    }
    return false;
}
bool data::Scheduler::take_any(const size_t idx, Task& out) const
{
    if (qs[idx]->pop_back(out))
        return true;
    return steal_any(idx, out);
}
void data::Scheduler::wake() {
    if (sleepers.load(std::memory_order_acquire) > 0) {
        std::lock_guard<std::mutex> g(mtx);
        cv.notify_one();
    }
}
void data::Scheduler::run(const Task t)
{
    if (!t)
        return; t.resume();
    if (t.done())
        t.destroy();
}
void data::Scheduler::worker_loop(const size_t idx) {
    g_current_worker = static_cast<int>(idx);
    int spins = 0;
    while (running.load(std::memory_order_relaxed)) {
        Task t = nullptr;
        if (take_any(idx, t))
        {
            spins = 0; run(t); continue;
        }
        if (spins < SPIN_LIMIT)
        {
            ++spins;
            SLANG_SCHED_PAUSE();
            continue;
        }
        std::unique_lock<std::mutex> g(mtx);
        ++sleepers;
        cv.wait(g, [&]
        {
            return !running.load(std::memory_order_relaxed) || has_any_work();
        });
        --sleepers;
        spins = 0;
    }
}
data::Scheduler::Scheduler(size_t workers) {
    if (workers == 0)
    {
        workers = std::thread::hardware_concurrency();
        if (workers == 0)
            workers = 2;
    }
    n = workers;
    qs.reserve(n);
    for (size_t i = 0; i < n; ++i)
        qs.push_back(std::make_unique<WorkQueue>());
    ts.reserve(n);
    for (size_t i = 0; i < n; ++i)
        ts.emplace_back([this, i]
        {
            worker_loop(i);
        });
}
data::Scheduler::~Scheduler()
{
    shutdown();
}
void data::Scheduler::post(Task t)
{
    qs[pick_queue()]->push_back(t);
    wake();
}
void data::Scheduler::submit(Coro c)
{
    post(c.handle());
}
data::YieldAwaiter data::Scheduler::yield() noexcept
{
    return YieldAwaiter{ this };
}
void data::Scheduler::yield_self(Task t) {
    int id = g_current_worker;
    if (id >= 0 && static_cast<size_t>(id) < n)
        qs[id]->push_back(t);
    else post(t);
    wake();
}
void data::Scheduler::shutdown() {
    {
        std::lock_guard<std::mutex> g(mtx);
        running.store(false);
    }
    cv.notify_all();
    for (auto& t : ts)
        if (t.joinable())
            t.join();
    ts.clear();
    Task t;
    for (auto& q : qs)
        while (q->pop_back(t))
            t.destroy();
}
