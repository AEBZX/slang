/*
 *实现的指令:
 *MOV,LOAD,JMP,CALL,THREAD,JZ,CZ,TZ,PARAM_LOAD/SET,PUSH,POP,RET,RETN,GC,CMP
 *OFFSET_SET/GET/ADDR,DELETE
 */
#include "runtime.h"
void mov_r_r(VarPool* data,PoolValue v,PoolOffset o,PoolName n,int a,int b,int c)
{
    v(data,a,b);
}
void mov_r_v(VarPool* data,PoolValue v,PoolOffset o,PoolName n,int a,int b,int c)
{
    v(data,a,static_cast<int>(data->data.get(b).num));
}
void mov_v_r(VarPool* data,PoolValue v,PoolOffset o,PoolName n,int a,int b,int c)
{
    v(data,static_cast<int>(data->data.get(a).num),b);
}
void mov_v_v(VarPool* data,PoolValue v,PoolOffset o,PoolName n,int a,int b,int c)
{
    v(data,static_cast<int>(data->data.get(a).num),static_cast<int>(data->data.get(b).num));
}
void MOV_R_R(Runtime* tool,int a,int b ,int c)
{
    tool->pool->oper({{valueCond(a),valueCond(b),valueCond(c)},mov_r_r});
}
void MOV_R_V(Runtime* tool,int a,int b ,int c)
{
    tool->pool->oper({{valueCond(a),valueCond(b),valueCond(c)},mov_r_v});
}
void MOV_V_R(Runtime* tool,int a,int b ,int c)
{
    tool->pool->oper({{valueCond(a),valueCond(b),valueCond(c)},mov_v_r});
}
void MOV_V_V(Runtime* tool,int a,int b ,int c)
{
    tool->pool->oper({{valueCond(a),valueCond(b),valueCond(c)},mov_v_v});
}
void CALL_R_R(Runtime* tool,int a,int b,int c)
{
}
std::unordered_map<int,CommandRun> basic()
{
    return {
        {0,MOV_R_R},
    };
}