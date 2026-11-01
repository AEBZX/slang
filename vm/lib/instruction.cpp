#include "../main.h"
data::any to_any(const int param_id, const runtime::Runtime* rt)
{
    return rt->father->pool.value(param_id);
}
double number_of(const int id, const runtime::Runtime* rt)
{
    return rt->father->pool.number(id);
}
//reg 形式的源是立即数
runtime::Reg immediate_reg(runtime::Runtime* rt,const int v)
{
    int id=rt->father->pool.id_number(v);
    rt->father->pool.link(id);
    runtime::Reg r;
    r.bind=id;
    return r;
}
data::any offset_get(std::string key,runtime::Reg* reg,runtime::Runtime* rt)
{
    runtime::Reg ls=rt->father->reg[reg->name_bind[key]];
    return rt->father->pool.value(ls.bind);
}
void in(const std::string& type,runtime::Reg reg,runtime::Runtime* rt)
{
    const std::string oper=offset_get("oper",&reg,rt).str;
    const int get_id=static_cast<int>(offset_get("id",&reg,rt).num);
    runtime::Reg output;
    if (type == "file")
    {
        if (oper=="read")
        {
            const std::string path=offset_get("path",&reg,rt).str;
            const std::string read_type=offset_get("mode",&reg,rt).str;
            std::string result;
            if (read_type=="binary")
            {
                result=util::readBinary(path);
                int link_id;
                int reg_id;
                for (int i=0;i<result.size();i++)
                {
                    reg_id=data::id();
                    link_id=rt->father->pool.id_number(result[i]);
                    rt->father->pool.link(link_id);
                    runtime::Reg r;
                    r.bind=link_id;
                    rt->father->write_slot(reg_id,r);
                    output.offset_bind[i]=reg_id;
                }
            }
            if (read_type=="text")
            {
                result=util::readText(path);
                int linked_id=rt->father->pool.id_string(result);
                rt->father->pool.link(linked_id);
                output.bind=linked_id;
            }
        }
        if (oper=="write")
        {
            const std::string path=offset_get("path",&reg,rt).str;
            const std::string write_type=offset_get("mode",&reg,rt).str;
            runtime::Reg data=rt->father->reg[reg.name_bind["data"]];
            if (write_type=="binary")
            {
                //先按元素个数开好空间,空串按下标写是未定义行为
                std::string write(data.offset_bind.size(),'\0');
                for (int i=0;i<data.offset_bind.size();i++)
                    write[i]=rt->father->pool.number(data.offset_bind[i]);
                int linked_id=rt->father->pool.id_number(util::writeBinary(path,write));
                rt->father->pool.link(linked_id);
                output.bind=linked_id;
            }
            if (write_type=="text")
            {
                std::string write=rt->father->pool.str(data.bind);
                int linked_id=rt->father->pool.id_number(util::writeText(path,write));
                rt->father->pool.link(linked_id);
                output.bind=linked_id;
            }
        }
        if (oper=="delete")
        {
            const std::string path=offset_get("path",&reg,rt).str;
            const std::string mode=offset_get("mode",&reg,rt).str;
            int result=0;
            if (mode=="file")result=util::remove(path);
            if (mode=="dir")result=util::rmdir(path);
            result=rt->father->pool.id_number(result);
            rt->father->pool.link(result);
            output.bind=result;
        }
        if (oper=="create")
        {
            const std::string path=offset_get("path",&reg,rt).str;
            const std::string mode=offset_get("mode",&reg,rt).str;
            int result=0;
            if (mode=="file")result=util::create(path);
            if (mode=="dir")result=util::mkdir(path);
            result=rt->father->pool.id_number(result);
            rt->father->pool.link(result);
            output.bind=result;
        }
        if (oper=="exists")
        {
            const std::string path=offset_get("path",&reg,rt).str;
            const std::string mode=offset_get("mode",&reg,rt).str;
            int result=0;
            if (mode=="file")result=util::isFile(path);
            if (mode=="dir")result=util::isDir(path);
            if (mode=="all")result=util::exists(path);
            result=rt->father->pool.id_number(result);
            rt->father->pool.link(result);
            output.bind=result;
        }
        if (oper=="list")
        {
            const std::string path=offset_get("path",&reg,rt).str;
            std::vector<std::string> result=util::list(path);
            int linked_id;
            for (int i=0;i<result.size();i++)
            {
                linked_id=rt->father->pool.id_string(result[i]);
                rt->father->pool.link(linked_id);
                output.offset_bind[i]=linked_id;
            }
        }
        if (oper=="dir")
        {
            const std::string mode=offset_get("mode",&reg,rt).str;
            std::string result;
            if (mode=="home")result=util::homedir();
            if (mode=="cwd")result=util::cwd();
            int linked_id=rt->father->pool.id_string(result);
            rt->father->pool.link(linked_id);
            output.bind=linked_id;
        }
    }
    if (type == "shell")
    {
        if (oper=="input")
        {
            std::string data=util::input();
            int linked_id=rt->father->pool.id_string(data);
            rt->father->pool.link(linked_id);
            output.bind=linked_id;
        }
        if (oper=="output")
        {
            std::string data=offset_get("data",&reg,rt).str;
            util::print(data);
        }
        if (oper=="bash")
        {
            std::string data=offset_get("data",&reg,rt).str;
            util::command(data);
        }
        if (oper=="param")
        {
            int linked_id,reg_id;
            for (int i=0;i<util::args.size();i++)
            {
                reg_id=data::id();
                linked_id=rt->father->pool.id_string(util::args[i]);
                rt->father->pool.link(linked_id);
                runtime::Reg r;
                r.bind=linked_id;
                rt->father->write_slot(reg_id,r);
                output.offset_bind[i]=reg_id;
            }
        }
    }
    if (type == "net")
    {
        if (oper=="connect")
        {
            std::string host=offset_get("host",&reg,rt).str;
            int result=rt->father->pool.id_number(
                rt->father->net.connect(host)
            );
            rt->father->pool.link(result);
            output.bind=result;
        }
        if (oper=="send")
        {
            int handle=offset_get("handle",&reg,rt).num;
            std::string data=offset_get("data",&reg,rt).str;
            int result=rt->father->pool.id_string(
                rt->father->net.send(handle,data)
            );
            rt->father->pool.link(result);
            output.bind=result;
        }
        if (oper=="recv")
        {
            int handle=offset_get("handle",&reg,rt).num;
            int num=offset_get("num",&reg,rt).num;
            int result=rt->father->pool.id_string(
                rt->father->net.recv(handle,num)
            );
            rt->father->pool.link(result);
            output.bind=result;
        }
        if (oper=="close")
        {
            int handle=offset_get("handle",&reg,rt).num;
            rt->father->net.close(handle);
        }
    }
    rt->out[oper][get_id]=output;
}
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
INSTRUCTION_TWO_PARAM(load,{
    rt->father->pool.link(p2);
    rt->father->reg[p1].bind=p2;
})
static runtime::Reg reg_src(runtime::Runtime* rt,const int param,const int immediate)
{
    return immediate_reg(rt,immediate);
}
static runtime::Reg reg_src(runtime::Runtime* rt,const int param,const double content)
{
    return rt->father->reg[param];
}
INSTRUCTION_TWO_PARAM(mov,{
    rt->father->reg[p1]=reg_src(rt,param2,p2);
})
INSTRUCTION_THREE_PARAM(add,{
    double a=p2;
    double b=p3;
    int result_id=rt->father->pool.id_number(a+b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(sub,{
    double a=p2;
    double b=p3;
    int result_id=rt->father->pool.id_number(a-b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(mul,{
    double a=p2;
    double b=p3;
    int result_id=rt->father->pool.id_number(a*b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(div,{
    double a=p2;
    double b=p3;
    int result_id=rt->father->pool.id_number(a/b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(mod,{
    double a=p2;
    double b=p3;
    int result_id=rt->father->pool.id_number((int)a%(int)b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(shl,{
    double a=p2;
    double b=p3;
    int result_id=rt->father->pool.id_number((int)a<<(int)b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(shr,{
    double a=p2;
    double b=p3;
    int result_id=rt->father->pool.id_number((int)a>>(int)b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(and,{
    double a=p2;
    double b=p3;
    int result_id=rt->father->pool.id_number((int)a&(int)b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(or,{
    double a=p2;
    double b=p3;
    int result_id=rt->father->pool.id_number((int)a|(int)b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_THREE_PARAM(xor,{
    double a=p2;
    double b=p3;
    int result_id=rt->father->pool.id_number((int)a^(int)b);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_TWO_PARAM(not,{
    double data=p2;
    int result_id=rt->father->pool.id_number(!(int)data);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
INSTRUCTION_TWO_PARAM(bit_not,{
    double data=p2;
    int result_id=rt->father->pool.id_number(~(int)data);
    rt->father->pool.link(result_id);
    rt->father->reg[p1].bind=result_id;
})
struct cmp_rhs
{
    double num;
    int id;
    //右操作数所在的槽;reg 形式是立即数,没有槽记 -1
    int slot;
};
static cmp_rhs cmp_src(runtime::Runtime* rt,const int param,const int immediate)
{
    return {static_cast<double>(immediate),rt->father->pool.id_number(immediate),-1};
}
static cmp_rhs cmp_src(runtime::Runtime* rt,const int param,const double content)
{
    return {content,rt->father->reg[param].bind,param};
}
static int cmp_oper(runtime::Runtime* rt,const int param,const int raw)
{
    return raw;
}
static int cmp_oper(runtime::Runtime* rt,const int param,const double content)
{
    return static_cast<int>(content);
}
static bool is(runtime::Runtime* rt,const int left_slot,const int right_slot)
{
    runtime::Reg left=rt->father->reg[left_slot];
    runtime::Reg right=rt->father->reg[right_slot];
    //都是标量(没有偏移表)时只认 bind;容器要比内容
    if (left.name_bind.empty()&&left.offset_bind.empty()
        &&right.name_bind.empty()&&right.offset_bind.empty())
        return left.bind==right.bind;
    if (left.name_bind.size()!=right.name_bind.size())return false;
    if (left.offset_bind.size()!=right.offset_bind.size())return false;
    for (const auto& [name,l_id]:left.name_bind)
    {
        if (!right.name_bind.contains(name))return false;
        if (!is(rt,l_id,right.name_bind[name]))return false;
    }
    for (const auto& [o_id,l_id]:left.offset_bind)
    {
        if (!right.offset_bind.contains(o_id))return false;
        if (!is(rt,l_id,right.offset_bind[o_id]))return false;
    }
    return true;
}
//相等要连容器内容一起比,大小比较只取数值
static bool cmp_equal(runtime::Runtime* rt,const int left_slot,const cmp_rhs& rhs)
{
    if (rhs.slot>=0)return is(rt,left_slot,rhs.slot);
    return rt->father->reg[left_slot].bind==rhs.id;
}
static void cmp_impl(runtime::Runtime* rt,const int left_slot,const cmp_rhs& rhs,const int oper)
{
    const double left=number_of(rt->father->reg[left_slot].bind,rt);
    bool result=false;
    switch (oper)
    {
    case 0:
        result=cmp_equal(rt,left_slot,rhs);
        break;
    case 1:
        result=left>rhs.num;
        break;
    case 2:
        result=left>=rhs.num;
        break;
    case 3:
        result=!cmp_equal(rt,left_slot,rhs);
        break;
    case 4:
        result=left<rhs.num;
        break;
    case 5:
        result=left<=rhs.num;
        break;
    }
    int id=rt->father->pool.id_number(result?1:0);
    rt->father->pool.link(id);
    rt->father->reg[left_slot].bind=id;
}
INSTRUCTION_THREE_PARAM(cmp,{
    const cmp_rhs rhs=cmp_src(rt,param2,p2);
    cmp_impl(rt,param1,rhs,cmp_oper(rt,param3,p3));
})
INSTRUCTION_TWO_PARAM(jmp,{
    while (!rt->frames.empty()&&rt->frames.top().type==p2)
        rt->frames.pop();
    const auto it=rt->father->command.find((int)p1);
    if (it==rt->father->command.end())return;
    rt->now.instruction=&it->second;
    rt->now.pc=0;
})
INSTRUCTION_TWO_PARAM(call,{
    const auto it=rt->father->command.find((int)p1);
    if (it==rt->father->command.end())return;
    rt->now.type=(int)p2;
    rt->frames.push(rt->now);
    rt->now.pc=0;
    rt->now.instruction=&it->second;
})
INSTRUCTION_TWO_PARAM(thread,{
    rt->father->malloc((int)p1,(int)p2,rt);
})
INSTRUCTION_THREE_PARAM(jz,{
    int data=(int)p1;
    int cond=(int)p3;
    if (cond!=1)return;
    const auto it=rt->father->command.find(data);
    if (it==rt->father->command.end())return;
    rt->now.instruction=&it->second;
    rt->now.pc=0;
})
INSTRUCTION_THREE_PARAM(cz,{
    int data=(int)p1;
    int cond=(int)p3;
    if (cond==0)return;
    const auto it=rt->father->command.find(data);
    if (it==rt->father->command.end())return;
    rt->now.type=(int)p2;
    rt->frames.push(rt->now);
    rt->now.pc=0;
    rt->now.instruction=&it->second;
})
INSTRUCTION_THREE_PARAM(tz,{
    int data=(int)p1;
    int cond=(int)p3;
    if (cond==0)return;
    rt->father->malloc(data,(int)p2,rt);
})
INSTRUCTION_ONE_PARAM(ret,{
    //一路退到 frame 类型匹配的那层;退无可退就是程序跑完了
    while (!rt->frames.empty())
    {
        rt->now=rt->frames.top();
        rt->frames.pop();
        if (rt->now.type==p1)return;
    }
    //没有说明可以停了
    rt->father->stop();
})
INSTRUCTION_ONE_PARAM(push,{
    rt->_stack.push(data::KV<int,runtime::Reg>(p1,rt->father->reg[p1]));
})
INSTRUCTION_NO_PARAM(pop,{
    //先拷出来再弹栈,pop 之后指针就是悬空的
    const data::KV<int,runtime::Reg> top=rt->_stack.top();
    rt->_stack.pop();
    rt->father->reg[top.key]=top.value;
})
//offset 家族的键随形式而变:reg 形式是立即数,value 形式取槽里的内容(数字键或名字串)
static data::any offset_key(runtime::Runtime* rt,const int param,const int immediate)
{
    return data::any(static_cast<double>(immediate));
}
static data::any offset_key(runtime::Runtime* rt,const int param,const double content)
{
    return to_any(rt->father->reg[param].bind,rt);
}
static void offset_set_impl(runtime::Runtime* rt,const int container,const data::any& offset,const int value_slot)
{
    runtime::Reg* reg=&rt->father->reg[container];
    if (offset.is_num&&reg->offset_bind.contains(offset.num))
    {
        rt->father->reg[reg->offset_bind[offset.num]]=rt->father->reg[value_slot];
        return;
    }
    if (!offset.is_num&&reg->name_bind.contains(offset.str))
    {
        rt->father->reg[reg->name_bind[offset.str]]=rt->father->reg[value_slot];
        return;
    }
    const int id=data::id();
    rt->father->write_slot(id,rt->father->reg[value_slot]);
    if (offset.is_num)reg->offset_bind[offset.num]=id;
    else reg->name_bind[offset.str]=id;
}
static void offset_get_impl(runtime::Runtime* rt,const int dst,const int container,const data::any& offset)
{
    runtime::Reg* reg=&rt->father->reg[container];
    if ((offset.is_num&&!reg->offset_bind.contains(offset.num))
        ||(!offset.is_num&&!reg->name_bind.contains(offset.str)))
    {
        rt->father->reg[dst]=rt->father->null_reg;
        return;
    }
    rt->father->reg[dst]=
        rt->father->reg[offset.is_num?reg->offset_bind[offset.num]:reg->name_bind[offset.str]];
}
static void offset_addr_impl(runtime::Runtime* rt,const int dst,const int container,const data::any& offset)
{
    runtime::Reg* reg=&rt->father->reg[container];
    int id=rt->father->pool.id_number(offset.is_num?reg->offset_bind[offset.num]:reg->name_bind[offset.str]);
    rt->father->pool.link(id);
    rt->father->reg[dst].bind=id;
}
static void offset_str_set_impl(runtime::Runtime* rt,const int container,const data::any& offset,const int value_slot)
{
    runtime::Reg* reg=&rt->father->reg[container];
    if (!offset.is_num)return;
    int id;
    if (reg->offset_bind.contains(offset.num))id=reg->offset_bind[offset.num];
    else
    {
        id=data::id();
        reg->offset_bind[offset.num]=id;
    }
    rt->father->write_slot(id,rt->father->reg[value_slot]);
    //字符串驻留在池里,偏移槽记下之后还得把字符写回池串,读出来才是新的
    rt->father->pool.str_set_char(reg->bind,offset.num,
        rt->father->pool.str_char(rt->father->reg[id].bind,0));
}
static void offset_str_get_impl(runtime::Runtime* rt,const int dst,const int container,const data::any& offset)
{
    runtime::Reg* reg=&rt->father->reg[container];
    if (!offset.is_num||!reg->offset_bind.contains(offset.num))return;
    rt->father->reg[dst]=rt->father->reg[reg->offset_bind[offset.num]];
}
static void offset_str_addr_impl(runtime::Runtime* rt,const int dst,const int container,const data::any& offset)
{
    runtime::Reg* reg=&rt->father->reg[container];
    if (!offset.is_num||!reg->offset_bind.contains(offset.num))return;
    int id=rt->father->pool.id_number(reg->offset_bind[offset.num]);
    rt->father->pool.link(id);
    rt->father->reg[dst].bind=id;
}
INSTRUCTION_THREE_PARAM(offset_set,{
    offset_set_impl(rt,param1,offset_key(rt,param2,p2),param3);
})
INSTRUCTION_THREE_PARAM(offset_get,{
    offset_get_impl(rt,param1,param2,offset_key(rt,param3,p3));
})
INSTRUCTION_THREE_PARAM(offset_addr,{
    offset_addr_impl(rt,param1,param2,offset_key(rt,param3,p3));
})
INSTRUCTION_THREE_PARAM(offset_str_set,{
    offset_str_set_impl(rt,param1,offset_key(rt,param2,p2),param3);
})
INSTRUCTION_THREE_PARAM(offset_str_get,{
    offset_str_get_impl(rt,param1,param2,offset_key(rt,param3,p3));
})
INSTRUCTION_THREE_PARAM(offset_str_addr,{
    offset_str_addr_impl(rt,param1,param2,offset_key(rt,param3,p3));
})
INSTRUCTION_NO_PARAM(gc,{
    rt->father->gc();
})
INSTRUCTION_ONE_PARAM(delete,{
    rt->father->delete_reg(p1);
})
INSTRUCTION_TWO_PARAM(param_set,{
    rt->param[p1]=reg_src(rt,param2,p2);
})
INSTRUCTION_TWO_PARAM(param_load,{
    if (rt->param.contains(p2))rt->father->reg[p1]=rt->param[p2];
    else rt->father->reg[p1]=rt->father->null_reg;
})
INSTRUCTION_TWO_PARAM(in,{
    std::string type=rt->father->pool.str(rt->father->reg[param1].bind);
    in(type,rt->father->reg[param2],rt);
})
INSTRUCTION_TWO_PARAM(out,{
    runtime::Reg& conf=rt->father->reg[param2];
    std::string type=offset_get("oper",&conf,rt).str;
    int pid=offset_get("pid",&conf,rt).num;
    rt->father->reg[offset_get("data",&conf,rt).num]=
        rt->out[type][pid];
})
void instruction::init()
{
    //load
    run_table[0*8+0]=load_reg_reg;
    run_table[0*8+2]=load_reg_value;
    run_table[0*8+4]=load_value_reg;
    run_table[0*8+6]=load_value_value;
    //mov
    run_table[1*8+0]=mov_reg_reg;
    run_table[1*8+2]=mov_reg_value;
    run_table[1*8+4]=mov_value_reg;
    run_table[1*8+6]=mov_value_value;
    //add,sub,mul,div,mod,shl,shr,and,or,xor
    run_table[(2+0)*8+0]=add_reg_reg_reg;
    run_table[(2+0)*8+1]=add_reg_reg_value;
    run_table[(2+0)*8+2]=add_reg_value_reg;
    run_table[(2+0)*8+3]=add_reg_value_value;
    run_table[(2+0)*8+4]=add_value_reg_reg;
    run_table[(2+0)*8+5]=add_value_reg_value;
    run_table[(2+0)*8+6]=add_value_value_reg;
    run_table[(2+0)*8+7]=add_value_value_value;
    run_table[(2+1)*8+0]=sub_reg_reg_reg;
    run_table[(2+1)*8+1]=sub_reg_reg_value;
    run_table[(2+1)*8+2]=sub_reg_value_reg;
    run_table[(2+1)*8+3]=sub_reg_value_value;
    run_table[(2+1)*8+4]=sub_value_reg_reg;
    run_table[(2+1)*8+5]=sub_value_reg_value;
    run_table[(2+1)*8+6]=sub_value_value_reg;
    run_table[(2+1)*8+7]=sub_value_value_value;
    run_table[(2+2)*8+0]=mul_reg_reg_reg;
    run_table[(2+2)*8+1]=mul_reg_reg_value;
    run_table[(2+2)*8+2]=mul_reg_value_reg;
    run_table[(2+2)*8+3]=mul_reg_value_value;
    run_table[(2+2)*8+4]=mul_value_reg_reg;
    run_table[(2+2)*8+5]=mul_value_reg_value;
    run_table[(2+2)*8+6]=mul_value_value_reg;
    run_table[(2+2)*8+7]=mul_value_value_value;
    run_table[(2+3)*8+0]=div_reg_reg_reg;
    run_table[(2+3)*8+1]=div_reg_reg_value;
    run_table[(2+3)*8+2]=div_reg_value_reg;
    run_table[(2+3)*8+3]=div_reg_value_value;
    run_table[(2+3)*8+4]=div_value_reg_reg;
    run_table[(2+3)*8+5]=div_value_reg_value;
    run_table[(2+3)*8+6]=div_value_value_reg;
    run_table[(2+3)*8+7]=div_value_value_value;
    run_table[(2+4)*8+0]=mod_reg_reg_reg;
    run_table[(2+4)*8+1]=mod_reg_reg_value;
    run_table[(2+4)*8+2]=mod_reg_value_reg;
    run_table[(2+4)*8+3]=mod_reg_value_value;
    run_table[(2+4)*8+4]=mod_value_reg_reg;
    run_table[(2+4)*8+5]=mod_value_reg_value;
    run_table[(2+4)*8+6]=mod_value_value_reg;
    run_table[(2+4)*8+7]=mod_value_value_value;
    run_table[(2+5)*8+0]=shl_reg_reg_reg;
    run_table[(2+5)*8+1]=shl_reg_reg_value;
    run_table[(2+5)*8+2]=shl_reg_value_reg;
    run_table[(2+5)*8+3]=shl_reg_value_value;
    run_table[(2+5)*8+4]=shl_value_reg_reg;
    run_table[(2+5)*8+5]=shl_value_reg_value;
    run_table[(2+5)*8+6]=shl_value_value_reg;
    run_table[(2+5)*8+7]=shl_value_value_value;
    run_table[(2+6)*8+0]=shr_reg_reg_reg;
    run_table[(2+6)*8+1]=shr_reg_reg_value;
    run_table[(2+6)*8+2]=shr_reg_value_reg;
    run_table[(2+6)*8+3]=shr_reg_value_value;
    run_table[(2+6)*8+4]=shr_value_reg_reg;
    run_table[(2+6)*8+5]=shr_value_reg_value;
    run_table[(2+6)*8+6]=shr_value_value_reg;
    run_table[(2+6)*8+7]=shr_value_value_value;
    run_table[(2+7)*8+0]=and_reg_reg_reg;
    run_table[(2+7)*8+1]=and_reg_reg_value;
    run_table[(2+7)*8+2]=and_reg_value_reg;
    run_table[(2+7)*8+3]=and_reg_value_value;
    run_table[(2+7)*8+4]=and_value_reg_reg;
    run_table[(2+7)*8+5]=and_value_reg_value;
    run_table[(2+7)*8+6]=and_value_value_reg;
    run_table[(2+7)*8+7]=and_value_value_value;
    run_table[(2+8)*8+0]=or_reg_reg_reg;
    run_table[(2+8)*8+1]=or_reg_reg_value;
    run_table[(2+8)*8+2]=or_reg_value_reg;
    run_table[(2+8)*8+3]=or_reg_value_value;
    run_table[(2+8)*8+4]=or_value_reg_reg;
    run_table[(2+8)*8+5]=or_value_reg_value;
    run_table[(2+8)*8+6]=or_value_value_reg;
    run_table[(2+8)*8+7]=or_value_value_value;
    run_table[(2+9)*8+0]=xor_reg_reg_reg;
    run_table[(2+9)*8+1]=xor_reg_reg_value;
    run_table[(2+9)*8+2]=xor_reg_value_reg;
    run_table[(2+9)*8+3]=xor_reg_value_value;
    run_table[(2+9)*8+4]=xor_value_reg_reg;
    run_table[(2+9)*8+5]=xor_value_reg_value;
    run_table[(2+9)*8+6]=xor_value_value_reg;
    run_table[(2+9)*8+7]=xor_value_value_value;
    //cmp
    run_table[12*8+0]=cmp_reg_reg_reg;
    run_table[12*8+1]=cmp_reg_reg_value;
    run_table[12*8+2]=cmp_reg_value_reg;
    run_table[12*8+3]=cmp_reg_value_value;
    run_table[12*8+4]=cmp_value_reg_reg;
    run_table[12*8+5]=cmp_value_reg_value;
    run_table[12*8+6]=cmp_value_value_reg;
    run_table[12*8+7]=cmp_value_value_value;
    //not,bit_not
    run_table[13*8+0]=not_reg_reg;
    run_table[13*8+2]=not_reg_value;
    run_table[13*8+4]=not_value_reg;
    run_table[13*8+6]=not_value_value;
    run_table[14*8+0]=bit_not_reg_reg;
    run_table[14*8+2]=bit_not_reg_value;
    run_table[14*8+4]=bit_not_value_reg;
    run_table[14*8+6]=bit_not_value_value;
    //jmp,call,thread
    run_table[15*8+0]=jmp_reg_reg;
    run_table[15*8+2]=jmp_reg_value;
    run_table[15*8+4]=jmp_value_reg;
    run_table[15*8+6]=jmp_value_value;
    run_table[16*8+0]=call_reg_reg;
    run_table[16*8+2]=call_reg_value;
    run_table[16*8+4]=call_value_reg;
    run_table[16*8+6]=call_value_value;
    run_table[17*8+0]=thread_reg_reg;
    run_table[17*8+2]=thread_reg_value;
    run_table[17*8+4]=thread_value_reg;
    run_table[17*8+6]=thread_value_value;
    //jz,cz,tz
    run_table[18*8+0]=jz_reg_reg_reg;
    run_table[18*8+1]=jz_reg_reg_value;
    run_table[18*8+2]=jz_reg_value_reg;
    run_table[18*8+3]=jz_reg_value_value;
    run_table[18*8+4]=jz_value_reg_reg;
    run_table[18*8+5]=jz_value_reg_value;
    run_table[18*8+6]=jz_value_value_reg;
    run_table[18*8+7]=jz_value_value_value;
    run_table[19*8+0]=cz_reg_reg_reg;
    run_table[19*8+1]=cz_reg_reg_value;
    run_table[19*8+2]=cz_reg_value_reg;
    run_table[19*8+3]=cz_reg_value_value;
    run_table[19*8+4]=cz_value_reg_reg;
    run_table[19*8+5]=cz_value_reg_value;
    run_table[19*8+6]=cz_value_value_reg;
    run_table[19*8+7]=cz_value_value_value;
    run_table[20*8+0]=tz_reg_reg_reg;
    run_table[20*8+1]=tz_reg_reg_value;
    run_table[20*8+2]=tz_reg_value_reg;
    run_table[20*8+3]=tz_reg_value_value;
    run_table[20*8+4]=tz_value_reg_reg;
    run_table[20*8+5]=tz_value_reg_value;
    run_table[20*8+6]=tz_value_value_reg;
    run_table[20*8+7]=tz_value_value_value;
    //ret
    run_table[21*8+0]=ret_reg;
    run_table[21*8+4]=ret_value;
    //push
    run_table[22*8+0]=push_reg;
    run_table[22*8+4]=push_value;
    //pop
    run_table[23*8+0]=pop_;
    //offset_set,offset_get,offset_addr,offset_str_set,offset_str_get,offset_str_addr
    run_table[24*8+0]=offset_set_reg_reg_reg;
    run_table[24*8+1]=offset_set_reg_reg_value;
    run_table[24*8+2]=offset_set_reg_value_reg;
    run_table[24*8+3]=offset_set_reg_value_value;
    run_table[24*8+4]=offset_set_value_reg_reg;
    run_table[24*8+5]=offset_set_value_reg_value;
    run_table[24*8+6]=offset_set_value_value_reg;
    run_table[24*8+7]=offset_set_value_value_value;
    run_table[25*8+0]=offset_get_reg_reg_reg;
    run_table[25*8+1]=offset_get_reg_reg_value;
    run_table[25*8+2]=offset_get_reg_value_reg;
    run_table[25*8+3]=offset_get_reg_value_value;
    run_table[25*8+4]=offset_get_value_reg_reg;
    run_table[25*8+5]=offset_get_value_reg_value;
    run_table[25*8+6]=offset_get_value_value_reg;
    run_table[25*8+7]=offset_get_value_value_value;
    run_table[26*8+0]=offset_addr_reg_reg_reg;
    run_table[26*8+1]=offset_addr_reg_reg_value;
    run_table[26*8+2]=offset_addr_reg_value_reg;
    run_table[26*8+3]=offset_addr_reg_value_value;
    run_table[26*8+4]=offset_addr_value_reg_reg;
    run_table[26*8+5]=offset_addr_value_reg_value;
    run_table[26*8+6]=offset_addr_value_value_reg;
    run_table[26*8+7]=offset_addr_value_value_value;
    run_table[27*8+0]=offset_str_set_reg_reg_reg;
    run_table[27*8+1]=offset_str_set_reg_reg_value;
    run_table[27*8+2]=offset_str_set_reg_value_reg;
    run_table[27*8+3]=offset_str_set_reg_value_value;
    run_table[27*8+4]=offset_str_set_value_reg_reg;
    run_table[27*8+5]=offset_str_set_value_reg_value;
    run_table[27*8+6]=offset_str_set_value_value_reg;
    run_table[27*8+7]=offset_str_set_value_value_value;
    run_table[28*8+0]=offset_str_get_reg_reg_reg;
    run_table[28*8+1]=offset_str_get_reg_reg_value;
    run_table[28*8+2]=offset_str_get_reg_value_reg;
    run_table[28*8+3]=offset_str_get_reg_value_value;
    run_table[28*8+4]=offset_str_get_value_reg_reg;
    run_table[28*8+5]=offset_str_get_value_reg_value;
    run_table[28*8+6]=offset_str_get_value_value_reg;
    run_table[28*8+7]=offset_str_get_value_value_value;
    run_table[29*8+0]=offset_str_addr_reg_reg_reg;
    run_table[29*8+1]=offset_str_addr_reg_reg_value;
    run_table[29*8+2]=offset_str_addr_reg_value_reg;
    run_table[29*8+3]=offset_str_addr_reg_value_value;
    run_table[29*8+4]=offset_str_addr_value_reg_reg;
    run_table[29*8+5]=offset_str_addr_value_reg_value;
    run_table[29*8+6]=offset_str_addr_value_value_reg;
    run_table[29*8+7]=offset_str_addr_value_value_value;
    //in,out
    run_table[30*8+0]=in_reg_reg;
    run_table[30*8+2]=in_reg_value;
    run_table[30*8+4]=in_value_reg;
    run_table[30*8+6]=in_value_value;
    run_table[31*8+0]=out_reg_reg;
    run_table[31*8+2]=out_reg_value;
    run_table[31*8+4]=out_value_reg;
    run_table[31*8+6]=out_value_value;
    //gc
    run_table[32*8+0]=gc_;
    //delete
    run_table[33*8+0]=delete_reg;
    run_table[33*8+4]=delete_value;
    //param_set,param_load
    run_table[34*8+0]=param_set_reg_reg;
    run_table[34*8+2]=param_set_reg_value;
    run_table[34*8+4]=param_set_value_reg;
    run_table[34*8+6]=param_set_value_value;
    run_table[35*8+0]=param_load_reg_reg;
    run_table[35*8+2]=param_load_reg_value;
    run_table[35*8+4]=param_load_value_reg;
    run_table[35*8+6]=param_load_value_value;
}