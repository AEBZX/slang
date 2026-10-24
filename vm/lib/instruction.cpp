#include "../main.h"
data::any to_any(const int param_id, const runtime::Runtime* rt)
{
    if (rt->father->pool.string_pool.contains(param_id))
        return data::any(rt->father->pool.string_pool[param_id]);
    return data::any(rt->father->pool.number_pool[param_id]);
}
data::any offset_get(std::string key,runtime::Reg* reg,runtime::Runtime* rt)
{
    runtime::Reg ls=rt->father->reg[reg->name_bind[key]];
    if (rt->father->pool.number_pool.contains(ls.bind))return data::any(rt->father->pool.number_pool[ls.bind]);
    if (rt->father->pool.string_pool.contains(ls.bind))return data::any(rt->father->pool.string_pool[ls.bind]);
    return data::any("\0");
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
                    rt->father->reg[reg_id]={link_id};
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
                std::string write;
                for (int i=0;i<data.offset_bind.size();i++)
                    write[i]=rt->father->pool.number_pool[data.offset_bind[i]];
                int linked_id=rt->father->pool.id_number(util::writeBinary(path,write));
                rt->father->pool.link(linked_id);
                output.bind=linked_id;
            }
            if (write_type=="text")
            {
                std::string write=rt->father->pool.string_pool[data.bind];
                int linked_id=rt->father->pool.id_number(util::writeText(path,write));
                rt->father->pool.link(linked_id);
                output.bind=linked_id;
            }
        }
        if (oper=="delete")
        {
            const std::string path=offset_get("path",&reg,rt).str;
            const std::string mode=offset_get("mode",&reg,rt).str;
            int result;
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
            int result;
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
            int result;
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
    std::string bind=rt->father->pool.string_pool[reg->bind];
    bind[offset.num]=rt->father->pool.string_pool[rt->father->reg[id].bind][0];
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
    if (rt->param.contains(p2))rt->father->reg[p1]=rt->param[p2];
    else rt->father->reg[p1]=*rt->father->null_reg;
})
INSTRUCTION_TWO_PARAM(in,{
    std::string type=rt->father->pool.string_pool[p1];
    in(type,rt->father->reg[p2],rt);
})
INSTRUCTION_TWO_PARAM(out,{
    std::string type=rt->father->pool.string_pool[rt->father->reg[p2].bind];
    int pid=offset_get("pid",&rt->father->reg[p2],rt).num;
    rt->father->reg[offset_get("data",&rt->father->reg[p2],rt).num]=
        rt->out[type][pid];
})