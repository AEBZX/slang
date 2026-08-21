#ifndef SLANG_UTILS_H
#define SLANG_UTILS_H
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iostream>
#include <string>
#include <memory>
#include <mutex>
#include <ostream>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>
#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #include <windows.h>
    #include <psapi.h>
    #ifdef _MSC_VER
        #pragma comment(lib, "ws2_32.lib")
        #pragma comment(lib, "psapi.lib")
    #endif
#elif __APPLE__
    #include <mach/mach.h>
    #include <netdb.h>
    #include <pwd.h>
    #include <sys/socket.h>
    #include <sys/wait.h>   //WIFEXITED/WEXITSTATUS(exec),macOS 与 Linux 同源
    #include <unistd.h>
    using SOCKET = int;
#define INVALID_SOCKET (-1)
#define closesocket ::close
#else
#include <netdb.h>
#include <pwd.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <unistd.h>
using SOCKET = int;
#define INVALID_SOCKET (-1)
#define closesocket ::close
#endif
class NetRuntime
{
private:
    std::unordered_map<int, SOCKET> conns;
    int nextHandle = 0;
    //fuck windows,fuck microsoft,傻逼初始化
    //非 Windows 平台无需 WSA 初始化,空实现内联消除调用开销
    static void ensureInit()
    {
#ifdef _WIN32
        static struct Guard {
            Guard() { WSADATA wsa; WSAStartup(MAKEWORD(2, 2), &wsa); }
            ~Guard() { WSACleanup(); }
        } guard;
#else
        (void)0;
#endif
    }

    static bool sendBytes(const SOCKET sock, const char* data, const size_t len)
    {
        ensureInit();
        size_t sent = 0;
        while (sent < len)
        {
            //Windows send 长度参数为 int,POSIX 为 size_t;分平台取块长避免截断
#ifdef _WIN32
            const int chunk = static_cast<int>(len - sent);
#else
            const auto chunk = len - sent;
#endif
            const auto n = ::send(sock, data + sent, chunk, 0);
            if (n <= 0) return false;
            sent += static_cast<size_t>(n);
        }
        return true;
    }

    static bool recvBytes(const SOCKET sock, char* out, const size_t n)
    {
        ensureInit();
        size_t got = 0;
        while (got < n)                       // 关键:凑满n字节才算成功
        {
#ifdef _WIN32
            const int chunk = static_cast<int>(n - got);
#else
            const auto chunk = n - got;
#endif
            const auto r = ::recv(sock, out + got, chunk, 0);
            if (r <= 0) return false;         // 0=对端关闭 <0=出错
            got += static_cast<size_t>(r);
        }
        return true;
    }
public:
    //建立 TCP 客户端连接:host 格式 "ip:port",成功返回句柄,失败返回 -1
    int connect(const std::string& host)
    {
        ensureInit();
        const auto pos = host.rfind(':');
        if (pos == std::string::npos) return -1;
        const std::string ip = host.substr(0, pos);
        const std::string port = host.substr(pos + 1);
        addrinfo hints{};
        hints.ai_family = AF_UNSPEC;
        hints.ai_socktype = SOCK_STREAM;
        addrinfo* res = nullptr;
        if (getaddrinfo(ip.c_str(), port.c_str(), &hints, &res) != 0) return -1;
        auto sock = INVALID_SOCKET;
        for (addrinfo* p = res; p != nullptr; p = p->ai_next)
        {
            sock = ::socket(p->ai_family, p->ai_socktype, p->ai_protocol);
            if (sock == INVALID_SOCKET) continue;
            if (::connect(sock, p->ai_addr, static_cast<int>(p->ai_addrlen)) == 0) break;
            closesocket(sock);
            sock = INVALID_SOCKET;
        }
        freeaddrinfo(res);
        if (sock == INVALID_SOCKET) return -1;
        const int handle = nextHandle++;
        conns[handle] = sock;
        return handle;
    }
    ~NetRuntime()
    {
        //析构时关闭仍持有的连接,避免 socket 句柄泄漏
        for (const auto& [handle, sock] : conns)
            closesocket(sock);
        conns.clear();
    }
    bool send(const int handle, const std::string& data)
    {
        const auto it = conns.find(handle);
        return it != conns.end() && sendBytes(it->second, data.data(), data.size());
    }
    bool send(const int handle, const std::vector<char>& data)
    {
        const auto it = conns.find(handle);
        return it != conns.end() && sendBytes(it->second, data.data(), data.size());
    }
    bool send(const int handle, const void* data, const size_t size)
    {
        const auto it = conns.find(handle);
        return it != conns.end() &&
               sendBytes(it->second, static_cast<const char*>(data), size);
    }
    bool recv(const int handle, const size_t n, std::string& out)
    {
        const auto it = conns.find(handle);
        if (it == conns.end() || n == 0) return false;
        out.resize(n);
        return recvBytes(it->second, out.data(), n);
    }
    bool recv(const int handle, const size_t n, std::vector<char>& out)
    {
        const auto it = conns.find(handle);
        if (it == conns.end() || n == 0) return false;
        out.resize(n);
        return recvBytes(it->second, out.data(), n);
    }
    void close(const int handle)
    {
        if (const auto it = conns.find(handle); it != conns.end())
        {
            closesocket(it->second);
            conns.erase(it);
        }
    }
};
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
    Thread(Thread&&) noexcept = default;
    Thread& operator=(Thread&&) noexcept = default;
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
namespace fs = std::filesystem;
inline std::string readFile(const std::string& local)
{
    //istreambuf_iterator 逐字符读极慢,改为 ate 定位 + 预分配整块读
    std::ifstream in(local, std::ios::binary | std::ios::ate);
    if (!in) return "";
    const auto size = in.tellg();
    if (size <= 0) return "";
    in.seekg(0);
    std::string content(static_cast<size_t>(size), '\0');
    in.read(content.data(), size);
    if (in.gcount() != size) return "";
    return content;
}
inline std::vector<char> readBinary(const std::string& local)
{
    std::ifstream in(local, std::ios::binary | std::ios::ate);
    if (!in) return {};
    const auto size = in.tellg();
    if (size <= 0) return {};
    in.seekg(0);
    std::vector<char> buf(static_cast<size_t>(size));
    in.read(buf.data(), size);
    if (in.gcount() != size) return {};
    return buf;
}
inline bool exists(const std::string& local)
{
    std::error_code ec;
    return fs::exists(local, ec);
}
inline bool isFile(const std::string& local)
{
    std::error_code ec;
    return fs::is_regular_file(local, ec);
}
inline bool isFolder(const std::string& local)
{
    std::error_code ec;
    return fs::is_directory(local, ec);
}
inline std::vector<std::string> children(const std::string& local)
{
    std::vector<std::string> result;
    result.reserve(16);   //常见目录条目数,避免多次扩容
    for (std::error_code ec; const auto& entry : fs::directory_iterator(local, ec))
        result.push_back(entry.path().filename().string());
    return result;
}
inline bool writeFile(const std::string& local, const std::string& data)
{
    std::ofstream out(local, std::ios::binary | std::ios::trunc);
    if (!out) return false;
    out.write(data.data(), static_cast<std::streamsize>(data.size()));
    return static_cast<bool>(out);
}
inline bool writeFile(const std::string& local, const char* data, const size_t size)
{
    std::ofstream out(local, std::ios::binary | std::ios::trunc);
    if (!out) return false;
    out.write(data, static_cast<std::streamsize>(size));
    return static_cast<bool>(out);
}
inline bool createDictionary(const std::string& local)
{
    std::error_code ec;
    return fs::create_directories(local, ec);
}
inline bool createFile(const std::string& local)
{
    std::ofstream out(local, std::ios::binary);
    return out.is_open();
}
inline bool deleteFile(const std::string& local)
{
    std::error_code ec;
    return fs::remove(local, ec);
}
inline bool deleteFolder(const std::string& local)
{
    std::error_code ec;
    return fs::remove_all(local, ec);
}
inline void console(const std::string& data)
{
    //多线程(thread 指令)并发输出需互斥,否则交错/丢失
    //保持 std::cout+flush 语义(io 单测经 rdbuf 重定向捕获输出,不能改输出通道;
    //sync_with_stdio 关闭时机与 ios_base::Init 静态初始化顺序无保证,不可用)
    static std::mutex out_mtx;
    std::lock_guard<std::mutex> lock(out_mtx);
    std::cout << data << std::flush;
}
inline void read(std::string* data)
{
    std::getline(std::cin,*data);
}
inline std::string cwd()
{
    return fs::current_path().string();
}
inline std::string home()
{
#ifdef _WIN32
    const char* home = std::getenv("USERPROFILE");
    if (home) return std::string(home);
    const char* drive = std::getenv("HOMEDRIVE");
    const char* path = std::getenv("HOMEPATH");
    if (drive && path) return std::string(drive) + path;
    return "";
#else
    const char* home = std::getenv("HOME");
    if (home) return std::string(home);
    struct passwd* pw = getpwuid(getuid());
    if (pw && pw->pw_dir) return std::string(pw->pw_dir);
    return "";
#endif
}
inline uint64_t CPUNumber()
{
    return std::thread::hardware_concurrency();
}
inline uint64_t MemoryNumber()
{
#ifdef _WIN32
    MEMORYSTATUSEX ms{};
    ms.dwLength = sizeof(ms);
    if (GlobalMemoryStatusEx(&ms)) return ms.ullTotalPhys;
    return 0;
#else
    const auto pages = sysconf(_SC_PHYS_PAGES);
    const auto pageSize = sysconf(_SC_PAGESIZE);
    if (pages < 0 || pageSize < 0) return 0;
    return static_cast<uint64_t>(pages) * static_cast<uint64_t>(pageSize);
#endif
}
inline uint64_t DiskNumber()
{
#ifdef _WIN32
    uint64_t total = 0;
    const DWORD mask = GetLogicalDrives();
    for (int i = 0; i < 26; ++i)
    {
        if (!(mask & (1u << i))) continue;
        wchar_t root[] = L"A:\\";
        root[0] = static_cast<wchar_t>(L'A' + i);
        ULARGE_INTEGER bytes{};
        if (GetDiskFreeSpaceExW(root, nullptr, &bytes, nullptr))
            total += bytes.QuadPart;
    }
    return total;
#else
    std::error_code ec;
    const auto info = fs::space("/", ec);
    return ec ? 0 : info.capacity;
#endif
}
//vm占的内存
inline uint64_t Memory()
{
#ifdef _WIN32
    PROCESS_MEMORY_COUNTERS pmc{};
    if (GetProcessMemoryInfo(GetCurrentProcess(), &pmc, sizeof(pmc)))
        return pmc.WorkingSetSize;
    return 0;
#elif __APPLE__
    task_vm_info_data_t info{};
    mach_msg_type_number_t count = TASK_VM_INFO_COUNT;
    if (task_info(mach_task_self(), TASK_VM_INFO,
                  reinterpret_cast<task_info_t>(&info), &count) == KERN_SUCCESS)
        return info.phys_footprint;
    return 0;
#elif __linux__
    std::ifstream in("/proc/self/statm");
    uint64_t pages = 0;
    if (in >> pages)
        return pages * static_cast<uint64_t>(sysconf(_SC_PAGESIZE));
    return 0;
#else
    return 0;
#endif
}
//执行控制台命令,返回退出状态:0=成功(供 shell 端口 boolean 判定)
inline int exec(const std::string& command)
{
#ifdef _WIN32
    return std::system(command.c_str());
#else
    const int st = std::system(command.c_str());
    if (st == -1) return -1;
    if (WIFEXITED(st)) return WEXITSTATUS(st);
    return 1;
#endif
}
#endif