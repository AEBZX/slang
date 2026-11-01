//单元测试:算术/逻辑/比较指令的语义与三种操作数形式
#include <catch2/catch_all.hpp>

#include <cmath>

#include "../helper.h"

using vm_test::Machine;
using vm_test::init;

namespace
{
    //操作码 = 指令基址*8 + 形式位(三个操作数是 value 时分别加 4/2/1)
    int opcode(const int base,const bool v1=false,const bool v2=false,const bool v3=false)
    {
        return base*8+(v1?4:0)+(v2?2:0)+(v3?1:0);
    }
}

TEST_CASE("instruction-arith 十个二元运算的立即数形式", "[instruction][arith]")
{
    init();
    const struct
    {
        int base;
        int left;
        int right;
        double want;
    } cases[]={
        {2,2,3,5.0},     //add
        {3,5,2,3.0},     //sub
        {4,4,6,24.0},    //mul
        {5,9,2,4.5},     //div
        {6,7,3,1.0},     //mod
        {7,1,4,16.0},    //shl
        {8,16,2,4.0},    //shr
        {9,6,3,2.0},     //and
        {10,4,1,5.0},    //or
        {11,5,3,6.0}     //xor
    };
    for (const auto& c : cases)
    {
        INFO("base="<<c.base);
        Machine m;
        m.ins(opcode(c.base),10,c.left,c.right);
        REQUIRE(m.num(10)==c.want);
        REQUIRE(m.bind(10)>0);
    }
}

TEST_CASE("instruction-arith 二元运算的 value 形式读槽里的值", "[instruction][arith]")
{
    init();
    Machine m;
    m.set_num(20,10);
    m.set_num(21,4);
    //add r30 = r20 + r21:两个源都是 value
    m.ins(opcode(2,false,true,true),30,20,21);
    REQUIRE(m.num(30)==14);
    //add r31 = 7 + r21:第二个源是 value
    m.ins(opcode(2,false,false,true),31,7,21);
    REQUIRE(m.num(31)==11);
    //add r32 = r20 + 3:第一个源是 value
    m.ins(opcode(2,false,true,false),32,20,3);
    REQUIRE(m.num(32)==13);
}

TEST_CASE("instruction-arith 除法结果按 double 保留小数", "[instruction][arith]")
{
    init();
    Machine m;
    m.ins(opcode(5),10,1,4);
    REQUIRE(m.num(10)==0.25);
    //除以 0 得到 inf,不抛异常
    m.ins(opcode(5),11,1,0);
    REQUIRE(std::isinf(m.num(11)));
}

TEST_CASE("instruction-arith not 与 bit_not 的操作数形式", "[instruction][arith]")
{
    init();
    Machine m;
    m.set_num(20,10);
    m.ins(13*8+0,10,0);    //not r10 = !(int)0
    m.ins(13*8+2,11,20);   //not r11 = !(int)r20
    m.set_num(21,5);
    m.ins(14*8+0,12,5);    //bit_not r12 = ~5
    m.ins(14*8+2,13,20);   //bit_not r13 = ~r20(value 形式)
    REQUIRE(m.num(10)==1);
    REQUIRE(m.num(11)==0);
    REQUIRE(m.num(12)==-6);
    REQUIRE(m.num(13)==-11);
}

TEST_CASE("instruction-arith cmp 的六个比较运算符", "[instruction][arith]")
{
    init();
    //oper: 0 == 1 > 2 >= 3 != 4 < 5 <=
    const struct
    {
        int oper;
        int right;
        double want;
    } cases[]={
        {0,5,1},{0,4,0},
        {1,3,1},{1,5,0},
        {2,5,1},{2,6,0},
        {3,3,1},{3,5,0},
        {4,6,1},{4,5,0},
        {5,5,1},{5,4,0}
    };
    for (const auto& c : cases)
    {
        INFO("oper="<<c.oper<<" right="<<c.right);
        Machine m;
        m.set_num(50,5);
        m.ins(opcode(12),50,c.right,c.oper);
        REQUIRE(m.num(50)==c.want);
    }
}

TEST_CASE("instruction-arith cmp 右值可以取槽里的值", "[instruction][arith]")
{
    init();
    Machine m;
    m.set_num(20,5);
    m.set_num(21,6);
    //cmp r20 >= r21:左值就地写回 r20
    m.ins(opcode(12,false,true,false),20,21,2);
    REQUIRE(m.num(20)==0);
    m.set_num(22,7);
    m.ins(opcode(12,false,true,false),22,21,1);
    REQUIRE(m.num(22)==1);
}

TEST_CASE("instruction-arith 字符串相等按池 id 比", "[instruction][arith]")
{
    init();
    Machine m;
    m.set_str(20,"same");
    m.set_str(21,"same");
    m.set_str(22,"other");
    //同一个内容的字符串在池里只有一个 id
    m.ins(opcode(1,false,true),30,20);
    m.ins(opcode(12,false,true,false),30,21,0);
    REQUIRE(m.num(30)==1);
    //不同内容 !=
    m.ins(opcode(1,false,true),31,20);
    m.ins(opcode(12,false,true,false),31,22,3);
    REQUIRE(m.num(31)==1);
}

TEST_CASE("instruction-arith 容器相等按内容递归比", "[instruction][arith]")
{
    init();
    Machine m;
    //d1=[1,2] d2=[1,2] d3=[1,3]
    m.ins(opcode(24),10,0,1);
    m.ins(opcode(24),10,1,2);
    m.ins(opcode(24),11,0,1);
    m.ins(opcode(24),11,1,2);
    m.ins(opcode(24),12,0,1);
    m.ins(opcode(24),12,1,3);
    //mov 把容器连同偏移表一起拷走,cmp 再用 value 形式按内容比
    m.ins(opcode(1,false,true),20,10);
    m.ins(opcode(12,false,true,false),20,11,0);
    REQUIRE(m.num(20)==1);
    m.ins(opcode(1,false,true),21,10);
    m.ins(opcode(12,false,true,false),21,12,0);
    REQUIRE(m.num(21)==0);
    m.ins(opcode(1,false,true),22,10);
    m.ins(opcode(12,false,true,false),22,12,3);
    REQUIRE(m.num(22)==1);
}

TEST_CASE("instruction-arith 空容器与标量不相等", "[instruction][arith]")
{
    init();
    Machine m;
    m.set_num(10,0);
    m.ins(opcode(1,false,true),11,10);
    m.ins(opcode(12,false,true,false),11,10,0);
    REQUIRE(m.num(11)==1);
    //容器和标量比:一侧有偏移表,按内容比必然不等
    m.ins(opcode(24),12,0,0);
    m.ins(opcode(1,false,true),13,12);
    m.ins(opcode(12,false,true,false),13,10,0);
    REQUIRE(m.num(13)==0);
}
