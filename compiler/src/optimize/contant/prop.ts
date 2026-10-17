//常量传播
import {cprop, cprop_offset_record, cprop_param_record, cprop_record, pool_const, read_const, set_arg, slang_opt_visitor} from '../tool'
import {
    BINARY,
    BIT_NOT,
    CMP,
    ControlStream,
    ControlStreamCond,
    IN,
    IRArgs,
    LOAD,
    MOV,
    NOT, OFFSET_GET, OFFSET_SET,
    OUT, PARAM_LOAD, PARAM_SET, PUSH,
    RET
} from '../../utils'
const CPROP_LOAD:slang_opt_visitor=(data:LOAD, tool, bid, index)=>{
    //load 的目标槽里就是这个常量
    const v=pool_const(data.data,tool)
    if(typeof v=='number'){
        tool.cprop_table.set(data.reg.data,v)
        tool.sweep(bid,index,new MOV(data.reg,IRArgs.reg(v)))
        return
    }
    tool.cprop_table.delete(data.reg.data)
}
const CPROP_MOV:slang_opt_visitor=(data:MOV,tool,bid,index)=>{
    set_arg(data,'right',cprop(data.right,tool),tool,bid,index)
    cprop_record(data.left,data.right,tool)
}
const CPROP_BINARY:slang_opt_visitor=(data:BINARY,tool,bid,index)=>{
    set_arg(data,'left',cprop(data.left,tool),tool,bid,index)
    set_arg(data,'right',cprop(data.right,tool),tool,bid,index)
}
const CPROP_NOT_OR_BIT_NOT:slang_opt_visitor=(data:NOT|BIT_NOT,tool,bid,index)=>{
    set_arg(data,'right',cprop(data.right,tool),tool,bid,index)
}
const CPROP_CMP:slang_opt_visitor=(data:CMP,tool,bid,index)=>{
    //左值是就地写回的目标,不能换;右值可以
    set_arg(data,'right',cprop(data.right,tool),tool,bid,index)
}
const CPROP_ControlStream:slang_opt_visitor=(data:ControlStream,tool,bid,index)=>{
    set_arg(data,'target',cprop(data.target,tool),tool,bid,index)
    set_arg(data,'frame',cprop(data.frame,tool),tool,bid,index)
    if(data instanceof ControlStreamCond)
        set_arg(data,'cond',cprop(data.cond,tool),tool,bid,index)
}
const CPROP_RET:slang_opt_visitor=(data:RET,tool,bid,index)=>{
    set_arg(data,'frame',cprop(data.frame,tool),tool,bid,index)
}
const CPROP_PUSH:slang_opt_visitor=(data:PUSH,tool,bid,index)=>{
    //push 之后要跨调用,这个槽的已知值不再可信
    tool.cprop_table.delete(data.target.data)
}
const CPROP_OFFSET_SET:slang_opt_visitor=(data:OFFSET_SET,tool,bid,index)=>{
    cprop_offset_record([data.target,data.offset],data.value,tool)
    set_arg(data,'value',cprop(data.value,tool),tool,bid,index)
}
const CPROP_OFFSET_GET:slang_opt_visitor=(data:OFFSET_GET,tool,bid,index)=>{
    set_arg(data,'data',cprop(data.data,tool),tool,bid,index)
    set_arg(data,'offset',cprop(data.offset,tool),tool,bid,index)
}
const CPROP_IN_OR_OUT:slang_opt_visitor=(data:IN|OUT,tool,bid,index)=>{
    //操作数照旧先用已知常量换掉
    set_arg(data,'oper',cprop(data.oper,tool),tool,bid,index)
    set_arg(data,'target',cprop(data.target,tool),tool,bid,index)
    //io 一执行,槽里是什么就完全不可控:后面所有推导必须截断
    tool.clear()
}
const CPROP_PARAM_SET:slang_opt_visitor=(data:PARAM_SET,tool,bid,index)=>{
    set_arg(data,'value',cprop(data.value,tool),tool,bid,index)
    cprop_param_record(data.param,data.value,tool)
}
const CPROP_PARAM_LOAD:slang_opt_visitor=(data:PARAM_LOAD,tool,bid,index)=>{
    set_arg(data,'param',cprop(data.param,tool),tool,bid,index)
}
export default ['constant_prop',new Map<any,slang_opt_visitor>([
    [LOAD,CPROP_LOAD],
    [MOV,CPROP_MOV],
    [BINARY,CPROP_BINARY],
    [NOT,CPROP_NOT_OR_BIT_NOT],
    [BIT_NOT,CPROP_NOT_OR_BIT_NOT],
    [CMP,CPROP_CMP],
    [ControlStream,CPROP_ControlStream],
    [RET,CPROP_RET],
    [PUSH,CPROP_PUSH],
    [OFFSET_SET,CPROP_OFFSET_SET],
    [OFFSET_GET,CPROP_OFFSET_GET],
    [IN,CPROP_IN_OR_OUT],
    [OUT,CPROP_IN_OR_OUT],
    [PARAM_SET,CPROP_PARAM_SET],
    [PARAM_LOAD,CPROP_PARAM_LOAD]
])] as [string,Map<any,slang_opt_visitor>]
