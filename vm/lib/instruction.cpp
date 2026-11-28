#include "../main.h"
#define _reg(A,B) int A=B;
#define _value(A,B) double A=number_of(rt->father->reg[B].bind,rt);
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
        _reg(p1,param1)\
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