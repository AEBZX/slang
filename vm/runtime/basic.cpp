#include "runtime.h"
#define MOV_F(fa, fb) \
void mov_f##fa##fb(VarPool* d,PoolValue v,PoolOffset o,PoolName n,int a,int b,int c){ \
    (void)o;(void)n;(void)c; \
    v(d,dst(d,fa,a),src(d,fb,b)); } \
void MOV_F##fa##fb(Runtime* t,int a,int b,int c){ \
    (void)c; \
    t->pool->oper({{valueCond(a),valueCond(b)},mov_f##fa##fb}); }
MOV_F(0,0) MOV_F(0,1) MOV_F(1,0) MOV_F(1,1)
//LOAD:var[A]=池id(reg源=池id原样存槽,value源=var读)——编译器 load 发射的是池 id,必须特例,否则 reg 反查错位
#define LOAD_F(fa, fb) \
void load_f##fa##fb(VarPool* d,PoolValue v,PoolOffset o,PoolName n,int a,int b,int c){ \
    (void)o;(void)n;(void)c; \
    v(d,dst(d,fa,a),key(d,fb,b)); } \
void LOAD_F##fa##fb(Runtime* t,int a,int b,int c){ \
    (void)c; \
    t->pool->oper({{valueCond(a),valueCond(b)},load_f##fa##fb}); }
LOAD_F(0,0) LOAD_F(0,1) LOAD_F(1,0) LOAD_F(1,1)
#define CMP_F(fa, fb, fc) \
void cmp_f##fa##fb##fc(VarPool* d,PoolValue v,PoolOffset o,PoolName n,int a,int b,int c){ \
    (void)o;(void)n; \
    int A=dst(d,fa,a); \
    int pidL=VarPool::unsafeReadVar(d,A); \
    const Const& Lc=d->data.get(pidL); \
    int C=pv(d,fc,c); \
    int r; \
    if(!fb){ \
        /*reg 右值=数值字面量,原语义直接比较*/ \
        double ln=Lc.num, rn=b; \
        r=(C==0)?(ln==rn):(C==1)?(ln!=rn):(C==2)?(ln>rn):(C==3)?(ln<rn):(C==4)?(ln>=rn):(ln<=rn); \
    }else{ \
        /*value 右值=池id,池值比较;双字符串按内容比较(此前恒按 num=0 比较,字符串恒相等)*/ \
        int pidR=VarPool::unsafeReadVar(d,b); \
        const Const& Rc=d->data.get(pidR); \
        if(!Lc.type&&!Rc.type){ \
            int s=Lc.str.compare(Rc.str); \
            r=(C==0)?(s==0):(C==1)?(s!=0):(C==2)?(s>0):(C==3)?(s<0):(C==4)?(s>=0):(s<=0); \
        }else{ \
            double ln=Lc.num, rn=Rc.num; \
            r=(C==0)?(ln==rn):(C==1)?(ln!=rn):(C==2)?(ln>rn):(C==3)?(ln<rn):(C==4)?(ln>=rn):(ln<=rn); \
        } \
    } \
    v(d,A,d->data.link((double)r)); } \
void CMP_F##fa##fb##fc(Runtime* t,int a,int b,int c){ \
    t->pool->oper({{valueCond(a),valueCond(b),valueCond(c)},cmp_f##fa##fb##fc}); }
CMP_F(0,0,0) CMP_F(0,0,1) CMP_F(0,1,0) CMP_F(0,1,1)
CMP_F(1,0,0) CMP_F(1,0,1) CMP_F(1,1,0) CMP_F(1,1,1)
//OFFSET 对象槽操作数用 key 语义:reg→x原样,value→var[x](自引用句柄,编译器map/数组发射对齐)
//OFFSET_SET a b c:offset[A][B]=新建/复用var,var[vid]=src(C)
#define OFFSET_SET_F(fa, fb, fc) \
void offset_set_f##fa##fb##fc(VarPool* d,PoolValue v,PoolOffset o,PoolName n,int a,int b,int c){ \
    (void)v;(void)n; \
    int A=key(d,fa,a), B=key(d,fb,b); \
    int vid; \
    if (d->hasOffset(A,B)) vid=VarPool::unsafeReadOffset(d,A,B); \
    else { vid=d->alloc(); o(d,A,B,vid); } \
    v(d,vid,src(d,fc,c)); } \
void OFFSET_SET_F##fa##fb##fc(Runtime* t,int a,int b,int c){ \
    t->pool->oper({{valueCond(a),valueCond(b),valueCond(c)},offset_set_f##fa##fb##fc}); }
OFFSET_SET_F(0,0,0) OFFSET_SET_F(0,0,1) OFFSET_SET_F(0,1,0) OFFSET_SET_F(0,1,1)
OFFSET_SET_F(1,0,0) OFFSET_SET_F(1,0,1) OFFSET_SET_F(1,1,0) OFFSET_SET_F(1,1,1)

//OFFSET_GET a b c:var[A]=var[offset[B][C]]
//vid==0 表示 offset 越界(不存在,编译器槽号从1起),返回 null 值("\0" 池id)
//foreach 终止依赖 arr[i]!=null,越界若返回槽0残留(返回值槽)会死循环
#define OFFSET_GET_F(fa, fb, fc) \
void offset_get_f##fa##fb##fc(VarPool* d,PoolValue v,PoolOffset o,PoolName n,int a,int b,int c){ \
    (void)o;(void)n; \
    int A=key(d,fa,a); \
    int vid=VarPool::unsafeReadOffset(d,key(d,fb,b),key(d,fc,c)); \
    if(vid==0) \
        v(d,A,d->data.link(std::string("\0",1))); \
    else \
        v(d,A,VarPool::unsafeReadVar(d,vid)); } \
void OFFSET_GET_F##fa##fb##fc(Runtime* t,int a,int b,int c){ \
    t->pool->oper({{valueCond(a),valueCond(b),valueCond(c)},offset_get_f##fa##fb##fc}); }
OFFSET_GET_F(0,0,0) OFFSET_GET_F(0,0,1) OFFSET_GET_F(0,1,0) OFFSET_GET_F(0,1,1)
OFFSET_GET_F(1,0,0) OFFSET_GET_F(1,0,1) OFFSET_GET_F(1,1,0) OFFSET_GET_F(1,1,1)

//OFFSET_ADDR a b c:var[A]=offset[B][C] 的 var_id(地址=槽号,不 link 成池id)
//编译器取地址后 mov value 解引用写 var[var[A]];link(vid) 会把槽号当池id,写入错槽
#define OFFSET_ADDR_F(fa, fb, fc) \
void offset_addr_f##fa##fb##fc(VarPool* d,PoolValue v,PoolOffset o,PoolName n,int a,int b,int c){ \
    (void)o;(void)n; \
    int A=key(d,fa,a); \
    int vid=VarPool::unsafeReadOffset(d,key(d,fb,b),key(d,fc,c)); \
    v(d,A,vid); } \
void OFFSET_ADDR_F##fa##fb##fc(Runtime* t,int a,int b,int c){ \
    t->pool->oper({{valueCond(a),valueCond(b),valueCond(c)},offset_addr_f##fa##fb##fc}); }
OFFSET_ADDR_F(0,0,0) OFFSET_ADDR_F(0,0,1) OFFSET_ADDR_F(0,1,0) OFFSET_ADDR_F(0,1,1)
OFFSET_ADDR_F(1,0,0) OFFSET_ADDR_F(1,0,1) OFFSET_ADDR_F(1,1,0) OFFSET_ADDR_F(1,1,1)
inline void push_frame(Runtime* t,const int target,const int frame_type)
{
    t->indexStack.push(t->block);
    t->indexStack.push(t->index + 1);
    t->blockStack.push(frame_type);
    t->block = target;
    t->index = -1;
}
//jz:cond 真时跳块
void JZ_R_R(Runtime* t, const int a, const int b, const int c)
{
    (void)c;
    if (pv(t->pool,0,b) != 0){ t->block = pv(t->pool,0,a); t->index = -1; }
}
void JZ_R_V(Runtime* t,int a,int b,int c)
{
    (void)c;
    if (pv(t->pool,1,b) != 0){ t->block = pv(t->pool,0,a); t->index = -1; }
}
void JZ_V_R(Runtime* t,int a,int b,int c)
{
    (void)c;
    if (pv(t->pool,0,b) != 0){ t->block = pv(t->pool,1,a); t->index = -1; }
}
void JZ_V_V(Runtime* t,int a,int b,int c)
{
    (void)c;
    if (pv(t->pool,1,b) != 0){ t->block = pv(t->pool,1,a); t->index = -1; }
}
//cz:cond 真时压帧跳块,帧类型=c(0=块帧,1=函数帧,2=循环帧)
void CZ_R_R(Runtime* t,int a,int b,int c)
{
    if (pv(t->pool,0,b) != 0) push_frame(t,pv(t->pool,0,a),c);
}
void CZ_R_V(Runtime* t,int a,int b,int c)
{
    if (pv(t->pool,1,b) != 0) push_frame(t,pv(t->pool,0,a),c);
}
void CZ_V_R(Runtime* t,int a,int b,int c)
{
    if (pv(t->pool,0,b) != 0) push_frame(t,pv(t->pool,1,a),c);
}
void CZ_V_V(Runtime* t,int a,int b,int c)
{
    if (pv(t->pool,1,b) != 0) push_frame(t,pv(t->pool,1,a),c);
}
//call:无条件压函数帧跳块
void CALL_R(Runtime* t,int a,int b,int c)
{
    (void)c;
    push_frame(t,pv(t->pool,0,a),b != 0);
}
void CALL_V(Runtime* t,int a,int b,int c)
{
    (void)c;
    push_frame(t,pv(t->pool,1,a),b != 0);
}
//jmp:无条件跳块
void JMP_R(Runtime* t,int a,int b,int c)
{
    (void)b;(void)c;
    t->block = pv(t->pool,0,a); t->index = -1;
}
void JMP_V(Runtime* t,int a,int b,int c)
{
    (void)b;(void)c;
    t->block = pv(t->pool,1,a); t->index = -1;
}
//tz/thread:新建线程跑块a(经 Runtime._join 钩子,线程化由 Manage 实现)
void TZ_R_R(Runtime* t,int a,int b,int c)
{
    (void)c;
    if (pv(t->pool,0,b) != 0) t->_join(t->m,pv(t->pool,0,a));
}
void TZ_R_V(Runtime* t,int a,int b,int c)
{
    (void)c;
    if (pv(t->pool,1,b) != 0) t->_join(t->m,pv(t->pool,0,a));
}
void TZ_V_R(Runtime* t,int a,int b,int c)
{
    (void)c;
    if (pv(t->pool,0,b) != 0) t->_join(t->m,pv(t->pool,1,a));
}
void TZ_V_V(Runtime* t,int a,int b,int c)
{
    (void)c;
    if (pv(t->pool,1,b) != 0) t->_join(t->m,pv(t->pool,1,a));
}
void THREAD_R(Runtime* t,int a,int b,int c)
{
    (void)b;(void)c;
    t->_join(t->m,pv(t->pool,0,a));
}
void THREAD_V(Runtime* t,int a,int b,int c)
{
    (void)b;(void)c;
    t->_join(t->m,pv(t->pool,1,a));
}
//ret:break 语义——弹帧直到最近循环帧(含),退出循环返回循环后代码
//嵌套 if 内的 break 弹回 body 块会执行 continue 的 jmp 死循环,故必须一次弹到循环帧
//无循环帧(switch 内 break/普通块)弹一帧(原语义);遇函数帧不越过
void RET(Runtime* t,int a,int b,int c)
{
    (void)a;(void)b;(void)c;
    while (t->blockStack.size() > 0)
    {
        const int type = t->blockStack.peek();
        const int ret_idx = t->indexStack.pop();
        const int ret_blk = t->indexStack.pop();
        t->blockStack.pop();
        t->block = ret_blk;
        t->index = ret_idx - 1;
        if (type == 2 || type == 1) return;   //循环帧/函数帧:弹掉即返回
        //块帧:继续弹(级联),直到循环帧
    }
    t->alive = false;
}
void RETN(Runtime* t,int a,int b,int c)
{
    (void)a;(void)b;(void)c;
    while (t->blockStack.size() > 0)
    {
        const bool is_func = t->blockStack.peek();
        const int ret_idx = t->indexStack.pop();
        const int ret_blk = t->indexStack.pop();
        t->blockStack.pop();
        if (is_func)
        {
            t->block = ret_blk;
            t->index = ret_idx - 1;
            return;
        }
    }
    t->alive = false;
}
//gc:触发回收(清理死线程+常量池gc)
void GC(Runtime* t,int a,int b,int c)
{
    (void)a;(void)b;(void)c;
    t->m->gc();
}

//========== param / 栈(存 pool_id) ==========
//param_set:param[A]=src(B)
void PARAM_SET_R_R(Runtime* t,int a,int b,int c)
{
    (void)c;
    t->param[a] = src(t->pool,0,b);
}
void PARAM_SET_R_V(Runtime* t,int a,int b,int c)
{
    (void)c;
    t->param[a] = src(t->pool,1,b);
}
void PARAM_SET_V_R(Runtime* t,int a,int b,int c)
{
    (void)c;
    t->param[dst(t->pool,1,a)] = src(t->pool,0,b);
}
void PARAM_SET_V_V(Runtime* t,int a,int b,int c)
{
    (void)c;
    t->param[dst(t->pool,1,a)] = src(t->pool,1,b);
}
//param_load:var[A]=param[B]
void PARAM_LOAD_R_R(Runtime* t,int a,int b,int c)
{
    (void)c;
    VarPool::writeVar(t->pool,a,t->param[b]);
}
void PARAM_LOAD_R_V(Runtime* t,int a,int b,int c)
{
    (void)c;
    VarPool::writeVar(t->pool,a,t->param[src(t->pool,0,b)]);
}
void PARAM_LOAD_V_R(Runtime* t,int a,int b,int c)
{
    (void)c;
    VarPool::writeVar(t->pool,dst(t->pool,1,a),t->param[b]);
}
void PARAM_LOAD_V_V(Runtime* t,int a,int b,int c)
{
    (void)c;
    VarPool::writeVar(t->pool,dst(t->pool,1,a),t->param[src(t->pool,0,b)]);
}
//push/pop:操作数栈(push 恒发基址118,编译器无 value 变体,故不注册 PUSH_V)
//push 压槽内容(reg 语义=原样值,但这里需 var[a] 槽值,否则保存恢复全错位)
void PUSH_R(Runtime* t,int a,int b,int c)
{
    (void)b;(void)c;
    t->stack.push(VarPool::unsafeReadVar(t->pool,a));
}
void POP_R(Runtime* t,int a,int b,int c)
{
    (void)b;(void)c;
    VarPool::writeVar(t->pool,a,t->stack.pop());
}

//========== DELETE:释放槽指向的常量(引用计数) ==========
void DELETE_R(Runtime* t,int a,int b,int c)
{
    (void)b;(void)c;
    t->pool->data.delete_(VarPool::unsafeReadVar(t->pool,a));
}
void DELETE_V(Runtime* t,int a,int b,int c)
{
    (void)b;(void)c;
    t->pool->data.delete_(src(t->pool,1,a));
}

std::unordered_map<int,CommandRun> basic()
{
    return {
        {0,MOV_F00},{1,MOV_F01},{2,MOV_F10},{3,MOV_F11},
        {84,LOAD_F00},{85,LOAD_F01},{86,LOAD_F10},{87,LOAD_F11},
        {88,CZ_R_R},{89,CZ_R_V},{90,CZ_V_R},{91,CZ_V_V},
        {92,JZ_R_R},{93,JZ_R_V},{94,JZ_V_R},{95,JZ_V_V},
        {96,TZ_R_R},{97,TZ_R_V},{98,TZ_V_R},{99,TZ_V_V},
        {100,CALL_R},{101,CALL_V},
        {102,JMP_R},{103,JMP_V},
        {104,THREAD_R},{105,THREAD_V},
        {110,CMP_F000},{111,CMP_F001},{112,CMP_F010},{113,CMP_F011},
        {114,CMP_F100},{115,CMP_F101},{116,CMP_F110},{117,CMP_F111},
        {118,PUSH_R},
        {120,POP_R},
        {169,RETN},{122,RET},{123,GC},
        {124,OFFSET_SET_F000},{125,OFFSET_SET_F001},{126,OFFSET_SET_F010},{127,OFFSET_SET_F011},
        {128,OFFSET_SET_F100},{129,OFFSET_SET_F101},{130,OFFSET_SET_F110},{131,OFFSET_SET_F111},
        {132,OFFSET_GET_F000},{133,OFFSET_GET_F001},{134,OFFSET_GET_F010},{135,OFFSET_GET_F011},
        {136,OFFSET_GET_F100},{137,OFFSET_GET_F101},{138,OFFSET_GET_F110},{139,OFFSET_GET_F111},
        {140,OFFSET_ADDR_F000},{141,OFFSET_ADDR_F001},{142,OFFSET_ADDR_F010},{143,OFFSET_ADDR_F011},
        {144,OFFSET_ADDR_F100},{145,OFFSET_ADDR_F101},{146,OFFSET_ADDR_F110},{147,OFFSET_ADDR_F111},
        {159,PARAM_SET_R_R},{160,PARAM_SET_R_V},{161,PARAM_SET_V_R},{162,PARAM_SET_V_V},
        {163,PARAM_LOAD_R_R},{164,PARAM_LOAD_R_V},{165,PARAM_LOAD_V_R},{166,PARAM_LOAD_V_V},
        {167,DELETE_R},{168,DELETE_V},
    };
}
