//单元测试:.sbin 解码器:合法产物逐字段读回,畸形输入一律拒绝且不崩
#include <catch2/catch_all.hpp>

#include <bit>
#include <cstdint>
#include <map>
#include <string>
#include <unordered_map>
#include <vector>

#include "../../main.h"

namespace
{
    void put_u32(std::string& out,const std::uint32_t v)
    {
        out.push_back(static_cast<char>(v>>24&0xFF));
        out.push_back(static_cast<char>(v>>16&0xFF));
        out.push_back(static_cast<char>(v>>8&0xFF));
        out.push_back(static_cast<char>(v&0xFF));
    }
    //一条指令 16 字节:操作码 + 三个操作数
    std::string ins(const int opcode,const int a1=0,const int a2=0,const int a3=0)
    {
        std::string s;
        put_u32(s,static_cast<std::uint32_t>(opcode));
        put_u32(s,static_cast<std::uint32_t>(a1));
        put_u32(s,static_cast<std::uint32_t>(a2));
        put_u32(s,static_cast<std::uint32_t>(a3));
        return s;
    }
    std::string block(const int id,const std::string& body)
    {
        std::string s;
        put_u32(s,0xFFFFFFFF);
        put_u32(s,static_cast<std::uint32_t>(id));
        put_u32(s,0);
        put_u32(s,0);
        s+=body;
        put_u32(s,0xFFFFFFFE);
        put_u32(s,0);
        put_u32(s,0);
        put_u32(s,0);
        return s;
    }
    std::string num_item(const int id,const double v)
    {
        const auto bits=std::bit_cast<std::uint64_t>(v);
        std::string s;
        put_u32(s,static_cast<std::uint32_t>(id));
        s.push_back(1);
        put_u32(s,8);
        put_u32(s,static_cast<std::uint32_t>(bits>>32));
        put_u32(s,static_cast<std::uint32_t>(bits));
        return s;
    }
    std::string str_item(const int id,const std::string& v)
    {
        std::string s;
        put_u32(s,static_cast<std::uint32_t>(id));
        s.push_back(0);
        put_u32(s,static_cast<std::uint32_t>(v.size()));
        s+=v;
        return s;
    }
    std::string head(const int max_id)
    {
        std::string s="SLANG1.0.0";
        put_u32(s,static_cast<std::uint32_t>(max_id));
        return s;
    }
    std::string program(const int max_id,const std::string& pool_items,const std::string& blocks)
    {
        return head(max_id)+"POOL_START"+pool_items+"POOL_ENDCODE_START"+blocks;
    }

    struct Out
    {
        std::unordered_map<int,std::string> strings;
        std::unordered_map<int,double> numbers;
        sbin::commands commands;
        int max_id=0;
    };
}

TEST_CASE("decode-sbin 合法产物逐字段读回", "[decode]")
{
    Out out;
    const std::string src=program(42,num_item(3,2.5)+str_item(4,"hi"),block(0,ins(19,10,11,12)));
    REQUIRE(sbin::decode(src,out.strings,out.numbers,out.commands,out.max_id));
    REQUIRE(out.max_id==42);
    REQUIRE(out.numbers.size()==1);
    REQUIRE(out.numbers.at(3)==2.5);
    REQUIRE(out.strings.size()==1);
    REQUIRE(out.strings.at(4)=="hi");
    REQUIRE(out.commands.size()==1);
    const auto& list=out.commands.at(0);
    REQUIRE(list.size()==1);
    REQUIRE(list[0].key==19);
    REQUIRE(list[0].value.key1==10);
    REQUIRE(list[0].value.key2==11);
    REQUIRE(list[0].value.key3==12);
}

TEST_CASE("decode-sbin 多块多指令按顺序解出来", "[decode]")
{
    Out out;
    const std::string src=program(7,
        str_item(1,"a")+num_item(2,1)+num_item(3,2),
        block(0,ins(0,1,2)+ins(1,3,2))+block(5,ins(15,1,0)));
    REQUIRE(sbin::decode(src,out.strings,out.numbers,out.commands,out.max_id));
    REQUIRE(out.max_id==7);
    REQUIRE(out.commands.size()==2);
    REQUIRE(out.commands.at(0).size()==2);
    REQUIRE(out.commands.at(0)[0].key==0);
    REQUIRE(out.commands.at(0)[1].key==1);
    REQUIRE(out.commands.at(5).size()==1);
    REQUIRE(out.commands.at(5)[0].key==15);
    REQUIRE(out.commands.at(5)[0].value.key1==1);
}

TEST_CASE("decode-sbin 空池与空代码段也是合法产物", "[decode]")
{
    Out out;
    REQUIRE(sbin::decode(program(0,"",""),out.strings,out.numbers,out.commands,out.max_id));
    REQUIRE(out.max_id==0);
    REQUIRE(out.strings.empty());
    REQUIRE(out.numbers.empty());
    REQUIRE(out.commands.empty());
    //只有空块也算有代码
    Out with_block;
    REQUIRE(sbin::decode(program(1,"",block(0,"")),with_block.strings,with_block.numbers,with_block.commands,with_block.max_id));
    REQUIRE(with_block.commands.size()==1);
    REQUIRE(with_block.commands.at(0).empty());
}

TEST_CASE("decode-sbin 文件头不合法时拒绝", "[decode]")
{
    const auto bad=[&](const std::string& src)
    {
        Out out;
        REQUIRE_FALSE(sbin::decode(src,out.strings,out.numbers,out.commands,out.max_id));
    };
    bad("");
    bad("SLANG");
    bad("SLANG1.0.");                       //版本号不全
    bad(head(1).substr(0,10));              //max_id 只有一半
    bad("SLANG1.0.1"+head(1).substr(10));   //魔数最后一位不对
    bad(head(1)+"XXXX");                    //缺 POOL_START
    bad(head(1)+"POOL_START");              //池没有收尾,也没有代码段
}

TEST_CASE("decode-sbin 池条目不合法时拒绝", "[decode]")
{
    const auto bad=[&](const std::string& pool_items,const std::string& blocks="")
    {
        Out out;
        REQUIRE_FALSE(sbin::decode(head(1)+"POOL_START"+pool_items+"POOL_ENDCODE_START"+blocks,
            out.strings,out.numbers,out.commands,out.max_id));
    };
    //条目头都不全
    std::string short_head;
    put_u32(short_head,1);
    short_head.push_back(0);
    bad(short_head);
    //声明的长度超过剩余字节
    std::string short_data;
    put_u32(short_data,1);
    short_data.push_back(0);
    put_u32(short_data,10);
    short_data+="ab";
    bad(short_data);
    //数字项长度必须是 8
    std::string wrong_len;
    put_u32(wrong_len,3);
    wrong_len.push_back(1);
    put_u32(wrong_len,4);
    put_u32(wrong_len,0);
    bad(wrong_len);
    //未知类型
    std::string unknown_type;
    put_u32(unknown_type,3);
    unknown_type.push_back(2);
    put_u32(unknown_type,0);
    bad(unknown_type);
    //池内 id 重复
    bad(num_item(3,1)+num_item(3,2));
    //数字和字符串也不能共用一个 id
    bad(num_item(3,1)+str_item(3,"x"));
}

TEST_CASE("decode-sbin 代码段不合法时拒绝", "[decode]")
{
    const auto bad=[&](const std::string& blocks)
    {
        Out out;
        REQUIRE_FALSE(sbin::decode(program(1,"",blocks),out.strings,out.numbers,out.commands,out.max_id));
    };
    //块头不全
    std::string short_block;
    put_u32(short_block,0xFFFFFFFF);
    put_u32(short_block,0);
    bad(short_block);
    //块头保留位必须为 0
    std::string dirty_header;
    put_u32(dirty_header,0xFFFFFFFF);
    put_u32(dirty_header,0);
    put_u32(dirty_header,1);
    put_u32(dirty_header,0);
    put_u32(dirty_header,0xFFFFFFFE);
    put_u32(dirty_header,0);
    put_u32(dirty_header,0);
    put_u32(dirty_header,0);
    bad(dirty_header);
    //块里又出现块开始标记
    bad(block(0,ins(-1)));
    //块尾标记带操作数
    std::string dirty_end;
    put_u32(dirty_end,0xFFFFFFFF);
    put_u32(dirty_end,0);
    put_u32(dirty_end,0);
    put_u32(dirty_end,0);
    put_u32(dirty_end,0xFFFFFFFE);
    put_u32(dirty_end,1);
    put_u32(dirty_end,0);
    put_u32(dirty_end,0);
    bad(dirty_end);
    //块号重复
    bad(block(0,"")+block(0,""));
    //块没有收尾
    std::string no_end;
    put_u32(no_end,0xFFFFFFFF);
    put_u32(no_end,0);
    put_u32(no_end,0);
    put_u32(no_end,0);
    no_end+=ins(0);
    bad(no_end);
    //块尾之后还剩半条指令
    std::string short_ins;
    put_u32(short_ins,0xFFFFFFFF);
    put_u32(short_ins,0);
    put_u32(short_ins,0);
    put_u32(short_ins,0);
    put_u32(short_ins,0);
    put_u32(short_ins,0);
    bad(short_ins);
}
