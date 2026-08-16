//model.h 单元测试:Stack/ConstPool(引用计数GC)/VarPool(读写+任务队列)
//测试名一律 ASCII:Windows+MinGW 下中文测试名经 ctest 传参会编码错乱
#include "model.h"
#include <catch2/catch_test_macros.hpp>
#include <unordered_map>

TEST_CASE("stack: push/pop/peek/size", "[model]")
{
    Stack<int> s;
    REQUIRE(s.size() == 0);
    s.push(1);
    s.push(2);
    s.push(3);
    REQUIRE(s.size() == 3);
    REQUIRE(s.peek() == 3);
    REQUIRE(s.pop() == 3);
    REQUIRE(s.pop() == 2);
    REQUIRE(s.pop() == 1);
    REQUIRE(s.size() == 0);
}

TEST_CASE("const pool: link dedup", "[model]")
{
    ConstPool pool;
    const int s1 = pool.link(std::string("hello"));
    const int s2 = pool.link(std::string("hello"));
    REQUIRE(s1 == s2);
    const int n1 = pool.link(1.5);
    const int n2 = pool.link(1.5);
    REQUIRE(n1 == n2);
    //数字与字符串互不影响
    REQUIRE(pool.link(2.5) != s1);
}

TEST_CASE("const pool: string refcount gc frees", "[model]")
{
    ConstPool pool;
    const int id = pool.link(std::string("hello"));
    pool.link(std::string("hello"));   //引用计数+1
    pool.delete_(id);
    pool.delete_(id);                  //计数归零→入gcList
    pool.gc();
    //已释放,重新link得到新id
    REQUIRE(pool.link(std::string("hello")) != id);
}

TEST_CASE("const pool: number refcount gc frees", "[model]")
{
    //修复B:link(double)必须初始化refCount=1,否则数字常量永远无法回收
    ConstPool pool;
    const int id = pool.link(2.5);
    pool.delete_(id);
    pool.gc();
    REQUIRE(pool.link(2.5) != id);
}

TEST_CASE("const pool: init entries gc-able", "[model]")
{
    //修复C:init装载的条目refCount=1,delete_后才能进入gc
    ConstPool pool;
    std::unordered_map<int, double> num{{10, 3.14}};
    std::unordered_map<int, std::string> str{{20, "init_str"}};
    pool.init(num, str);
    pool.delete_(10);
    pool.gc();
    REQUIRE(pool.link(3.14) != 10);
    pool.delete_(20);
    pool.gc();
    REQUIRE(pool.link(std::string("init_str")) != 20);
}

TEST_CASE("const pool: delete unknown id safe", "[model]")
{
    ConstPool pool;
    pool.delete_(999);   //未知id应无副作用
    pool.gc();
    const int id = pool.link(std::string("x"));
    REQUIRE(pool.link(std::string("x")) == id);
}

TEST_CASE("var pool: read/write var/offset/name", "[model]")
{
    VarPool pool;
    VarPool::unsafeWriteVar(&pool, 1, 100);
    REQUIRE(VarPool::unsafeReadVar(&pool, 1) == 100);
    VarPool::unsafeWriteOffset(&pool, 2, 3, 200);
    REQUIRE(VarPool::unsafeReadOffset(&pool, 2, 3) == 200);
    VarPool::unsafeWriteName(&pool, 4, "key", 300);
    REQUIRE(VarPool::unsafeReadName(&pool, 4, "key") == 300);
    //带锁版本
    VarPool::writeVar(&pool, 5, 400);
    REQUIRE(VarPool::readVar(&pool, 5) == 400);
    VarPool::writeOffset(&pool, 6, 7, 500);
    REQUIRE(VarPool::readOffset(&pool, 6, 7) == 500);
    VarPool::writeName(&pool, 8, "k2", 600);
    REQUIRE(VarPool::readName(&pool, 8, "k2") == 600);
}

//任务回调:记录收到的原始操作数(TaskRun 新签名:VarPool* 首参 + 3 个 int)
static int g_a0 = 0;
static int g_a1 = 0;
static int g_a2 = 0;
static int g_calls = 0;
static void task_run(VarPool*,
                     void(*)(VarPool*, int, int),
                     void(*)(VarPool*, int, int, int),
                     void(*)(VarPool*, int, const std::string&, int),
                     int a, int b, int c)
{
    g_a0 = a;
    g_a1 = b;
    g_a2 = c;
    g_calls++;
}

TEST_CASE("var pool: task runs when unlocked", "[model]")
{
    VarPool pool;
    VarPool::unsafeWriteVar(&pool, 5, 42);
    Task task;
    task.cond = {{5, false, 0, ""}};
    task.run = task_run;
    g_calls = 0;
    pool.oper(task);   //var 5未锁→立即执行
    REQUIRE(g_calls == 1);
    REQUIRE(g_a0 == 5);   //传原始操作数id,不解析值
    REQUIRE(g_a1 == 0);
    REQUIRE(g_a2 == 0);   //不足3个cond时补0
}

TEST_CASE("var pool: task queued while locked then runs on unlock", "[model]")
{
    VarPool pool;
    VarPool::lock_var(&pool, 5);
    Task task;
    task.cond = {{5, false, 0, ""}};
    task.run = task_run;
    g_calls = 0;
    pool.oper(task);   //var 5被锁→入队
    REQUIRE(g_calls == 0);
    VarPool::writeVar(&pool, 5, 100);   //writeVar内部unlock→弹出队首执行
    REQUIRE(g_calls == 1);
    REQUIRE(g_a0 == 5);
}

TEST_CASE("var pool: task with offset and name conds", "[model]")
{
    VarPool pool;
    VarPool::unsafeWriteOffset(&pool, 3, 7, 111);
    VarPool::unsafeWriteName(&pool, 9, "k", 222);
    Task task;
    task.cond = {{3, true, 7, ""}, {9, true, -1, "k"}};
    task.run = task_run;
    g_calls = 0;
    pool.oper(task);
    REQUIRE(g_calls == 1);
    REQUIRE(g_a0 == 3);   //原始id:offset(3,7) 与 name(9,"k")
    REQUIRE(g_a1 == 9);
}

TEST_CASE("var pool: blocked front task not duplicated on unlock", "[model]")
{
    //修复F:解锁时弹出队首再执行;旧代码队首仍被锁时会重复入队导致同一任务执行多次
    VarPool pool;
    VarPool::lock_var(&pool, 6);
    VarPool::lock_var(&pool, 7);
    Task t6;
    t6.cond = {{6, false, 0, ""}};
    t6.run = task_run;
    Task t7;
    t7.cond = {{7, false, 0, ""}};
    t7.run = task_run;
    g_calls = 0;
    pool.oper(t6);
    pool.oper(t7);
    VarPool::unlock_var(&pool, 7);   //弹队首t6(仍锁6)→重新入队
    VarPool::unlock_var(&pool, 6);   //弹t7(7已解锁)→t7执行
    VarPool::unlock_var(&pool, 6);   //弹t6(6已解锁)→t6执行
    //每个任务恰好执行一次;旧代码t6会因未出队被反复执行
    REQUIRE(g_calls == 2);
}

TEST_CASE("const pool: get string and number", "[model]")
{
    ConstPool pool;
    const int sid = pool.link(std::string("hello"));
    const int nid = pool.link(2.5);
    const Const sc = pool.get(sid);
    REQUIRE(sc.type == false);
    REQUIRE(std::string(sc.str) == "hello");
    const Const nc = pool.get(nid);
    REQUIRE(nc.type == true);
    REQUIRE(nc.num == 2.5);
}

TEST_CASE("const pool: get unknown id safe", "[model]")
{
    ConstPool pool;
    const Const c = pool.get(999);   //未知id:不崩溃、不污染池
    REQUIRE(c.type == false);
    REQUIRE(c.num == 0);
    REQUIRE(c.str.empty());
    const int id = pool.link(std::string("x"));
    REQUIRE(pool.link(std::string("x")) == id);
}

TEST_CASE("var pool: init loads const pool", "[model]")
{
    VarPool pool;
    std::unordered_map<int, double> num{{10, 3.14}};
    std::unordered_map<int, std::string> str{{20, "s"}};
    pool.init(num, str);
    const Const n = pool.data.get(10);
    REQUIRE(n.type == true);
    REQUIRE(n.num == 3.14);
    const Const s = pool.data.get(20);
    REQUIRE(s.type == false);
    REQUIRE(std::string(s.str) == "s");
}
