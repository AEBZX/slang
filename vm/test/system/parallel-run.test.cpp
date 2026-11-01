//系统测试:thread 派生的多个运行时并行跑互不相干的循环,各自数到头
#include <catch2/catch_all.hpp>

#include <cstdint>
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
    //一条指令 16 字节:操作码 + 三个操作数,操作码=(指令基址)*8+操作数形式位
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
    std::string make_sbin(const std::map<int,double>& nums, const std::vector<std::string>& blocks)
    {
        std::string s="SLANG1.0.0";
        //头部的号段上界:手编程序用到槽 45,给 100 让 VM 分新号不撞
        put_u32(s,100);
        s+="POOL_START";
        for (const auto& [id, v] : nums)s+=num_item(id,v);
        s+="POOL_ENDCODE_START";
        for (const auto& b : blocks)s+=b;
        return s;
    }
    //计数循环:头(块 head)里比较计数槽和边界,真则跳进体(块 body)加一后跳回
    std::string loop_head(const int head, const int body, const int counter, const int tmp, const double limit)
    {
        return block(head,
            ins(1*8+2,tmp,counter)+        //mov tmp=counter
            ins(12*8+0,tmp,static_cast<int>(limit),4)+ //cmp tmp<limit 就地写 tmp
            ins(19*8+1,body,0,tmp));       //cz body
    }
    std::string loop_body(const int head, const int body, const int counter)
    {
        return block(body,
            ins(2*8+2,counter,counter,1)+  //add counter=counter+1
            ins(15*8+0,head,0));           //jmp 回头
    }
}

TEST_CASE("system-parallel thread 派生的运行时各自数到头", "[system]")
{
    instruction::init();
    //主块派生两个线程(块 7、9)分别给 r20/r21 计数,自己把 r30 数到更大的数:
    //主块收工时线程早就数完了,槽里的终值才可信
    std::string program=make_sbin(
        {
            {2,7.0},{3,9.0},{11,0.0}
        },
        {
            block(0,
                ins(0,20,11)+              //load r20=0
                ins(0,21,11)+              //load r21=0
                ins(0,30,11)+              //load r30=0
                ins(0,10,2)+               //load r10=7(线程 A 的块号)
                ins(0,11,3)+               //load r11=9(线程 B 的块号)
                ins(17*8+4,10,0)+          //thread 读槽10,帧0
                ins(17*8+4,11,0)+          //thread 读槽11,帧0
                ins(15*8+0,1,0)),          //jmp 进主循环头,不然主块到这里就停机
            loop_head(1,2,30,44,50000.0),  //主运行时自己的长循环
            loop_body(1,2,30),
            loop_head(7,8,20,43,5000.0),   //线程 A
            loop_body(7,8,20),
            loop_head(9,10,21,45,5000.0),  //线程 B
            loop_body(9,10,21)
        });
    std::unordered_map<int,std::string> strings;
    std::unordered_map<int,double> numbers;
    sbin::commands commands;
    int max_id=0;
    REQUIRE(sbin::decode(program,strings,numbers,commands,max_id));
    runtime::Manage manage(strings,numbers,std::move(commands),max_id);
    manage.start();
    //队列由自动 gc 压回阈值以下;这里只防它无限增长(不 gc 的话会是 30 万)
    REQUIRE(manage.task.size()<10000);
    const auto value=[&](const int slot)
    {
        return manage.pool.number(manage.reg.at(slot).bind);
    };
    REQUIRE(value(20)==5000);
    REQUIRE(value(21)==5000);
    REQUIRE(value(30)==50000);
}
