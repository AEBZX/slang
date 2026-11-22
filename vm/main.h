#ifndef SLANG_MAIN_H
#define SLANG_MAIN_H
#include <condition_variable>
#include <string>
#include <iostream>
#include<fstream>
#include<filesystem>
#include <functional>
#include <unordered_set>
#include <unordered_map>
#include <vector>
#include <coroutine>
#include <memory>
#include <cstdint>
#include <thread>
#include <atomic>
#include <mutex>
#include <deque>
#include <condition_variable>
#include <stack>
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winsock2.h>
#include <ws2tcpip.h>
using SocketHandle = SOCKET;
inline constexpr SocketHandle kInvalidSocket = INVALID_SOCKET;
#if defined(_MSC_VER)
#include <intrin.h>
#define SLANG_SCHED_PAUSE() _mm_pause()
#elif defined(__GNUC__) && (defined(__x86_64__) || defined(__i386__))
#include <immintrin.h>
#define SLANG_SCHED_PAUSE() _mm_pause()
#endif
namespace util{
    class Net
    {
        SocketHandle fd = kInvalidSocket;
        std::string host;
    public:
        explicit Net(const std::string&);
        ~Net();
        void send(const std::string&);
        std::string recv(const int&);
        void close();
        Net(const Net&) = delete;
        Net& operator=(const Net&) = delete;
        [[nodiscard]] bool connected() const noexcept { return fd != kInvalidSocket;}
        Net(Net&& o) noexcept : fd(o.fd) { o.fd = kInvalidSocket; }
        Net& operator=(Net&& o) noexcept { if (this != &o) { close(); fd = o.fd; o.fd = kInvalidSocket; } return *this; }
    };
    class NetPool
    {
    public:
        NetPool();
        ~NetPool();
        int connect(const std::string&);
        std::string send(const int&,const std::string&);
        std::string recv(const int&,const int&);
        void close(const int&);
    private:
        std::unordered_map<int,std::mutex> mutex;
        std::unordered_map<int,Net> nets;
    };
    class GUI
    {
        int handle = 0;
    public:
        explicit GUI(const std::string&);
        ~GUI();
        void load(const std::string&);
        GUI(const GUI&) = delete;
        GUI& operator=(const GUI&) = delete;
    };
    void print(const std::string&);
    std::string input();
    void init(const std::vector<std::string>&);
    bool writeText(const std::string&,const std::string&);
    bool writeBinary(const std::string&,const std::string&);
    std::string readText(const std::string&);
    std::string readBinary(const std::string&);
    bool create(const std::string&);
    bool mkdir(const std::string&);
    bool rmdir(const std::string&);
    bool remove(const std::string&);
    bool exists(const std::string&);
    bool isFile(const std::string&);
    bool isDir(const std::string&);
    void command(const std::string&);
    std::vector<std::string> list(const std::string&);
    std::string cwd();
    std::string homedir();
    inline std::vector<std::string> args;
}
namespace data
{
    using Task = std::coroutine_handle<>;
    class SpinLock
    {
        std::atomic_flag f = ATOMIC_FLAG_INIT;
    public:
        void lock() noexcept;
        void unlock() noexcept;
    };
    struct SpinGuard
    {
        SpinLock& l;
        explicit SpinGuard(SpinLock& x) : l(x)
        {
            l.lock();
        }
        ~SpinGuard()
        {
            l.unlock();
        }
        SpinGuard(const SpinGuard&) = delete;
        SpinGuard& operator=(const SpinGuard&) = delete;
    };
    class WorkQueue
    {
        alignas(64) SpinLock lk;
        std::deque<Task> d;
    public:
        void push_back(Task);
        bool pop_back(Task&);
        bool steal(Task&);
        size_t size();
        bool empty();
    };
    inline thread_local int g_current_worker = -1;
    inline unsigned sched_rand() {
        thread_local unsigned x = static_cast<unsigned>(reinterpret_cast<std::uintptr_t>(&x)) ^ 0x9E3779B9u;
        x ^= x << 13; x ^= x >> 17; x ^= x << 5; return x;
    }
    class Scheduler;
    struct YieldAwaiter
    {
        Scheduler* s;
        bool await_ready() noexcept { return false; }
        void await_resume() noexcept {}
        void await_suspend(std::coroutine_handle<> h) const noexcept;
    };
    struct Coro
    {
        struct promise_type
        {
            Coro get_return_object()
            {
                return Coro{ std::coroutine_handle<promise_type>::from_promise(*this) };
            }
            std::suspend_always initial_suspend() noexcept
            {
                return {};
            }
            std::suspend_always final_suspend() noexcept
            {
                return {};
            }
            void return_void() noexcept {}
            void unhandled_exception() noexcept {}
        };
        std::coroutine_handle<promise_type> h;
        [[nodiscard]] Task handle() const noexcept
        {
            return Task(h);
        }
    };
    template<class F>
    Coro once(F f){
        f();
        co_return;
    }
    class Scheduler
    {
        std::vector<std::unique_ptr<WorkQueue>> qs;
        std::vector<std::thread> ts;
        size_t n = 0;
        std::atomic<bool> running{true};
        std::atomic<int> sleepers{0};
        std::mutex mtx;
        std::condition_variable cv;
        static constexpr int SPIN_LIMIT = 64;
        [[nodiscard]] bool has_any_work() const;
        [[nodiscard]] size_t pick_queue() const;
        bool steal_any(size_t, Task&) const;
        bool take_any(size_t, Task&) const;
        void wake();
        void run(Task);
        void run_one(size_t, Task);
        void worker_loop(size_t);
    public:
        explicit Scheduler(size_t=0);
        ~Scheduler();
        Scheduler(const Scheduler&) = delete;
        Scheduler& operator=(const Scheduler&) = delete;
        void post(Task);
        void submit(Coro);
        YieldAwaiter yield() noexcept;
        void yield_self(Task);
        void shutdown();
        template<class Fn>
        void spawn(Fn fn)
        {
            submit(once(std::move(fn)));
        }
    };
    inline Scheduler& scheduler() {
        static Scheduler inst;
        return inst;
    }
    //号从 1 开始,0是null槽
    inline std::atomic<int> max_id;
    inline int id()
    {
        return max_id.fetch_add(1)+1;
    }
    inline void reserve(const int used)
    {
        if (used>max_id.load())max_id.store(used);
    }
    inline void YieldAwaiter::await_suspend(std::coroutine_handle<> h) const noexcept
    {
        s->yield_self(h);
    }
    struct instruction
    {
        int id;int arg1;int arg2;int arg3;
        instruction(const int i, const int a1, const int a2, const int a3)
        {
            id = i;
            arg1 = a1;
            arg2 = a2;
            arg3 = a3;
        }
    };
}
namespace runtime{class Runtime;}
namespace instruction
{
    using instruction=std::function<void(runtime::Runtime*,int,int,int)>;
    void init();
    //得是 inline:static 是内部链接,init 填的和 Manage 读的会变成两张表
    inline std::unordered_map<int,instruction> run_table;
}
namespace runtime
{
    class ConstPool
    {
        std::unordered_map<int,int>
    };
}
namespace sbin
{
}
#endif