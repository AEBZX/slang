#include "runtime.h"

//二元运算宏:fa/fb/fc 为操作数形式位(0=reg, 1=value),生成 impl+包装
#define BIN3(name, op, fa, fb, fc) \
void name##_f##fa##fb##fc(VarPool* d,PoolValue v,PoolOffset o,PoolName n,int a,int b,int c){ \
    (void)o;(void)n; \
    int A=dst(d,fa,a); \
    int r=(int)d->data.get(src(d,fb,b)).num op (int)d->data.get(src(d,fc,c)).num; \
    v(d,A,d->data.link((double)r)); } \
void name##_F##fa##fb##fc(Runtime* t,int a,int b,int c){ \
    t->pool->oper({{valueCond(a),valueCond(b),valueCond(c)},name##_f##fa##fb##fc}); }
#define BIN3_ALL(name, op) \
BIN3(name,op,0,0,0) BIN3(name,op,0,0,1) BIN3(name,op,0,1,0) BIN3(name,op,0,1,1) \
BIN3(name,op,1,0,0) BIN3(name,op,1,0,1) BIN3(name,op,1,1,0) BIN3(name,op,1,1,1)

BIN3_ALL(add,+) BIN3_ALL(sub,-) BIN3_ALL(mul,*) BIN3_ALL(div,/) BIN3_ALL(mod,%)
BIN3_ALL(shr,>>) BIN3_ALL(shl,<<) BIN3_ALL(and,&) BIN3_ALL(or,|) BIN3_ALL(xor,^)

//一元:not/bit_not(就地:var[A]=link(op 池值(var[A])))
#define UN1(name, op, fa) \
void name##_f##fa(VarPool* d,PoolValue v,PoolOffset o,PoolName n,int a,int b,int c){ \
    (void)o;(void)n;(void)b;(void)c; \
    int A=dst(d,fa,a); \
    int r=op (int)d->data.get(VarPool::unsafeReadVar(d,A)).num; \
    v(d,A,d->data.link((double)r)); } \
void name##_F##fa(Runtime* t,int a,int b,int c){ \
    (void)b;(void)c; \
    t->pool->oper({{valueCond(a)},name##_f##fa}); }
UN1(not,! ,0) UN1(not,! ,1)
UN1(bit_not,~ ,0) UN1(bit_not,~ ,1)

std::unordered_map<int,CommandRun> math()
{
    return {
        {4,add_F000},{5,add_F001},{6,add_F010},{7,add_F011},
        {8,add_F100},{9,add_F101},{10,add_F110},{11,add_F111},
        {12,sub_F000},{13,sub_F001},{14,sub_F010},{15,sub_F011},
        {16,sub_F100},{17,sub_F101},{18,sub_F110},{19,sub_F111},
        {20,mul_F000},{21,mul_F001},{22,mul_F010},{23,mul_F011},
        {24,mul_F100},{25,mul_F101},{26,mul_F110},{27,mul_F111},
        {28,div_F000},{29,div_F001},{30,div_F010},{31,div_F011},
        {32,div_F100},{33,div_F101},{34,div_F110},{35,div_F111},
        {36,mod_F000},{37,mod_F001},{38,mod_F010},{39,mod_F011},
        {40,mod_F100},{41,mod_F101},{42,mod_F110},{43,mod_F111},
        {44,shr_F000},{45,shr_F001},{46,shr_F010},{47,shr_F011},
        {48,shr_F100},{49,shr_F101},{50,shr_F110},{51,shr_F111},
        {52,shl_F000},{53,shl_F001},{54,shl_F010},{55,shl_F011},
        {56,shl_F100},{57,shl_F101},{58,shl_F110},{59,shl_F111},
        {60,and_F000},{61,and_F001},{62,and_F010},{63,and_F011},
        {64,and_F100},{65,and_F101},{66,and_F110},{67,and_F111},
        {68,or_F000},{69,or_F001},{70,or_F010},{71,or_F011},
        {72,or_F100},{73,or_F101},{74,or_F110},{75,or_F111},
        {76,xor_F000},{77,xor_F001},{78,xor_F010},{79,xor_F011},
        {80,xor_F100},{81,xor_F101},{82,xor_F110},{83,xor_F111},
        {106,not_F0},{107,not_F1},
        {108,bit_not_F0},{109,bit_not_F1},
    };
}
