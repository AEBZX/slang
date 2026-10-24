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
#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <unistd.h>
#endif
#ifdef _WIN32
using SocketHandle = SOCKET;
inline constexpr SocketHandle kInvalidSocket = INVALID_SOCKET;
#else
using SocketHandle = int;
inline constexpr SocketHandle kInvalidSocket = -1;
#endif
#if defined(_MSC_VER)
#include <intrin.h>
#define SLANG_SCHED_PAUSE() _mm_pause()
#elif defined(__GNUC__) && (defined(__x86_64__) || defined(__i386__))
#include <immintrin.h>
#define SLANG_SCHED_PAUSE() _mm_pause()
#else
#define SLANG_SCHED_PAUSE() ((void)0)
#endif
namespace util{
    class Net
    {
        SocketHandle fd = kInvalidSocket;
        std::string host;
    public:
        explicit Net(const std::string&);
        ~Net();
        std::string send(const std::string&);
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
    struct any
    {
        std::string str;
        double num;
        bool is_num;
        any(const std::string& s)
        {
            str=s;
            is_num=false;
        }
        any(const double n)
        {
            num=n;
            is_num=false;
        }
    };
    template<typename K1,typename K2,typename K3>
    struct three_key
    {
        K1 key1;
        K2 key2;
        K3 key3;
        three_key(K1 k1, K2 k2, K3 k3)
        : key1(std::move(k1)), key2(std::move(k2)), key3(std::move(k3)) {}
    };
    template<typename K,typename  V>
    struct KV
    {
        K key;
        V value;
        KV(K k, V v) : key(std::move(k)), value(std::move(v)) {}
    };
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
        bool await_ready() const noexcept { return false; }
        void await_resume() const noexcept {}
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
        //当前 worker 跑一个任务:yield 出去的协程要等 resume 返回后才入队,
        //否则别的 worker 会在它还没挂起完成时把它偷走,导致同一协程被两个线程恢复
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
    static std::atomic<int> max_id;
    inline int id()
    {
        max_id.fetch_add(1);
        return max_id.load();
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
    static std::unordered_map<int,instruction> run_table;
}
namespace runtime
{
    class ConstPool;
    class Manage;
    using pool_task=data::three_key<std::vector<int>,std::function<void(ConstPool*,std::vector<int>)>,bool>;
    using instruction_task=data::three_key<std::vector<int>,instruction::instruction,bool>;
    class ConstPool
    {
        bool _stop;
        std::mutex mtx;
        std::vector<pool_task> task;
        std::condition_variable cv;
        std::mutex wait_mtx;
        bool _continue;
        std::atomic<int> inflight{0};
        std::thread worker;
        void run();
    public:
        void stop();
        ConstPool(std::unordered_map<int,std::string>,std::unordered_map<int,double>);
        ~ConstPool();
        ConstPool(const ConstPool&) = delete;
        ConstPool& operator=(const ConstPool&) = delete;
        int ref_count(const int&);
        bool pending_gc(const int&);
        bool has(const int&);
        std::unordered_map<int,double> number_pool;
        std::unordered_map<int,std::string> string_pool;
        //反表用来取id
        std::unordered_map<double,int> number_pool_rev;
        std::unordered_map<std::string_view,int> string_pool_rev;
        //引用计数
        std::unordered_map<int,std::atomic<int>> linked;
        //需要gc的
        std::unordered_set<int> gc_list;
        void link(const int&);
        int id_number(const double&);
        int id_string(const std::string&);
        void unlink(const int&);
        void gc();
    };
    struct frame
    {
        int type;
        int pc;
        std::vector<instruction_task>* instruction;
    };
    struct Reg
    {
        int bind=0;
        std::unordered_map<int,int> offset_bind;
        std::unordered_map<std::string,int> name_bind;
    };
    class Runtime
    {
    public:
        Manage* father;
        frame now;
        std::unordered_map<std::string,std::unordered_map<int,Reg>> out;
        std::stack<frame> frames;
        std::stack<data::KV<int,Reg>> _stack;
        std::unordered_map<int,Reg> param;
        Runtime();
        ~Runtime();
        Runtime(const Runtime&) = delete;
        Runtime& operator=(const Runtime&) = delete;
        void run();
    };
    class Manage
    {
        bool _start=false;
        std::atomic<int> id=0;
        std::mutex mtx;
        std::unordered_map<int,bool> lock;
        std::vector<data::KV<int,instruction_task>> task;
        std::unordered_map<int,Runtime> runtime;
        std::condition_variable cv;
        std::mutex wait_mtx;
        bool _stop;
    public:
        util::NetPool net;
        Reg* null_reg;
        std::unordered_map<int,Reg> reg;
        std::unordered_map<int,std::vector<instruction_task>> command;
        ConstPool pool;
        Manage(const std::unordered_map<int,std::string>&, const std::unordered_map<int,double>&,
            std::unordered_map<int,std::vector<data::KV<int,data::three_key<int,int,int>>>>);
        ~Manage();
        Manage(const Manage&) = delete;
        Manage& operator=(const Manage&) = delete;
        std::vector<instruction_task>* get(const int&);
        void malloc(const int&,const int&,const Runtime*);
        void start();
        void stop();
        void gc();
        void delete_reg(const int&);
    };
}
#endif