//单元测试:utils 的网络与进程级接口(Net / NetPool / init / print)
#include <catch2/catch_all.hpp>

#include <string>
#include <vector>

#include "../../main.h"

TEST_CASE("utils-net 连接失败时不抛异常且处于未连接态", "[utils]")
{
    //127.0.0.1 的 1 号端口不会有服务在听,连接必然失败
    util::Net n("127.0.0.1:1");
    REQUIRE_FALSE(n.connected());
    REQUIRE(n.send("x") == "not connected");
    REQUIRE(n.recv(4).empty());
}

TEST_CASE("utils-net 地址里没有端口号时不连接", "[utils]")
{
    util::Net n("127.0.0.1");
    REQUIRE_FALSE(n.connected());
}

TEST_CASE("utils-net 空地址不崩", "[utils]")
{
    util::Net n("");
    REQUIRE_FALSE(n.connected());
}

TEST_CASE("utils-net close 可以重复调用", "[utils]")
{
    util::Net n("127.0.0.1:1");
    n.close();
    n.close();
    REQUIRE_FALSE(n.connected());
}

TEST_CASE("utils-net 移动之后原对象变成未连接", "[utils]")
{
    util::Net a("127.0.0.1:1");
    util::Net b(std::move(a));
    REQUIRE_FALSE(b.connected());
    REQUIRE_FALSE(a.connected());
}

TEST_CASE("utils-net recv 负数长度返回空", "[utils]")
{
    util::Net n("127.0.0.1:1");
    REQUIRE(n.recv(-1).empty());
    REQUIRE(n.recv(0).empty());
}

TEST_CASE("utils-net NetPool 连接失败返回 -1 且不留下句柄", "[utils]")
{
    util::NetPool pool;
    const int id = pool.connect("127.0.0.1:1");
    REQUIRE(id == -1);
    REQUIRE(pool.send(id, "x") == "unknown handle");
    //关闭一个不存在的句柄不崩
    pool.close(id);
}

TEST_CASE("utils-net NetPool 关闭未知句柄不影响后面的操作", "[utils]")
{
    util::NetPool pool;
    pool.close(12345);
    REQUIRE(pool.connect("127.0.0.1:1") == -1);
}

TEST_CASE("utils-init 保存命令行参数", "[utils]")
{
    util::init({"prog", "a.sbin", "--flag"});
    REQUIRE(util::args.size() == 3);
    REQUIRE(util::args[1] == "a.sbin");
    REQUIRE(util::args[2] == "--flag");
}
