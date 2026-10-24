#include "../main.h"
data::any to_any(const int param_id, const runtime::Runtime* rt)
{
    if (rt->father->pool.string_pool.contains(param_id))
        return data::any(rt->father->pool.string_pool[param_id]);
    return data::any(rt->father->pool.number_pool[param_id]);
}
#define _reg(A,B) int A=B;
#define _value(A,B) int A=static_cast<int>(rt->father->pool.number_pool[B]);
#define _head (runtime::Runtime* rt,const int param1,const int param2,const int param3)
#define INSTRUCTION_NO_PARAM(A,...) void A##_ _head\
    {\
        __VA_ARGS__\
    }
#define INSTRUCTION_ONE_PARAM(A,...) void A##_reg _head\
    {\
        _reg(p1,param1)\
        __VA_ARGS__\
    }\
    void A##_value _head\
    {\
        _value(p1,param1)\
        __VA_ARGS__\
    }
#define INSTRUCTION_TWO_PARAM(A,...) void A##_reg_reg _head\
    {\
        _reg(p1,param1)\
        _reg(p2,param2)\
        __VA_ARGS__\
    }\
    void A##_reg_value _head\
    {\
        _reg(p1,param1)\
        _value(p2,param2)\
        __VA_ARGS__\
    }\
    void A##_value_reg _head\
    {\
        _value(p1,param1)\
        _reg(p2,param2)\
        __VA_ARGS__\
    }\
    void A##_value_value _head\
    {\
        _value(p1,param1)\
        _value(p2,param2)\
        __VA_ARGS__\
    }
#define INSTRUCTION_THREE_PARAM(A,...) void A##_reg_reg_reg _head\
    {\
        _reg(p1,param1)\
        _reg(p2,param2)\
        _reg(p3,param3)\
        __VA_ARGS__\
    }\
    void A##_reg_reg_value _head\
    {\
        _reg(p1,param1)\
        _reg(p2,param2)\
        _value(p3,param3)\
        __VA_ARGS__\
    }\
    void A##_reg_value_reg _head\
    {\
        _reg(p1,param1)\
        _value(p2,param2)\
        _reg(p3,param3)\
        __VA_ARGS__\
    }\
    void A##_reg_value_value _head\
    {\
        _value(p1,param1)\
        _value(p2,param2)\
        _value(p3,param3)\
        __VA_ARGS__\
    }\
    void A##_value_reg_reg _head\
    {\
        _value(p1,param1)\
        _reg(p2,param2)\
        _reg(p3,param3)\
        __VA_ARGS__\
    }\
    void A##_value_reg_value _head\
    {\
        _value(p1,param1)\
        _reg(p2,param2)\
        _value(p3,param3)\
        __VA_ARGS__\
    }\
    void A##_value_value_reg _head\
    {\
        _value(p1,param1)\
        _value(p2,param2)\
        _reg(p3,param3)\
        __VA_ARGS__\
    }\
    void A##_value_value_value _head\
    {\
        _value(p1,param1)\
        _value(p2,param2)\
        _value(p3,param3)\
        __VA_ARGS__\
    }
INSTRUCTION_TWO_PARAM(load,{
    rt->father->pool.link(p2);
    rt->father->reg[p1].bind=p2;
})
INSTRUCTION_TWO_PARAM(mov,{
    rt->father->reg[p1]=rt->father->reg[p2];
})
INSTRUCTION_THREE_PARAM(add,{
    double a=rt->father->pool.number_pool[p2];
    double b=rt->father->pool.number_pool[p3];
    int result_id=rt->father->pool.id_number(a+b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(sub,{
    double a=rt->father->pool.number_pool[p2];
    double b=rt->father->pool.number_pool[p3];
    int result_id=rt->father->pool.id_number(a-b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(mul,{
    double a=rt->father->pool.number_pool[p2];
    double b=rt->father->pool.number_pool[p3];
    int result_id=rt->father->pool.id_number(a*b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(div,{
    double a=rt->father->pool.number_pool[p2];
    double b=rt->father->pool.number_pool[p3];
    int result_id=rt->father->pool.id_number(a/b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(mod,{
    double a=rt->father->pool.number_pool[p2];
    double b=rt->father->pool.number_pool[p3];
    int result_id=rt->father->pool.id_number((int)a%(int)b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(shl,{
    double a=rt->father->pool.number_pool[p2];
    double b=rt->father->pool.number_pool[p3];
    int result_id=rt->father->pool.id_number((int)a<<(int)b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(shr,{
    double a=rt->father->pool.number_pool[p2];
    double b=rt->father->pool.number_pool[p3];
    int result_id=rt->father->pool.id_number((int)a>>(int)b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(and,{
    double a=rt->father->pool.number_pool[p2];
    double b=rt->father->pool.number_pool[p3];
    int result_id=rt->father->pool.id_number((int)a&(int)b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(or,{
    double a=rt->father->pool.number_pool[p2];
    double b=rt->father->pool.number_pool[p3];
    int result_id=rt->father->pool.id_number((int)a|(int)b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(xor,{
    double a=rt->father->pool.number_pool[p2];
    double b=rt->father->pool.number_pool[p3];
    int result_id=rt->father->pool.id_number((int)a^(int)b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_TWO_PARAM(not,{
    double data=rt->father->pool.number_pool[p2];
    int result_id=rt->father->pool.id_number(!(int)data);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_TWO_PARAM(bit_not,{
    double data=rt->father->pool.number_pool[p2];
    int result_id=rt->father->pool.id_number(~(int)data);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(cmp,{
    int c=(int)rt->father->pool.number_pool[p3];
    bool result=false;
    switch (c)
    {
    case 0:
        result=rt->father->reg[p1].bind==rt->father->reg[p2].bind;
        break;
    case 1:
        result=rt->father->pool.number_pool[rt->father->reg[p1].bind]>
        rt->father->pool.number_pool[rt->father->reg[p2].bind];
        break;
    case 2:
        result=rt->father->pool.number_pool[rt->father->reg[p1].bind]<
        rt->father->pool.number_pool[rt->father->reg[p2].bind];
        break;
    case 3:
        result=rt->father->pool.number_pool[rt->father->reg[p1].bind]!=
        rt->father->pool.number_pool[rt->father->reg[p2].bind];
        break;
    case 4:
        result=rt->father->pool.number_pool[rt->father->reg[p1].bind]>=
        rt->father->pool.number_pool[rt->father->reg[p2].bind];
        break;
    case 5:
        result=rt->father->pool.number_pool[rt->father->reg[p1].bind]<=
        rt->father->pool.number_pool[rt->father->reg[p2].bind];
        break;
    }
    int id=rt->father->pool.id_number(result?1:0);
    rt->father->pool.link(id);
    rt->father->reg[p1].bind=id;
})
INSTRUCTION_TWO_PARAM(jmp,{
    int data=(int)rt->father->pool.number_pool[p1];
    //JMP直接跳转不需要帧保存
    rt->now.instruction=&rt->father->command[data];
})
INSTRUCTION_TWO_PARAM(call,{
    int data=(int)rt->father->pool.number_pool[p1];
    int frame=(int)rt->father->pool.number_pool[p2];
    rt->now.type=frame;
    rt->frames.push(rt->now);
    rt->now.pc=data;
    rt->now.instruction=&rt->father->command[data];
})
INSTRUCTION_TWO_PARAM(thread,{
    int data=(int)rt->father->pool.number_pool[p1];
    int frame=(int)rt->father->pool.number_pool[p2];
    rt->father->malloc(data,frame,rt);
})
INSTRUCTION_THREE_PARAM(jz,{
    int data=(int)rt->father->pool.number_pool[p1];
    int cond=(int)rt->father->pool.number_pool[p3];
    if (cond==1)rt->now.instruction=&rt->father->command[data];
})
INSTRUCTION_THREE_PARAM(call,{
    int data=(int)rt->father->pool.number_pool[p1];
    int frame=(int)rt->father->pool.number_pool[p2];
    int cond=(int)rt->father->pool.number_pool[p3];
    if (cond==0)return;
    rt->now.type=frame;
    rt->frames.push(rt->now);
    rt->now.pc=data;
    rt->now.instruction=&rt->father->command[data];
})
INSTRUCTION_THREE_PARAM(thread,{
    int data=(int)rt->father->pool.number_pool[p1];
    int frame=(int)rt->father->pool.number_pool[p2];
    int cond=(int)rt->father->pool.number_pool[p3];
    if (cond==0)return;
    rt->father->malloc(data,frame,rt);
})
INSTRUCTION_ONE_PARAM(ret,{
    int need_frame=rt->father->pool.number_pool[p1];
    for (int i=0;i<rt->frames.size();i++)
    {
        rt->now=rt->frames.top();
        rt->frames.pop();
        if (rt->now.type==need_frame)return;
    }
    //没有说明可以停了
    rt->father->stop();
})
INSTRUCTION_ONE_PARAM(push,{
    rt->_stack.push(data::KV<int,runtime::Reg>(p1,rt->father->reg[p1]));
})
INSTRUCTION_NO_PARAM(pop,{
    data::KV<int,runtime::Reg>* pop_reg=&rt->_stack.top();
    rt->_stack.pop();
    rt->father->reg[pop_reg->key]=pop_reg->value;
})
INSTRUCTION_THREE_PARAM(offset_set,{
    runtime::Reg* reg=&rt->father->reg[p1];
    data::any offset=to_any(p2,rt);
    if (offset.is_num&&reg->offset_bind.contains(offset.num))
    {
        rt->father->reg[reg->offset_bind[offset.num]]=rt->father->reg[p3];
        return;
    }
    if (!offset.is_num&&reg->name_bind.contains(offset.str))
    {
        rt->father->reg[reg->name_bind[offset.str]]=rt->father->reg[p3];
        return;
    }
    int id=data::id();
    rt->father->reg[id]=rt->father->reg[p3];
    if (offset.is_num)reg->offset_bind[offset.num]=id;
    else reg->name_bind[offset.str]=id;
})
INSTRUCTION_THREE_PARAM(offset_get,{
    data::any offset=to_any(p3,rt);
    runtime::Reg* reg=&rt->father->reg[p2];
    if ((offset.is_num&&!reg->offset_bind.contains(offset.num))
        ||(!offset.is_num&&!reg->name_bind.contains(offset.str)))
    {
        rt->father->reg[p1]=*rt->father->null_reg;
        return;
    }
    rt->father->reg[p1]=
        rt->father->reg[offset.is_num?reg->offset_bind[offset.num]:reg->name_bind[offset.str]];
})
INSTRUCTION_THREE_PARAM(offset_addr,{
    data::any offset=to_any(p3,rt);
    runtime::Reg* reg=&rt->father->reg[p2];
    int id=rt->father->pool.id_number(offset.is_num?reg->offset_bind[offset.num]:reg->name_bind[offset.str]);
    rt->father->pool.link(id);
    rt->father->reg[p1].bind=id;
})
INSTRUCTION_THREE_PARAM(offset_str_set,{
    runtime::Reg* reg=&rt->father->reg[p1];
    data::any offset=to_any(p2,rt);
    if (!offset.is_num)return;
    if (reg->offset_bind.contains(offset.num))
    {
        rt->father->reg[reg->offset_bind[offset.num]]=rt->father->reg[p3];
        return;
    }
    int id=data::id();
    rt->father->reg[id]=rt->father->reg[p3];
    reg->offset_bind[offset.num]=id;
})
INSTRUCTION_THREE_PARAM(offset_str_get,{
    runtime::Reg* reg=&rt->father->reg[p2];
    data::any offset=to_any(p3,rt);
    if (!offset.is_num)return;
    rt->father->reg[p1]=rt->father->reg[reg->offset_bind[offset.num]];
})
INSTRUCTION_THREE_PARAM(offset_str_addr,{
    runtime::Reg* reg=&rt->father->reg[p2];
    data::any offset=to_any(p3,rt);
    if (!offset.is_num)return;
    int id=rt->father->pool.id_number(reg->offset_bind[offset.num]);
    rt->father->pool.link(id);
    rt->father->reg[p1].bind=id;
})
INSTRUCTION_NO_PARAM(gc,{
    rt->father->gc();
})
INSTRUCTION_ONE_PARAM(delete,{
    rt->father->delete_reg(p1);
})
INSTRUCTION_TWO_PARAM(param_set,{
    rt->param[p1]=rt->father->reg[p2];
})
INSTRUCTION_TWO_PARAM(param_load,{
    rt->father->reg[p1]=rt->param[p2];
})