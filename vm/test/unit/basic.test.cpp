//runtime/basic.cpp + math.cpp 指令 handler 单元测试
//handler 定义在 .cpp 中,测试经 basic()/math() 映射表按 opcode 取用(顺带验证映射完整性)
//语义:槽存 pool_id;reg源=池反查link;value源=var[x];运算结果 link 存回
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
    //槽里的 pool_id
    int slot(const int id) { return VarPool::unsafeReadVar(&pool, id); }
    //槽的池值:pool[var[id]].num
    int pnum(const int id) { return (int)pool.data.get(slot(id)).num; }
    void write(const int id, const int v) { VarPool::unsafeWriteVar(&pool, id, v); }
};
}

TEST_CASE("basic: mov variants", "[runtime]")
{
    Mini m;
    cmd(0)(&m.rt, 1, 5, 0);            //MOV_R_R: var[1] = link(5) → 池值5
    REQUIRE(m.pnum(1) == 5);
    cmd(0)(&m.rt, 5, 100, 0);          //var[5] = link(100)
    cmd(1)(&m.rt, 2, 5, 0);            //MOV_R_V: var[2] = var[5](复制pool_id)
    REQUIRE(m.pnum(2) == 100);
    //MOV_V_R: 目标 value 形式 → 槽=link(a)
    const int s = m.pool.data.link(2.0);   //与内部 link(2) 同 id
    cmd(2)(&m.rt, 2, 9, 0);            //var[link(2)] = link(9)
    REQUIRE((int)m.pool.data.get(m.slot(s)).num == 9);
}

TEST_CASE("basic: load", "[runtime]")
{
    Mini m;
    cmd(84)(&m.rt, 1, 5, 0);           //LOAD_R_R: var[1] = link(5) → 池值5
    REQUIRE(m.pnum(1) == 5);
    const int cid = m.pool.data.link(42.0);
    //load 的 reg 源 = 反查:link(cid) 是"值为cid的常量"的id,池值=cid
    cmd(84)(&m.rt, 2, cid, 0);
    REQUIRE(m.pnum(2) == cid);
}

TEST_CASE("basic: cmp", "[runtime]")
{
    Mini m;
    cmd(0)(&m.rt, 1, 5, 0);            //var[1] = link(5)
    cmd(110)(&m.rt, 1, 5, 0);          //var[1] = link(5==5)=link(1)
    REQUIRE(m.pnum(1) == 1);
    cmd(0)(&m.rt, 2, 3, 0);
    cmd(110)(&m.rt, 2, 5, 1);          //3!=5 → 1
    REQUIRE(m.pnum(2) == 1);
    cmd(0)(&m.rt, 3, 7, 0);
    cmd(110)(&m.rt, 3, 5, 2);          //7>5 → 1
    REQUIRE(m.pnum(3) == 1);
    cmd(0)(&m.rt, 4, 4, 0);
    cmd(110)(&m.rt, 4, 5, 3);          //4<5 → 1
    REQUIRE(m.pnum(4) == 1);
    cmd(0)(&m.rt, 5, 5, 0);
    cmd(110)(&m.rt, 5, 5, 4);          //5>=5 → 1
    REQUIRE(m.pnum(5) == 1);
    cmd(0)(&m.rt, 6, 6, 0);
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
    REQUIRE((int)m.pool.data.get(VarPool::unsafeReadVar(&m.pool, vid)).num == 30);
    //再写:复用已有变量
    cmd(124)(&m.rt, 1, 2, 40);
    REQUIRE((int)m.pool.data.get(VarPool::unsafeReadVar(&m.pool, vid)).num == 40);
    //get:var[4] = var[offset[1][2]] = var[vid] → 池值40
    cmd(132)(&m.rt, 4, 1, 2);
    REQUIRE(m.pnum(4) == 40);
    //addr:var[5] = link(offset[1][2]) = link(vid) → 池值 vid(var_id)
    cmd(140)(&m.rt, 5, 1, 2);
    REQUIRE(m.pnum(5) == vid);
}

TEST_CASE("basic: param set/load", "[runtime]")
{
    Mini m;
    cmd(159)(&m.rt, 1, 55, 0);         //param[1] = link(55)
    cmd(163)(&m.rt, 7, 1, 0);          //var[7] = param[1]
    REQUIRE(m.pnum(7) == 55);
}

TEST_CASE("basic: push/pop", "[runtime]")
{
    Mini m;
    cmd(118)(&m.rt, 123, 0, 0);        //PUSH link(123)
    cmd(120)(&m.rt, 8, 0, 0);          //POP → var[8]
    REQUIRE(m.pnum(8) == 123);
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
    cmd(88)(&m.rt, 10, 1, 0);          //CZ: 压块帧(假),跳块10
    REQUIRE(m.rt.block == 10);
    REQUIRE(m.rt.index == -1);
    REQUIRE(m.rt.blockStack.peek() == false);
    REQUIRE(m.rt.indexStack.peek() == 6);

    cmd(100)(&m.rt, 20, 1, 0);         //CALL: 压函数帧(真),跳块20
    REQUIRE(m.rt.block == 20);
    REQUIRE(m.rt.blockStack.peek() == true);

    cmd(122)(&m.rt, 0, 0, 0);          //RET: 弹call帧→回块10,index=-1
    REQUIRE(m.rt.block == 10);
    REQUIRE(m.rt.index == -1);

    cmd(169)(&m.rt, 0, 0, 0);          //RETN: 栈里只剩cz块帧→弹光→alive=false
    REQUIRE(m.rt.alive == false);
}

TEST_CASE("basic: retn pops to function frame", "[runtime]")
{
    Mini m;
    m.rt.block = 0;
    m.rt.index = 3;
    cmd(88)(&m.rt, 5, 1, 0);           //CZ: 压(0,4)块帧,跳块5
    m.rt.index = 2;
    cmd(100)(&m.rt, 6, 1, 0);          //CALL: 压(5,3)函数帧,跳块6
    REQUIRE(m.rt.block == 6);
    cmd(169)(&m.rt, 0, 0, 0);          //RETN: 弹到函数帧→回块5,index=2
    REQUIRE(m.rt.block == 5);
    REQUIRE(m.rt.index == 2);
    REQUIRE(m.rt.blockStack.size() == 1);
}

TEST_CASE("basic: delete frees constant", "[runtime]")
{
    Mini m;
    cmd(0)(&m.rt, 1, 5, 0);            //var[1] = link(5)(refCount=1)
    const int id = m.slot(1);
    cmd(167)(&m.rt, 1, 0, 0);          //DELETE: 释放槽1指向的常量 id(refCount→0)
    m.pool.data.gc();
    REQUIRE(m.pool.data.link(5.0) != id);   //已释放,重新分配
}

TEST_CASE("math: add/mul/bit ops", "[runtime]")
{
    Mini m;
    //value 形式操作数 = 槽:先给槽10、11装 3、4
    cmd(0)(&m.rt, 10, 3, 0);
    cmd(0)(&m.rt, 11, 4, 0);
    cmd(7)(&m.rt, 1, 10, 11);          //ADD rvv(opcode7): var[1] = link(3+4)=link(7)
    REQUIRE(m.pnum(1) == 7);
    cmd(23)(&m.rt, 2, 10, 11);         //MUL rvv(opcode23): var[2] = link(12)
    REQUIRE(m.pnum(2) == 12);
    cmd(4)(&m.rt, 3, 5, 6);            //ADD rrr(opcode4): reg源=立即数 → 5+6=11
    REQUIRE(m.pnum(3) == 11);
    cmd(0)(&m.rt, 4, 0, 0);            //var[4] = link(0)
    cmd(106)(&m.rt, 4, 0, 0);          //NOT: link(!0)=link(1)
    REQUIRE(m.pnum(4) == 1);
    cmd(0)(&m.rt, 5, 0, 0);
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
    REQUIRE(table.size() == 73);   //PUSH_V(119)已移除,retn挪到169
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
