#ifndef SLANG_MAIN_H
#define SLANG_MAIN_H
#include <condition_variable>
#include <string>
#include <iostream>
#include<fstream>
#include<filesystem>
#include <functional>
#include <set>
#include <unordered_map>
#include <vector>
#include <queue>
#include <list>
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
        void close(const int&);
    private:
        std::unordered_map<int,Net> nets;
    };
    class GUI
    {
        int handle = 0;
    public:
        explicit GUI(const std::string& title);
        ~GUI();
        void load(const std::string& html);
        GUI(const GUI&) = delete;
        GUI& operator=(const GUI&) = delete;
    };
    void print(const std::string&);
    std::string input();
    void init();
    bool writeText(const std::string&,const std::string&);
    bool writeBinary(const std::string&,const std::string&);
    std::string readText(const std::string&);
    std::string readBinary(const std::string&);
    bool mkdir(const std::string&);
    bool rmdir(const std::string&);
    bool remove(const std::string&);
    bool exists(const std::string&);
    bool isFile(const std::string&);
    bool isDir(const std::string&);
    std::vector<std::string> list(const std::string&);
    std::string cwd();
    std::string homedir();
    template<class T>
    class Queue {
            std::queue<T> q_;
            mutable std::mutex m_;
            std::condition_variable cv_;
            bool stop_ = false;
        public:
            void push(T t) {
                {
                    std::lock_guard lk(m_);
                    q_.push(std::move(t));
                }
                cv_.notify_one();
            }
            bool pop(T& out) {
                std::unique_lock lk(m_);
                cv_.wait(lk, [&]{ return stop_ || !q_.empty(); });
                if (q_.empty()) return false;
                out = std::move(q_.front());
                q_.pop();
                return true;
            }
            bool try_pop(T& out) {
                std::lock_guard<std::mutex> lk(m_);
                if (q_.empty()) return false;
                out = std::move(q_.front());
                q_.pop();
                return true;
            }
            bool empty() const {
                std::lock_guard<std::mutex> lk(m_);
                return q_.empty();
            }
            void stop() {
                { std::lock_guard<std::mutex> lk(m_); stop_ = true; }
                cv_.notify_all();
            }
    };
    template<typename K1,typename K2,typename K3>
    struct three_key
    {
        K1 key1;
        K2 key2;
        K3 key3;
    };
}
namespace runtime
{
    class ConstPool
    {
        void run();
    public:
        std::unordered_map<int,double> number_pool;
        std::unordered_map<int,std::string> string_pool;
        //引用计数
        std::unordered_map<int,int> linked;
        //需要gc的
        std::set<int> gc_list;
        /*
         *
         */
        std::mutex mtx;
        std::vector<util::three_key<int,std::function<void(ConstPool*)>,bool>> task;
        int link(const int&);
        void unlink(const int&);
        void gc();
    };
    class Runtime
    {
    };
    class Manage{};
}
namespace instruction
{
}
#endif