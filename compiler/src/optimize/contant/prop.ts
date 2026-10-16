//常量传播
import {cprop, cprop_offset_record, cprop_param_record, cprop_record, slang_opt_visitor, to_v} from '../tool'
import {
    BINARY,
    BIT_NOT,
    CMP,
    ControlStream,
    ControlStreamCond, IN,
    IRArgs,
    LOAD,
    MOV,
    NOT, OFFSET_GET, OFFSET_SET,
    opt_visitor, OUT, PARAM_LOAD, PARAM_SET, POP, PUSH,
    RET
} from '../../utils'
const CPROP_LOAD:slang_opt_visitor=(data:LOAD, tool, bid, index)=>{
    if(data.reg.type=='reg')
        tool.cprop_table.delete(data.reg)
    if(data.reg.type=='reg'&&data.data.type=='reg')
        tool.cprop_table.set(to_v(data.reg),tool.pool.get(data.data.data))
    //能转mov reg a reg b就转
    if(typeof tool.pool.get(data.data.data)=='number')
        tool.sweep(bid,index,new MOV(data.reg,IRArgs.reg(tool.pool.get(data.data.data) as number)))
}
const CPROP_MOV:slang_opt_visitor=(data:MOV,tool,bid,index)=>{
    cprop_record(data.left,data.right,tool)
    data.right=cprop(data.right,tool)
    tool.sweep(bid,index,data)
}
const CPROP_BINARY:slang_opt_visitor=(data:BINARY,tool,bid,index)=>{
    data.left=cprop(data.left,tool)
    data.right=cprop(data.right,tool)
    tool.sweep(bid,index,data)
}
const CPROP_NOT_OR_BIT_NOT:slang_opt_visitor=(data:NOT|BIT_NOT,tool,bid,index)=>{
    data.right=cprop(data.right,tool)
}
const CPROP_CMP:slang_opt_visitor=(data:CMP,tool,bid,index)=>{
    data.right=cprop(data.right,tool)
    data.oper=cprop(data.left,tool)
    tool.sweep(bid,index,data)
}
const CPROP_ControlStream:slang_opt_visitor=(data:ControlStream,tool,bid,index)=>{
    data.target=cprop(data.target,tool)
    data.frame=cprop(data.frame,tool)
    if(data instanceof ControlStreamCond)
        data.cond=cprop(data.cond,tool)
    tool.sweep(bid,index,data)
}
const CPROP_RET:slang_opt_visitor=(data:RET,tool,bid,index)=>{
    data.frame=cprop(data.frame,tool)
    tool.sweep(bid,index,data)
}
const CPROP_PUSH:slang_opt_visitor=(data:PUSH,tool,bid,index)=>{
    if(data.target.type=='reg')
        tool.cprop_table.delete(data.target)
    tool.sweep(bid,index,data)
}
const CPROP_OFFSET_SET:slang_opt_visitor=(data:OFFSET_SET,tool,bid,index)=>{
    if(data.target.type=='reg'&&data.offset.type=='reg')
        tool.cprop_offset_table.delete([data.target,data.offset])
    cprop_offset_record([data.target,data.offset],data.value,tool)
    data.offset=cprop(data.offset,tool)
    data.value=cprop(data.value,tool)
    tool.sweep(bid,index,data)
}
const CPROP_OFFSET_GET:slang_opt_visitor=(data:OFFSET_GET,tool,bid,index)=>{
    data.data=cprop(data.data,tool)
    data.offset=cprop(data.offset,tool)
    tool.sweep(bid,index,data)
}
const CPROP_IN_OR_OUT:slang_opt_visitor=(data:IN|OUT,tool,bid,index)=>{
    tool.cprop_table.clear()
    tool.cprop_param_table.clear()
    tool.cprop_offset_table.clear()
    data.oper=cprop(data.oper,tool)
    data.target=cprop(data.target,tool)
    tool.sweep(bid,index,data)
}
const CPROP_PARAM_SET:slang_opt_visitor=(data:PARAM_SET,tool,bid,index)=>{
    if(data.param.type=='reg')
        tool.cprop_param_table.delete(data.param)
    data.value=cprop(data.value,tool)
    cprop_param_record(data.param,data.value,tool)
    tool.sweep(bid,index,data)
}
const CPROP_PARAM_LOAD:slang_opt_visitor=(data:PARAM_LOAD,tool,bid,index)=>{
    data.param=cprop(data.param,tool)
    tool.sweep(bid,index,data)
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