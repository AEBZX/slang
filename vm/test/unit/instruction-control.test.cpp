//单元测试:控制流/栈/参数指令,以及 Manage 的槽占用与 step 的推进
#include <catch2/catch_all.hpp>

#include "../helper.h"

using vm_test::Machine;
using vm_test::init;

namespace
{
    runtime::frame frame_of(const int type,const int pc=0)
    {
        runtime::frame f;
        f.type=type;
        f.pc=pc;
        return f;
    }
}

TEST_CASE("instruction-control push 与 pop 复原槽", "[instruction][control]")
{
    init();
    Machine m;
    m.set_num(5,42);
    m.ins(22*8+0,5);       //push r5
    m.set_num(5,7);
    m.ins(23*8+0);         //pop
    REQUIRE(m.num(5)==42);
}

TEST_CASE("instruction-control param_set 与 param_load", "[instruction][control]")
{
    init();
    Machine m;
    m.set_num(10,9);
    m.ins(34*8+2,1,10);    //param[1]=r10(value 形式)
    m.ins(35*8+0,20,1);    //r20=param[1]
    REQUIRE(m.num(20)==9);
    //没有登记过的参数读到空槽
    m.ins(35*8+0,21,8);
    REQUIRE(m.bind(21)==0);
}

TEST_CASE("instruction-control jmp 跳转并退掉同类型帧", "[instruction][control]")
{
    init();
    Machine m;
    m.manage.command[7];
    m.rt.frames.push(frame_of(2));
    m.rt.frames.push(frame_of(1));
    m.rt.frames.push(frame_of(2));
    m.rt.frames.push(frame_of(0,3));
    m.ins(15*8+0,7,0);     //jmp 块7,退帧类型 0
    REQUIRE(m.rt.now.instruction==&m.manage.command[7]);
    REQUIRE(m.rt.now.pc==0);
    //只退类型 0 的帧,其余原样
    REQUIRE(m.rt.frames.size()==3);
    REQUIRE(m.rt.frames.top().type==2);
    m.ins(15*8+0,7,2);     //再退类型 2 的帧
    REQUIRE(m.rt.frames.size()==2);
    REQUIRE(m.rt.frames.top().type==1);
}

TEST_CASE("instruction-control call 压入当前帧再跳转", "[instruction][control]")
{
    init();
    Machine m;
    m.manage.command[9];
    m.rt.now=frame_of(5,4);
    m.ins(16*8+0,9,3);     //call 块9,帧类型3
    REQUIRE(m.rt.now.instruction==&m.manage.command[9]);
    REQUIRE(m.rt.now.pc==0);
    REQUIRE(m.rt.now.type==3);
    REQUIRE(m.rt.frames.size()==1);
    //压进去的是调用点的帧(类型已经改成 3,pc 保留)
    REQUIRE(m.rt.frames.top().type==3);
    REQUIRE(m.rt.frames.top().pc==4);
}

TEST_CASE("instruction-control cz 只在条件非 0 时调用", "[instruction][control]")
{
    init();
    Machine m;
    m.manage.command[4];
    m.set_num(20,0);
    m.ins(19*8+1,4,2,20);  //cz 块4,帧2,条件 r20(=0)
    REQUIRE(m.rt.now.instruction==nullptr);
    REQUIRE(m.rt.frames.empty());
    m.set_num(20,1);
    m.ins(19*8+1,4,2,20);
    REQUIRE(m.rt.now.instruction==&m.manage.command[4]);
    REQUIRE(m.rt.now.type==2);
    REQUIRE(m.rt.frames.size()==1);
}

TEST_CASE("instruction-control jz 只在条件恰好为 1 时跳转", "[instruction][control]")
{
    init();
    Machine m;
    m.manage.command[4];
    m.set_num(20,0);
    m.ins(18*8+1,4,0,20);
    REQUIRE(m.rt.now.instruction==nullptr);
    m.set_num(20,2);
    m.ins(18*8+1,4,0,20);
    REQUIRE(m.rt.now.instruction==nullptr);
    m.set_num(20,1);
    m.ins(18*8+1,4,0,20);
    REQUIRE(m.rt.now.instruction==&m.manage.command[4]);
    //jz 不压帧
    REQUIRE(m.rt.frames.empty());
}

TEST_CASE("instruction-control tz 只在条件非 0 时派生运行时", "[instruction][control]")
{
    init();
    Machine m;
    m.set_num(20,0);
    const auto before=m.manage.task.size();
    m.ins(20*8+1,7,0,20);  //tz 块7,帧0,条件 0
    REQUIRE(m.manage.task.size()==before);
    m.set_num(20,1);
    m.ins(20*8+1,7,0,20);
    REQUIRE(m.manage.task.size()>before);
}

TEST_CASE("instruction-control ret 退到帧类型匹配的那一层", "[instruction][control]")
{
    init();
    Machine m;
    m.rt.frames.push(frame_of(2,20));
    m.rt.frames.push(frame_of(1,10));
    m.rt.frames.push(frame_of(0,5));
    m.ins(21*8+0,1);       //ret 类型1:先弹掉类型0,再命中类型1
    REQUIRE(m.rt.now.type==1);
    REQUIRE(m.rt.now.pc==10);
    REQUIRE(m.rt.frames.size()==1);
    REQUIRE(m.rt.frames.top().type==2);
}

TEST_CASE("instruction-manage claim 的槽占用与释放", "[instruction][manage]")
{
    Machine m;
    REQUIRE(m.manage.claim(5,0,0));
    REQUIRE_FALSE(m.manage.claim(5,0,0));
    REQUIRE_FALSE(m.manage.claim(0,5,0));
    REQUIRE_FALSE(m.manage.claim(6,5,0));
    //被拒绝的 claim 不能把别的槽也占上
    REQUIRE(m.manage.claim(6,0,0));
    m.manage.release(5,0,0);
    REQUIRE(m.manage.claim(5,0,0));
    //0 是空槽哨兵,永远可占
    REQUIRE(m.manage.claim(0,0,0));
    REQUIRE(m.manage.claim(0,0,0));
}

TEST_CASE("instruction-manage get 与 write_slot", "[instruction][manage]")
{
    Machine m;
    REQUIRE(m.manage.get(3)==nullptr);
    m.manage.command[3];
    REQUIRE(m.manage.get(3)!=nullptr);
    runtime::Reg r;
    r.bind=12345;
    r.name_bind["k"]=7;
    m.manage.write_slot(99,r);
    REQUIRE(m.manage.reg.at(99).bind==12345);
    REQUIRE(m.manage.reg.at(99).name_bind.at("k")==7);
}

TEST_CASE("instruction-control step 执行一条就前进一格", "[instruction][control][step]")
{
    init();
    Machine m;
    auto& block=m.manage.command[0];
    block.emplace_back(std::vector<int>{10,2,3},[](runtime::Runtime* rt,const int a1,const int a2,const int a3)
    {
        int id=rt->father->pool.id_number(a2+a3);
        rt->father->pool.link(id);
        rt->father->reg[a1].bind=id;
    },false);
    m.rt.id=0;
    m.rt.now.instruction=&block;
    m.rt.now.pc=0;
    m.rt.step();
    REQUIRE(m.num(10)==5);
    REQUIRE(m.rt.now.pc==1);
    //块尾且帧栈为空:主运行时停机,不再调度
    const auto before=m.manage.task.size();
    m.rt.step();
    REQUIRE(m.manage.task.size()==before);
}

TEST_CASE("instruction-control step 块尾回到帧里保存的位置", "[instruction][control][step]")
{
    init();
    Machine m;
    auto& block=m.manage.command[0];
    auto& back=m.manage.command[1];
    m.rt.now.instruction=&block;
    m.rt.now.pc=0;          //空块,直接走到块尾
    runtime::frame saved=frame_of(2,7);
    saved.instruction=&back;
    m.rt.frames.push(saved);
    m.rt.step();
    REQUIRE(m.rt.frames.empty());
    REQUIRE(m.rt.now.instruction==&back);
    REQUIRE(m.rt.now.pc==7);
    REQUIRE(m.rt.now.type==2);
}
