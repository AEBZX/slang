//runtime/basic.cpp + math.cpp 指令 handler 单元测试
//handler 经 basic()/math() 映射表按 opcode 取用
//语义:槽存 pool_id;load(reg源)=池id原样存槽(编译器load发池id);mov reg源=原样;value源=var读;reg源不再池反查
//测试名一律 ASCII
#include "runtime.h"
#include <catch2/catch_test_macros.hpp>

namespace {
CommandRun cmd(const int op)
{
    const auto& b = basic();
    const auto it = b.find(op);
    if (it != b.end()) return it->second;
    return math().at(op);
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
    int link_num(const double v) { return pool.data.link(v); }
};
}

TEST_CASE("basic: mov variants", "[runtime]")
{
    Mini m;
    cmd(0)(&m.rt, 1, 5, 0);            //MOV_R_R: reg源原样 → var[1]=5(地址/槽号语义)
    REQUIRE(m.slot(1) == 5);
    //value 源 = var 读:先 load 槽5 = 池id
    const int c100 = m.link_num(100.0);
    cmd(84)(&m.rt, 5, c100, 0);        //LOAD: var[5]=c100
    cmd(1)(&m.rt, 2, 5, 0);            //MOV_R_V: var[2]=var[5]=c100
    REQUIRE(m.slot(2) == c100);
    REQUIRE(m.pnum(2) == 100);
}

TEST_CASE("basic: load", "[runtime]")
{
    Mini m;
    const int cid = m.link_num(42.0);
    cmd(84)(&m.rt, 1, cid, 0);         //LOAD_R_R: var[1]=池id原样(编译器load发池id,特例)
    REQUIRE(m.slot(1) == cid);
    REQUIRE(m.pnum(1) == 42);
    cmd(85)(&m.rt, 2, 1, 0);           //LOAD_R_V: var[2]=var[1](复制池id)
    REQUIRE(m.slot(2) == cid);
}

TEST_CASE("basic: cmp", "[runtime]")
{
    Mini m;
    const int c5 = m.link_num(5.0);
    cmd(84)(&m.rt, 1, c5, 0);          //var[1]=c5(池值5)
    cmd(110)(&m.rt, 1, 5, 0);          //L=5,R=pv(reg)=5,C=0(==) → link(1)
    REQUIRE(m.pnum(1) == 1);
    const int c3 = m.link_num(3.0);
    cmd(84)(&m.rt, 2, c3, 0);
    cmd(110)(&m.rt, 2, 5, 1);          //3!=5 → 1
    REQUIRE(m.pnum(2) == 1);
    const int c7 = m.link_num(7.0);
    cmd(84)(&m.rt, 3, c7, 0);
    cmd(110)(&m.rt, 3, 5, 2);          //7>5 → 1
    REQUIRE(m.pnum(3) == 1);
    const int c4 = m.link_num(4.0);
    cmd(84)(&m.rt, 4, c4, 0);
    cmd(110)(&m.rt, 4, 5, 3);          //4<5 → 1
    REQUIRE(m.pnum(4) == 1);
    cmd(84)(&m.rt, 5, c5, 0);
    cmd(110)(&m.rt, 5, 5, 4);          //5>=5 → 1
    REQUIRE(m.pnum(5) == 1);
    const int c6 = m.link_num(6.0);
    cmd(84)(&m.rt, 6, c6, 0);
    cmd(110)(&m.rt, 6, 5, 5);          //6<=5 → 0
    REQUIRE(m.pnum(6) == 0);
}

TEST_CASE("basic: offset set/get/addr", "[runtime]")
{
    Mini m;
    //offset[1][2] 不存在 → 新建变量(alloc 随机高位id),offset[1][2]=vid,var[vid]=link(30)
    cmd(124)(&m.rt, 1, 2, 30);
    REQUIRE(m.pool.hasOffset(1, 2));
    const int vid = VarPool::unsafeReadOffset(&m.pool, 1, 2);
    REQUIRE(VarPool::unsafeReadVar(&m.pool, vid) == 30);   //src(reg)=原样
    cmd(124)(&m.rt, 1, 2, 40);         //复用同一变量
    REQUIRE(VarPool::unsafeReadVar(&m.pool, vid) == 40);   //复用,重写值
    cmd(132)(&m.rt, 4, 1, 2);          //get: var[4]=var[offset[1][2]]=40(原样)
    REQUIRE(m.slot(4) == 40);
    cmd(140)(&m.rt, 5, 1, 2);          //addr: var[5]=vid(地址=槽号,不link成池id)
    REQUIRE(m.slot(5) == vid);
}

TEST_CASE("basic: param set/load", "[runtime]")
{
    Mini m;
    cmd(159)(&m.rt, 1, 55, 0);         //param[1] = src(reg)=55 原样
    cmd(163)(&m.rt, 7, 1, 0);          //var[7] = param[1] = 55
    REQUIRE(m.slot(7) == 55);
}

TEST_CASE("basic: push/pop", "[runtime]")
{
    Mini m;
    //push 压槽内容(编译器函数调用保存槽依赖此语义,reg 原样会导致恢复错位)
    VarPool::unsafeWriteVar(&m.pool, 123, 55);
    cmd(118)(&m.rt, 123, 0, 0);        //PUSH 压 var[123]=55
    cmd(120)(&m.rt, 8, 0, 0);          //POP → var[8]=55
    REQUIRE(m.slot(8) == 55);
}

TEST_CASE("basic: jz conditional jump", "[runtime]")
{
    Mini m;
    cmd(92)(&m.rt, 3, 1, 0);           //cond=1 → 跳块3
    REQUIRE(m.rt.block == 3);
    REQUIRE(m.rt.index == -1);
    cmd(92)(&m.rt, 4, 0, 0);           //cond=0 → 不跳
    REQUIRE(m.rt.block == 3);
}

TEST_CASE("basic: cz/call push frame and ret/retn restore", "[runtime]")
{
    Mini m;
    m.rt.block = 0;
    m.rt.index = 5;
    cmd(88)(&m.rt, 10, 1, 0);          //CZ: 压块帧(类型0),跳块10
    REQUIRE(m.rt.block == 10);
    REQUIRE(m.rt.index == -1);
    REQUIRE(m.rt.blockStack.peek() == 0);
    REQUIRE(m.rt.indexStack.peek() == 6);
    cmd(100)(&m.rt, 20, 1, 0);         //CALL: 压函数帧(类型1)
    REQUIRE(m.rt.block == 20);
    REQUIRE(m.rt.blockStack.peek() == 1);
    cmd(122)(&m.rt, 0, 0, 0);          //RET: 弹到函数帧→回块10
    REQUIRE(m.rt.block == 10);
    REQUIRE(m.rt.index == -1);
    cmd(169)(&m.rt, 0, 0, 0);          //RETN: 只剩cz块帧→弹光→alive=false
    REQUIRE(m.rt.alive == false);
}

TEST_CASE("basic: ret breaks to nearest loop frame", "[runtime]")
{
    Mini m;
    m.rt.block = 0;
    m.rt.index = 3;
    cmd(88)(&m.rt, 5, 1, 2);           //CZ: 压循环帧(类型2),跳块5
    REQUIRE(m.rt.block == 5);
    m.rt.index = 2;
    cmd(88)(&m.rt, 6, 1, 0);           //CZ: 压块帧(if,类型0)
    REQUIRE(m.rt.block == 6);
    m.rt.index = 7;
    cmd(88)(&m.rt, 7, 1, 0);           //CZ: 嵌套块帧
    REQUIRE(m.rt.block == 7);
    cmd(122)(&m.rt, 0, 0, 0);          //RET: break 弹掉嵌套块帧+循环帧,回块0 cz 下一条
    REQUIRE(m.rt.block == 0);
    REQUIRE(m.rt.index == 3);
    REQUIRE(m.rt.blockStack.size() == 0);
}

TEST_CASE("basic: ret without loop frame pops one frame", "[runtime]")
{
    Mini m;
    m.rt.block = 0;
    m.rt.index = 1;
    cmd(88)(&m.rt, 4, 1, 0);           //CZ: 块帧(switch case)
    REQUIRE(m.rt.block == 4);
    cmd(122)(&m.rt, 0, 0, 0);          //RET: 无循环帧,弹一帧回块0
    REQUIRE(m.rt.block == 0);
    REQUIRE(m.rt.index == 1);
}

TEST_CASE("basic: retn pops to function frame", "[runtime]")
{
    Mini m;
    m.rt.block = 0;
    m.rt.index = 3;
    cmd(88)(&m.rt, 5, 1, 0);           //CZ: 压(0,4)块帧
    m.rt.index = 2;
    cmd(100)(&m.rt, 6, 1, 0);          //CALL: 压(5,3)函数帧
    REQUIRE(m.rt.block == 6);
    cmd(169)(&m.rt, 0, 0, 0);          //RETN: 弹到函数帧→回块5,index=2
    REQUIRE(m.rt.block == 5);
    REQUIRE(m.rt.index == 2);
    REQUIRE(m.rt.blockStack.size() == 1);
}

TEST_CASE("basic: delete frees constant", "[runtime]")
{
    Mini m;
    const int id = m.link_num(5.0);
    cmd(84)(&m.rt, 1, id, 0);          //var[1]=id
    cmd(167)(&m.rt, 1, 0, 0);          //DELETE: delete_(var[1])
    m.pool.data.gc();
    REQUIRE(m.link_num(5.0) != id);
}

TEST_CASE("math: add/mul/bit ops", "[runtime]")
{
    Mini m;
    const int c3 = m.link_num(3.0);
    const int c4 = m.link_num(4.0);
    cmd(84)(&m.rt, 10, c3, 0);         //var[10]=c3
    cmd(84)(&m.rt, 11, c4, 0);         //var[11]=c4
    cmd(7)(&m.rt, 1, 10, 11);          //ADD rvv: var[1]=link(3+4)=link(7)
    REQUIRE(m.pnum(1) == 7);
    cmd(23)(&m.rt, 2, 10, 11);         //MUL rvv: link(12)
    REQUIRE(m.pnum(2) == 12);
    //rrr 形式:reg 源=原样当池id(编译器运算不发reg字面量,此处验证池id语义)
    const int c5 = m.link_num(5.0);
    const int c6 = m.link_num(6.0);
    cmd(4)(&m.rt, 3, c5, c6);          //get(c5)+get(c6)=5+6=11
    REQUIRE(m.pnum(3) == 11);
    cmd(84)(&m.rt, 4, c3, 0);          //var[4]=c3(池值3)
    cmd(106)(&m.rt, 4, 0, 0);          //NOT: link(!3)=link(0)
    REQUIRE(m.pnum(4) == 0);
    cmd(84)(&m.rt, 5, m.link_num(0.0), 0);
    cmd(108)(&m.rt, 5, 0, 0);          //BIT_NOT: link(~0)=link(-1)
    REQUIRE(m.pnum(5) == ~0);
}

TEST_CASE("math: map completeness", "[runtime]")
{
    const auto table = math();
    REQUIRE(table.size() == 84);
    REQUIRE(table.count(4) == 1);   //add_rrr
    REQUIRE(table.count(7) == 1);   //add_rvv
    REQUIRE(table.count(76) == 1);  //xor
    REQUIRE(table.count(106) == 1); //not_r
    REQUIRE(table.count(108) == 1); //bit_not_r
}

TEST_CASE("basic: map completeness", "[runtime]")
{
    const auto table = basic();
    REQUIRE(table.size() == 73);
    REQUIRE(table.count(0) == 1);   //mov_rr
    REQUIRE(table.count(84) == 1);  //load_rr
    REQUIRE(table.count(88) == 1);  //cz_rr
    REQUIRE(table.count(92) == 1);  //jz_rr
    REQUIRE(table.count(96) == 1);  //tz_rr
    REQUIRE(table.count(100) == 1); //call_r
    REQUIRE(table.count(102) == 1); //jmp_r
    REQUIRE(table.count(104) == 1); //thread_r
    REQUIRE(table.count(110) == 1); //cmp_rrr
    REQUIRE(table.count(118) == 1); //push_r
    REQUIRE(table.count(120) == 1); //pop_r
    REQUIRE(table.count(169) == 1); //retn
    REQUIRE(table.count(122) == 1); //ret
    REQUIRE(table.count(123) == 1); //gc
    REQUIRE(table.count(124) == 1); //offset_set
    REQUIRE(table.count(132) == 1); //offset_get
    REQUIRE(table.count(140) == 1); //offset_addr
    REQUIRE(table.count(159) == 1); //param_set
    REQUIRE(table.count(163) == 1); //param_load
    REQUIRE(table.count(167) == 1); //delete
}
