#ifndef SLANG_TEST_HELPER_H
#define SLANG_TEST_HELPER_H

#include <catch2/catch_all.hpp>

#include <string>
#include <unordered_map>
#include <vector>

#include "../main.h"

namespace vm_test
{
    //分发表是全局的:每个用例先 init(幂等),再按操作码直接派发
    inline void init()
    {
        instruction::init();
    }

    //手工搭一个最小的 Manage + Runtime:
    //- 指令块默认是空的,要测控制流时用例自己往 manage.command 里塞
    //- max_id 决定构造时预建的槽号区间(0..max_id-1)
    struct Machine
    {
        runtime::Manage manage;
        runtime::Runtime rt;

        explicit Machine(const int max_id=128)
            : manage({}, {}, {}, max_id)
        {
            rt.father=&manage;
        }

        //按操作码调用一条指令;分发表里没有说明测试自己写错了
        void ins(const int opcode,const int a1=0,const int a2=0,const int a3=0)
        {
            const auto it=instruction::run_table.find(opcode);
            REQUIRE(it!=instruction::run_table.end());
            it->second(&rt,a1,a2,a3);
        }

        runtime::Reg& reg(const int slot)
        {
            return manage.reg[slot];
        }

        void set_num(const int slot,const double value)
        {
            reg(slot).bind=manage.pool.id_number(value);
        }

        void set_str(const int slot,const std::string& value)
        {
            reg(slot).bind=manage.pool.id_string(value);
        }

        double num(const int slot)
        {
            return manage.pool.number(manage.reg.at(slot).bind);
        }

        std::string str(const int slot)
        {
            return manage.pool.str(manage.reg.at(slot).bind);
        }

        int bind(const int slot) const
        {
            return manage.reg.at(slot).bind;
        }
    };
}

#endif
