//单元测试:分发表必须覆盖编译器会生成的每一个操作码(与 generate.ts 的操作码表对齐)
#include <catch2/catch_all.hpp>

#include <set>

#include "../helper.h"

using vm_test::init;

namespace
{
    //形式位:操作数 1/2/3 是 value 时分别加 4/2/1
    int opcode(const int base,const int form)
    {
        return base*8+form;
    }

    //三操作数指令:8 种形式都要有
    constexpr int all_forms=0xFF;
    //两操作数指令:只可能出现 0/2/4/6
    constexpr int two_param_forms=(1<<0)|(1<<2)|(1<<4)|(1<<6);
    //一操作数指令:0/4
    constexpr int one_param_forms=(1<<0)|(1<<4);
    //无操作数指令:只有 0
    constexpr int no_param_forms=1<<0;
}

TEST_CASE("instruction-table 分发表覆盖每条指令的合法操作数形式", "[instruction][table]")
{
    init();
    std::set<int> want;
    const auto add=[&](const int base,const int forms)
    {
        for (int form=0;form<8;form++)
            if (forms>>form&1)want.insert(opcode(base,form));
    };
    //bin:add/sub/mul/div/mod/shl/shr/and/or/xor
    for (int base=2;base<=11;base++)add(base,all_forms);
    //cmp、jz、cz、tz
    add(12,all_forms);
    add(18,all_forms);
    add(19,all_forms);
    add(20,all_forms);
    //offset_set/offset_get/offset_addr/offset_str_set/offset_str_get/offset_str_addr
    for (int base=24;base<=29;base++)add(base,all_forms);
    //load/mov/not/bit_not/jmp/call/thread/in/out/param_set/param_load
    for (const int base : {0,1,13,14,15,16,17,30,31,34,35})add(base,two_param_forms);
    //ret/push/delete
    for (const int base : {21,22,33})add(base,one_param_forms);
    //pop/gc
    for (const int base : {23,32})add(base,no_param_forms);

    REQUIRE(instruction::run_table.size()==want.size());
    for (const int key : want)
    {
        INFO("opcode="<<key);
        REQUIRE(instruction::run_table.contains(key));
        REQUIRE(static_cast<bool>(instruction::run_table.at(key)));
    }
}

TEST_CASE("instruction-table 分发表里没有多余或错位的键", "[instruction][table]")
{
    init();
    //基址 0..35,形式位 0..7:超出这个范围说明表项写错了基址
    for (const auto& [key,fn] : instruction::run_table)
    {
        INFO("opcode="<<key);
        REQUIRE(key>=0);
        REQUIRE(key<36*8);
        REQUIRE(static_cast<bool>(fn));
    }
    //两个无操作数指令只有 form 0,不能混进 1..7
    for (int form=1;form<8;form++)
    {
        REQUIRE_FALSE(instruction::run_table.contains(opcode(23,form)));
        REQUIRE_FALSE(instruction::run_table.contains(opcode(32,form)));
    }
}
