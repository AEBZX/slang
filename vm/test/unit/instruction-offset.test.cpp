//单元测试:容器偏移指令(数字键/字符串键/取地址)与嵌套容器的 value 形式
#include <catch2/catch_all.hpp>

#include <string>

#include "../helper.h"

using vm_test::Machine;
using vm_test::init;

namespace
{
    int op(const int base,const bool v1=false,const bool v2=false,const bool v3=false)
    {
        return base*8+(v1?4:0)+(v2?2:0)+(v3?1:0);
    }
}

TEST_CASE("instruction-offset 数字键的读写", "[instruction][offset]")
{
    init();
    Machine m;
    m.ins(op(24),20,0,42);       //c20[0]=42
    m.ins(op(25),21,20,0);       //r21=c20[0]
    REQUIRE(m.num(21)==42);
    //同一个键再写一次是覆盖,不是追加
    m.ins(op(24),20,0,7);
    m.ins(op(25),22,20,0);
    REQUIRE(m.num(22)==7);
    REQUIRE(m.reg(20).offset_bind.size()==1);
    //不存在的键读到空槽(null_reg)
    m.ins(op(25),23,20,1);
    REQUIRE(m.bind(23)==0);
}

TEST_CASE("instruction-offset 字符串键的读写", "[instruction][offset]")
{
    init();
    Machine m;
    m.set_str(30,"name");
    //键取槽里的字符串,值用立即数
    m.ins(op(24,false,true,false),20,30,42);
    //对象取原始槽,键取槽里的字符串
    m.ins(op(25,false,false,true),21,20,30);
    REQUIRE(m.num(21)==42);
    REQUIRE(m.reg(20).name_bind.contains("name"));
    REQUIRE(m.reg(20).offset_bind.empty());
    //键不存在也读到空槽
    m.set_str(31,"missing");
    m.ins(op(25,false,false,true),22,20,31);
    REQUIRE(m.bind(22)==0);
}

TEST_CASE("instruction-offset 值可以是另一个槽(容器连偏移表一起搬)", "[instruction][offset]")
{
    init();
    Machine m;
    m.ins(op(24),20,0,1);
    m.ins(op(24),20,1,2);
    m.ins(op(1,false,true),30,20);              //mov r30=r20(整个容器)
    m.ins(op(24,false,false,true),40,0,30);     //c40[0]=r30
    m.ins(op(25),41,40,0);                      //r41=c40[0]
    REQUIRE(m.reg(41).offset_bind.size()==2);
    m.ins(op(25),42,41,1);
    REQUIRE(m.num(42)==2);
}

TEST_CASE("instruction-offset 嵌套容器:value 形式解开槽里存的容器号", "[instruction][offset]")
{
    init();
    Machine m;
    m.ins(op(24),20,0,7);        //内层容器 c20[0]=7
    m.set_num(30,20);            //槽 30 里存的是容器身份(槽号 20)
    //对象用 value 形式:容器号从槽 30 里取
    m.ins(op(25,false,true,false),31,30,0);
    REQUIRE(m.num(31)==7);
}

TEST_CASE("instruction-offset offset_addr 给出元素槽号", "[instruction][offset]")
{
    init();
    Machine m;
    m.ins(op(24),20,0,1);        //建元素槽
    m.ins(op(26),22,20,0);       //r22=addr(c20[0])
    const int slot=m.reg(20).offset_bind.at(0);
    REQUIRE(slot>0);
    REQUIRE(m.num(22)==slot);
    REQUIRE(m.manage.pool.number(m.manage.reg.at(slot).bind)==1);
    //字符串键的地址
    m.set_str(30,"k");
    m.ins(op(24,false,true,false),21,30,5);
    m.ins(op(26,false,false,true),23,21,30);
    REQUIRE(m.num(23)==m.reg(21).name_bind.at("k"));
}

TEST_CASE("instruction-offset offset_str 读写字符串里的字符", "[instruction][offset]")
{
    init();
    Machine m;
    m.set_str(20,"abc");
    m.set_str(21,"Z");
    //把 c20 的第 0 个字符换成 'Z',值取槽 21 里字符串的首字符
    m.ins(op(27,false,false,true),20,0,21);
    REQUIRE(m.manage.pool.str(m.bind(20))=="Zbc");
    //再读回来
    m.ins(op(28),22,20,0);
    REQUIRE(m.str(22)=="Z");
    //取字符槽的地址
    m.ins(op(29),23,20,0);
    const int slot=m.reg(20).offset_bind.at(0);
    REQUIRE(m.num(23)==slot);
    //越界的下标不写池串也不崩
    m.ins(op(27,false,false,true),20,9,21);
    REQUIRE(m.manage.pool.str(m.bind(20))=="Zbc");
}

TEST_CASE("instruction-offset offset_str 缺键时不写目标槽", "[instruction][offset]")
{
    init();
    Machine m;
    m.set_str(20,"abc");
    m.ins(op(28),22,20,5);
    REQUIRE(m.bind(22)==0);
    REQUIRE(m.reg(20).offset_bind.empty());
}
