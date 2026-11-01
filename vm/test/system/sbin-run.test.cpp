//系统测试:手工编一段 .sbin,跑通算术、分支、循环、函数调用与容器
#include <catch2/catch_all.hpp>

#include <bit>
#include <cstdint>
#include <cstring>
#include <map>
#include <string>
#include <vector>

#include "../../main.h"

namespace
{
    void put_u32(std::string& out, const std::uint32_t v)
    {
        out.push_back(static_cast<char>(v>>24&0xFF));
        out.push_back(static_cast<char>(v>>16&0xFF));
        out.push_back(static_cast<char>(v>>8&0xFF));
        out.push_back(static_cast<char>(v&0xFF));
    }
    //一条指令 16 字节:操作码 + 三个操作数,操作码=(指令基址+二进制偏移)*8+形式位
    std::string ins(const int opcode, const int a1=0, const int a2=0, const int a3=0)
    {
        std::string s;
        put_u32(s,opcode);
        put_u32(s,a1);
        put_u32(s,a2);
        put_u32(s,a3);
        return s;
    }
    std::string block(const int id, const std::string& body)
    {
        std::string s;
        put_u32(s,0xFFFFFFFF);
        put_u32(s,id);
        put_u32(s,0);
        put_u32(s,0);
        s+=body;
        put_u32(s,0xFFFFFFFE);
        put_u32(s,0);
        put_u32(s,0);
        put_u32(s,0);
        return s;
    }
    std::string num_item(const int id, const double v)
    {
        const auto bits=std::bit_cast<std::uint64_t>(v);
        std::string s;
        put_u32(s,id);
        s.push_back(1);
        put_u32(s,8);
        put_u32(s,static_cast<std::uint32_t>(bits>>32));
        put_u32(s,static_cast<std::uint32_t>(bits));
        return s;
    }
    std::string str_item(const int id, const std::string& v)
    {
        std::string s;
        put_u32(s,id);
        s.push_back(0);
        put_u32(s,static_cast<std::uint32_t>(v.size()));
        s+=v;
        return s;
    }
    std::string make_sbin(const std::map<int,double>& nums, const std::map<int,std::string>& strs,
        const std::vector<std::string>& blocks, const int max_id=100)
    {
        std::string s="SLANG1.0.0";
        put_u32(s,static_cast<std::uint32_t>(max_id));
        s+="POOL_START";
        for (const auto& [id, v] : nums)s+=num_item(id,v);
        for (const auto& [id, v] : strs)s+=str_item(id,v);
        s+="POOL_ENDCODE_START";
        for (const auto& b : blocks)s+=b;
        return s;
    }
}

TEST_CASE("system-sbin 主块跑完自动停机,算术和调用结果都落在槽里", "[system]")
{
    instruction::init();
    //块 1:函数,返回 param[1]*2
    std::string program=make_sbin(
        {
            {2,2.0},{3,3.0},{4,100.0},{5,200.0},{8,0.0},{9,4.0}
        },
        {
            {1,"count"}
        },
        {
            block(0,
                ins(0,10,2)+               //load r10=2
                ins(0,11,3)+               //load r11=3
                ins((2+0)*8+3,12,10,11)+   //add r12=r10+r11
                ins(22*8,10)+              //push r10
                ins(34*8+2,1,10)+          //param_set param[1]=r10
                ins(16*8,1,1)+             //call 块1,函数帧
                ins(35*8,14,0)+            //param_load r14=param[0]
                ins(23*8)+                 //pop
                ins(0,15,9)+               //load r15=4
                ins(1*8+2,21,14)+          //mov r21=r14(留一份返回值)
                ins(12*8+6,14,15,0)+       //cmp r14==r15 -> 真(就地写 r14)
                ins(19*8+1,2,0,14)+        //cz 块2(真分支)
                ins(13*8+2,14,14)+         //not r14
                ins(19*8+1,3,0,14)+        //cz 块3(假分支,不跳)
                ins(0,16,8)+               //load r16=0(循环计数)
                ins(0,17,3)+               //load r17=3(边界)
                ins(32*8)+                 //gc
                ins(16*8,4,2)+             //call 块4,循环帧
                ins(0,18,1)+               //load r18="count"
                ins(24*8+3,30,18,16)+      //offset_set r30["count"]=r16
                ins(25*8+1,31,30,18)+      //offset_get r31=r30["count"]
                ins(0,19,2)+               //load r19=2
                ins(24*8+3,30,19,10)+      //offset_set r30[2]=r10
                ins(25*8+1,32,30,19)       //offset_get r32=r30[2]
            ),
            block(1,
                ins(35*8,40,1)+            //param_load r40=param[1]
                ins(0,41,2)+               //load r41=2
                ins((2+2)*8+3,42,40,41)+   //mul r42=r40*r41
                ins(34*8+2,0,42)+          //param_set param[0]=r42
                ins(21*8,1)                //ret 1
            ),
            block(2,
                ins(0,20,4)                //load r20=100(真分支)
            ),
            block(3,
                ins(0,20,5)                //load r20=200(假分支,不该执行)
            ),
            block(4,
                ins(1*8+2,43,16)+          //mov r43=r16(计数器拷到临时槽)
                ins(12*8+6,43,17,4)+       //cmp r43<r17 -> 就地写 r43
                ins(19*8+1,5,0,43)         //cz 块5(循环体)
            ),
            block(5,
                ins((2+0)*8+2,16,16,1)+    //add r16=r16+1
                ins(15*8,4,0)              //jmp 回块 4
            )
        });
    std::unordered_map<int,std::string> strings;
    std::unordered_map<int,double> numbers;
    sbin::commands commands;
    int max_id=0;
    REQUIRE(sbin::decode(program,strings,numbers,commands,max_id));
    runtime::Manage manage(strings,numbers,std::move(commands),max_id);
    //主块跑到尾,帧栈空了自动停机
    manage.start();
    const auto value=[&](const int slot)
    {
        return manage.pool.number_pool.at(manage.reg.at(slot).bind);
    };
    //算术
    REQUIRE(value(12)==5);
    //函数返回值 param[1]*2(mov 出来的副本)
    REQUIRE(value(21)==4);
    //走了真分支,假分支没碰 r20
    REQUIRE(value(20)==100);
    //循环体跑了三轮
    REQUIRE(value(16)==3);
    //pop 之后 r10 还是原来的值
    REQUIRE(value(10)==2);
    //容器:名字键和数字键都取得回来
    REQUIRE(value(31)==3);
    REQUIRE(value(32)==2);
    REQUIRE(manage.reg.at(30).name_bind.at("count")>0);
    //gc 不该动还活着的常量
    REQUIRE(manage.pool.has(1));
    REQUIRE(manage.pool.has(9));
}

TEST_CASE("system-sbin 容器相等比较按内容比", "[system]")
{
    instruction::init();
    //d1=[1,2]、d2=[1,2]、d3=[1,3]:内容一样才算相等
    std::string program=make_sbin(
        {
            {2,1.0},{3,2.0},{4,3.0},{5,0.0}
        },
        {},
        {
            block(0,
                ins(0,13,5)+ins(0,14,2)+               //键槽:0、1
                ins(0,10,2)+ins(0,11,3)+ins(0,12,4)+   //值槽:1/2/3
                ins(24*8+3,20,13,10)+                  //d1[0]=1
                ins(24*8+3,20,14,11)+                  //d1[1]=2
                ins(24*8+3,21,13,10)+                  //d2[0]=1
                ins(24*8+3,21,14,11)+                  //d2[1]=2
                ins(24*8+3,22,13,10)+                  //d3[0]=1
                ins(24*8+3,22,14,12)+                  //d3[1]=3
                ins(1*8+2,50,20)+ins(12*8+6,50,21,0)+  //mov r50=d1;cmp r50==d2
                ins(1*8+2,51,20)+ins(12*8+6,51,22,0)+  //mov r51=d1;cmp r51==d3
                ins(1*8+2,52,20)+ins(12*8+6,52,22,3)   //mov r52=d1;cmp r52!=d3
            )
        });
    std::unordered_map<int,std::string> strings;
    std::unordered_map<int,double> numbers;
    sbin::commands commands;
    int max_id=0;
    REQUIRE(sbin::decode(program,strings,numbers,commands,max_id));
    runtime::Manage manage(strings,numbers,std::move(commands),max_id);
    manage.start();
    const auto value=[&](const int slot)
    {
        return manage.pool.number_pool.at(manage.reg.at(slot).bind);
    };
    REQUIRE(value(50)==1);
    REQUIRE(value(51)==0);
    REQUIRE(value(52)==1);
}

