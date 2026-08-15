//utils.h 单元测试:文件操作/线程/系统信息/网络句柄
#include "utils.h"
#include <catch2/catch_test_macros.hpp>
#include <chrono>

namespace {
//每个用例独立的临时目录,结尾清理
fs::path make_dir()
{
    static int n = 0;
    auto d = fs::temp_directory_path() / ("slang_utils_test_" + std::to_string(n++));
    fs::remove_all(d);
    fs::create_directories(d);
    return d;
}
class CounterThread : public Thread
{
private:
    int* counter;
public:
    explicit CounterThread(int* c) : counter(c) {}
    void run() override
    {
        for (int i = 0; i < 100; i++) (*counter)++;
    }
};
}

//Windows+MinGW 下 Catch2 测试名若含中文,ctest 传参经 ANSI 代码页转码会匹配失败,测试名一律用 ASCII
TEST_CASE("utils file: write/read/binary/dir", "[utils]")
{
    const auto dir = make_dir();
    const auto f = (dir / "a.txt").string();
    const auto sub = (dir / "sub" / "deep").string();

    //文本写读回
    REQUIRE(writeFile(f, "hello"));
    REQUIRE(exists(f));
    REQUIRE(isFile(f));
    REQUIRE_FALSE(isFolder(f));
    REQUIRE(readFile(f) == "hello");

    //二进制(含 \0)写读回
    const std::vector<char> bin = {'a', '\0', 'b', 'c'};
    REQUIRE(writeFile(f, bin.data(), bin.size()));
    REQUIRE(readBinary(f) == bin);

    //目录
    REQUIRE(createDictionary(sub));
    REQUIRE(isFolder(sub));
    REQUIRE_FALSE(isFile(sub));
    //MinGW 下 fs::path 底层是 wchar_t,需显式 .string() 转回 std::string
    REQUIRE(children(dir.string()).size() >= 1);

    //createFile
    const auto g = (dir / "empty.txt").string();
    REQUIRE(createFile(g));
    REQUIRE(exists(g));

    fs::remove_all(dir);
}

TEST_CASE("utils file: missing/invalid paths", "[utils]")
{
    const auto dir = make_dir();
    const auto missing = (dir / "no_such").string();

    REQUIRE_FALSE(exists(missing));
    REQUIRE_FALSE(isFile(missing));
    REQUIRE_FALSE(isFolder(missing));
    REQUIRE(readFile(missing).empty());
    REQUIRE(readBinary(missing).empty());
    REQUIRE_FALSE(writeFile((dir / "x" / "y.txt").string(), "z")); //父目录不存在

    fs::remove_all(dir);
}

TEST_CASE("utils thread: runnable/thread/join/sleep", "[utils]")
{
    int x = 0;
    FunctionRunnable r([&x] { x = 42; });
    r.run();
    REQUIRE(x == 42);

    int c = 0;
    CounterThread t(&c);
    t.start();
    t.join();
    REQUIRE(c == 100);

    //重复 join 安全
    t.join();
    REQUIRE(c == 100);

    const auto begin = std::chrono::steady_clock::now();
    Thread::sleep(50);
    REQUIRE(std::chrono::steady_clock::now() - begin >= std::chrono::milliseconds(50));
    REQUIRE_FALSE(Thread::currentThreadId() == std::thread::id());
}

TEST_CASE("utils sysinfo: cpu/memory/disk/process", "[utils]")
{
    REQUIRE(CPUNumber() >= 1);
    REQUIRE(MemoryNumber() > 0);
    REQUIRE(DiskNumber() > 0);
    REQUIRE(Memory() > 0);
}

TEST_CASE("utils net: unknown handle safe-fail", "[utils]")
{
    NetRuntime net;
    REQUIRE_FALSE(net.send(999, "x"));
    REQUIRE_FALSE(net.send(999, std::vector<char>{'a'}));
    REQUIRE_FALSE(net.send(999, "data", 4));
    std::string s;
    REQUIRE_FALSE(net.recv(999, 4, s));
    std::vector<char> v;
    REQUIRE_FALSE(net.recv(999, 4, v));
    //close 不存在的句柄应无副作用
    net.close(999);
    REQUIRE(true);
}
