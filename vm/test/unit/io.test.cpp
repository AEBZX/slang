//runtime/io.cpp 端口测试:system/file/shell,net 需真实连接暂不覆盖
//对象变量槽自引用(存自己的槽号)作为对象 id;offset[obj][键池id]=元素变量
//测试名一律 ASCII
#include "runtime.h"
#include "gui.h"
#include <catch2/catch_test_macros.hpp>
#include <sstream>

namespace {
CommandRun cmd(const int op)
{
    return io().at(op);
}
struct Mini
{
    VarPool pool;
    Command cmds;
    Runtime rt;
    Mini()
    {
        rt.pool = &pool;
        rt.command = &cmds;
        rt.block = 0;
        rt.index = 0;
    }
    int slot(const int id) { return VarPool::unsafeReadVar(&pool, id); }
    int pnum(const int id) { return (int)pool.data.get(slot(id)).num; }
    void write(const int id, const int v) { VarPool::unsafeWriteVar(&pool, id, v); }
    int port_id(const char* port) { return pool.data.link(std::string(port)); }
    //对象字段:offset[obj][键池id] = 新变量,存字符串值
    void set_str(const int obj, const char* key, const std::string& value)
    {
        const int k = pool.data.link(std::string(key));
        const int v = pool.alloc();
        VarPool::unsafeWriteVar(&pool, v, pool.data.link(value));
        VarPool::unsafeWriteOffset(&pool, obj, k, v);
    }
    void set_num(const int obj, const char* key, const int value)
    {
        const int k = pool.data.link(std::string(key));
        const int v = pool.alloc();
        VarPool::unsafeWriteVar(&pool, v, pool.data.link((double)value));
        VarPool::unsafeWriteOffset(&pool, obj, k, v);
    }
    //数组对象:offset[obj][整型下标] = 元素变量(与 in_port 写数组的格式一致)
    void set_byte(const int arr, const int index, const int value)
    {
        const int v = pool.alloc();
        VarPool::unsafeWriteVar(&pool, v, pool.data.link((double)value));
        VarPool::unsafeWriteOffset(&pool, arr, index, v);
    }
    //读对象字段的池字符串
    std::string obj_str(const int obj, const char* key)
    {
        const int k = pool.data.link(std::string(key));
        const int vid = VarPool::unsafeReadOffset(&pool, obj, k);
        return std::string(pool.data.get(VarPool::unsafeReadVar(&pool, vid)).str);
    }
};
}

TEST_CASE("io: system port core_num/memory", "[io]")
{
    Mini m;
    m.write(100, m.port_id("system"));
    m.write(101, m.port_id("core_num"));
    cmd(155)(&m.rt, 100, 101, 0);   //out value value: system 端口 + 'core_num'
    cmd(150)(&m.rt, 100, 5, 0);   //in: target 槽5
    REQUIRE(m.pnum(5) >= 1);
    //memory_self > 0
    m.write(101, m.port_id("memory_self"));
    cmd(155)(&m.rt, 100, 101, 0);
    cmd(150)(&m.rt, 100, 6, 0);
    REQUIRE(m.pnum(6) > 0);
}

TEST_CASE("io: file port write/exist/read roundtrip", "[io]")
{
    Mini m;
    const std::string f = (fs::temp_directory_path() / "slang_io_test.txt").string();
    m.write(100, m.port_id("file"));
    //对象:槽10 自引用(对象id=10)
    m.write(10, 10);
    //write: {type:'write', name:路径, data:'hello'}
    m.set_str(10, "type", "write");
    m.set_str(10, "name", f);
    m.set_str(10, "data", "hello");
    cmd(155)(&m.rt, 100, 10, 0);   //out
    cmd(150)(&m.rt, 100, 5, 0);    //in: boolean
    REQUIRE(m.pnum(5) == 1);

    //exist: {type:'exist', type:'file', name:路径}
    m.set_str(10, "type", "exist");
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 6, 0);
    REQUIRE(m.pnum(6) == 1);

    //read(text): {type:'read', name:路径, mode:'text'}
    m.set_str(10, "type", "read");
    m.set_str(10, "mode", "text");
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 7, 0);    //in: string
    const int pid = m.slot(7);
    REQUIRE(std::string(m.pool.data.get(pid).str) == "hello");

    fs::remove(f);
}

TEST_CASE("io: file port find returns array", "[io]")
{
    Mini m;
    const auto dir = fs::temp_directory_path() / "slang_io_dir";
    fs::remove_all(dir);
    fs::create_directories(dir);
    {
        std::ofstream out((dir / "a.txt").string());
        out << "x";
    }
    {
        std::ofstream out((dir / "b.txt").string());
        out << "y";
    }
    m.write(100, m.port_id("file"));
    m.write(10, 10);
    m.set_str(10, "type", "find");
    m.set_str(10, "name", dir.string());
    cmd(155)(&m.rt, 100, 10, 0);
    //find 结果数组:offset[target][i] 元素变量
    cmd(150)(&m.rt, 100, 20, 0);   //in: target 槽20(数组对象)
    const int v0 = VarPool::unsafeReadOffset(&m.pool, 20, 0);
    const int v1 = VarPool::unsafeReadOffset(&m.pool, 20, 1);
    REQUIRE(v0 >= 0);
    REQUIRE(v1 >= 0);
    const std::string s0 = std::string(m.pool.data.get(VarPool::unsafeReadVar(&m.pool, v0)).str);
    const std::string s1 = std::string(m.pool.data.get(VarPool::unsafeReadVar(&m.pool, v1)).str);
    REQUIRE(((s0 == "a.txt" && s1 == "b.txt") || (s0 == "b.txt" && s1 == "a.txt")));
    fs::remove_all(dir);
}

TEST_CASE("io: shell print", "[io]")
{
    Mini m;
    std::stringstream ss;
    auto* old = std::cout.rdbuf(ss.rdbuf());
    m.write(100, m.port_id("shell"));
    m.write(10, 10);
    m.set_str(10, "type", "print");
    m.set_str(10, "data", "hello-io");
    cmd(155)(&m.rt, 100, 10, 0);
    std::cout.rdbuf(old);
    REQUIRE(ss.str() == "hello-io");
}

TEST_CASE("io: file write bin mode roundtrip", "[io]")
{
    Mini m;
    const std::string f = (fs::temp_directory_path() / "slang_io_bin.bin").string();
    fs::remove(f);
    m.write(100, m.port_id("file"));
    m.write(10, 10);
    //数组对象:槽11(元素放 offset[11][i])
    m.write(11, 11);
    m.set_byte(11, 0, 0x48);   // 'H'
    m.set_byte(11, 1, 0x69);   // 'i'
    m.set_byte(11, 2, 0x00);   // 含 0x00,验证不是按字符串处理
    m.set_byte(11, 3, 0xff);
    //write: {type:'write', mode:'bin', name:路径, data:数组}
    m.set_str(10, "type", "write");
    m.set_str(10, "mode", "bin");
    m.set_str(10, "name", f);
    m.set_num(10, "data", 11);
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 5, 0);
    REQUIRE(m.pnum(5) == 1);
    //read bin 还原字节
    m.set_str(10, "type", "read");
    m.set_str(10, "mode", "bin");
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 20, 0);   //in: number[] 数组对象
    REQUIRE(VarPool::unsafeReadVar(&m.pool, VarPool::unsafeReadOffset(&m.pool, 20, 0)) >= 0);
    const auto byte = [&](const int i) {
        return (int)m.pool.data.get(VarPool::unsafeReadVar(&m.pool, VarPool::unsafeReadOffset(&m.pool, 20, i))).num;
    };
    REQUIRE(byte(0) == 0x48);
    REQUIRE(byte(1) == 0x69);
    REQUIRE(byte(2) == 0x00);
    REQUIRE(byte(3) == 0xff);
    fs::remove(f);
}

TEST_CASE("io: file exist with mode field", "[io]")
{
    Mini m;
    const auto dir = fs::temp_directory_path() / "slang_io_mode";
    const auto file = dir / "x.txt";
    fs::remove_all(dir);
    fs::create_directories(dir);
    { std::ofstream out(file.string()); out << "x"; }
    m.write(100, m.port_id("file"));
    m.write(10, 10);
    m.set_str(10, "name", dir.string());
    //mode:'folder' 命中目录
    m.set_str(10, "type", "exist");
    m.set_str(10, "mode", "folder");
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 5, 0);
    REQUIRE(m.pnum(5) == 1);
    //mode:'file' 对目录不命中
    m.set_str(10, "mode", "file");
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 6, 0);
    REQUIRE(m.pnum(6) == 0);
    //mode:'file' 命中文件
    m.set_str(10, "name", file.string());
    m.set_str(10, "mode", "file");
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 7, 0);
    REQUIRE(m.pnum(7) == 1);
    //mode:'all' 命中
    m.set_str(10, "mode", "all");
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 8, 0);
    REQUIRE(m.pnum(8) == 1);
    //不存在的路径 mode:'all' 不命中
    m.set_str(10, "name", (dir / "nope").string());
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 9, 0);
    REQUIRE(m.pnum(9) == 0);
    fs::remove_all(dir);
}

TEST_CASE("io: file create/delete with mode field", "[io]")
{
    Mini m;
    const auto dir = fs::temp_directory_path() / "slang_io_cd";
    const auto sub = dir / "sub";
    const auto file = dir / "a.txt";
    fs::remove_all(dir);
    m.write(100, m.port_id("file"));
    m.write(10, 10);
    //create 目录
    m.set_str(10, "type", "create");
    m.set_str(10, "mode", "folder");
    m.set_str(10, "name", sub.string());
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 5, 0);
    REQUIRE(m.pnum(5) == 1);
    REQUIRE(isFolder(sub.string()));
    //create 文件
    m.set_str(10, "mode", "file");
    m.set_str(10, "name", file.string());
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 6, 0);
    REQUIRE(m.pnum(6) == 1);
    REQUIRE(isFile(file.string()));
    //delete 文件
    m.set_str(10, "type", "delete");
    m.set_str(10, "mode", "file");
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 7, 0);
    REQUIRE(m.pnum(7) == 1);
    REQUIRE(!exists(file.string()));
    //delete 目录
    m.set_str(10, "mode", "folder");
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 8, 0);
    REQUIRE(m.pnum(8) == 1);
    REQUIRE(!exists(sub.string()));
    fs::remove_all(dir);
}

TEST_CASE("io: shell command returns success boolean", "[io]")
{
    Mini m;
    m.write(100, m.port_id("shell"));
    m.write(10, 10);
    m.set_str(10, "type", "shell");
    //成功命令 → 1
    m.set_str(10, "data", "exit 0");
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 5, 0);
    REQUIRE(m.pnum(5) == 1);
    //失败命令 → 0
    m.set_str(10, "data", "exit 1");
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 6, 0);
    REQUIRE(m.pnum(6) == 0);
}

TEST_CASE("io: GUI port routing", "[io]")
{
    Mini m;
    m.write(100, m.port_id("GUI"));
    m.write(10, 10);
    m.set_str(10, "type", "GUI");
    m.set_str(10, "title", "t");
    m.set_str(10, "data", "<html>hi</html>");
    cmd(155)(&m.rt, 100, 10, 0);
    cmd(150)(&m.rt, 100, 5, 0);
    //非 Windows 或无 WebView2 时为 0(不可用);有 WebView2 时为 1(已接受异步打开)
    REQUIRE((m.pnum(5) == 1 || m.pnum(5) == 0));
    //若真的打开了窗口,收尾关闭,避免测试残留窗口
    if (gui::window_count() > 0)
        gui::close_all();
}

TEST_CASE("io: map completeness", "[io]")
{
    const auto table = io();
    REQUIRE(table.size() == 8);
    for (int op = 148; op <= 155; op++)
        REQUIRE(table.count(op) == 1);
}
