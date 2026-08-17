//runtime/io.cpp 端口测试:system/file/shell,net 需真实连接暂不覆盖
//对象变量槽自引用(存自己的槽号)作为对象 id;offset[obj][键池id]=元素变量
//测试名一律 ASCII
#include "runtime.h"
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

TEST_CASE("io: map completeness", "[io]")
{
    const auto table = io();
    REQUIRE(table.size() == 8);
    for (int op = 148; op <= 155; op++)
        REQUIRE(table.count(op) == 1);
}
