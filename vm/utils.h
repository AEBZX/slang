#ifndef SLANG_UTILS_H
#define SLANG_UTILS_H
#include <functional>
#include <iostream>
#include <string>
#include <memory>
#include <ostream>
#include <thread>
#include <utility>
#ifdef _WIN32
    #define PLATFORM "Windows"
#elif __APPLE__
    #define PLATFORM "MacOS"
#elif __linux__
    #define PLATFORM "Linux"
#endif
//通用
class Runnable {
public:
    virtual ~Runnable() = default;
    virtual void run() = 0;
};
class FunctionRunnable : public Runnable {
private:
    std::function<void()> func{};
public:
    explicit FunctionRunnable(std::function<void()> f) : func(std::move(f)) {}
    void run() override { func(); }
};
class Thread {
private:
    std::thread nativeThread;
    std::string name;
    bool started = false;
    bool joined = false;
public:
    explicit Thread(std::string threadName = "") : name(std::move(threadName)) {}
    virtual ~Thread() {
        if (started && !joined && nativeThread.joinable()) {
            nativeThread.detach();
        }
    }
    // 启动线程
    void start() {
        if (started) return;
        started = true;
        nativeThread = std::thread([this]() {
            this->run();
        });
    }

    // 等待线程结束
    void join() {
        if (!started || joined) return;
        if (nativeThread.joinable()) {
            nativeThread.join();
            joined = true;
        }
    }

    // 子类必须重写这个方法
    virtual void run() = 0;

    // 工具方法
    [[nodiscard]] std::string getName() const { return name; }
    void setName(const std::string& newName) { name = newName; }

    // 静态工具方法
    static void sleep(const long long millis) {
        std::this_thread::sleep_for(std::chrono::milliseconds(millis));
    }

    static std::thread::id currentThreadId() {
        return std::this_thread::get_id();
    }
};
std::string readFile(std::string local)
{
    return "";
}
bool exists(std::string local)
{
    return false;
}
bool isFile(std::string local)
{
    return false;
}
bool isFolder(std::string local)
{
    return false;
}
std::string* children(std::string local)
{
    return nullptr;
}
char* readFile(std::string local,...)
{
}
void writeFile(std::string local,std::string data)
{
}
void writeFile(std::string local,char* data)
{
}
bool createDictionary(std::string local)
{
    return false;
}
bool createFile(std::string local)
{
    return false;
}
void console(std::string data)
{
    std::cout <<data<<std::flush;
}
void read(std::string* data)
{
    std::getline(std::cin,*data);
}
#endif