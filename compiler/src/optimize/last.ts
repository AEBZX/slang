//将优化过程中不规范的reg 数字变为load
import {BINARYMap, CMPMap, is_constant, slang_opt_visitor, to_load, to_v} from './tool'
import {
    BINARY,
    BIT_NOT,
    CALL,
    CMP, ControlStream,
    ControlStreamCond,
    CZ, IN,
    IRArgs,
    JMP,
    JZ, LOAD,
    MOV,
    NOT, OFFSET_GET, OFFSET_SET,
    OFFSET_STR_SET, OUT, PARAM_LOAD, PARAM_SET, PUSH, RET,
    THREAD,
    TZ
} from '../utils'
const L_MOV:slang_opt_visitor=(data:MOV,tool,bid,index)=>{
    to_load(data,'right',tool,bid,index)
}
const L_BINARY:slang_opt_visitor=(data:BINARY,tool,bid,index)=>{
    to_load(data,'left',tool,bid,index)
    to_load(data,'right',tool,bid,index)
}
const L_CMP:slang_opt_visitor=(data:CMP,tool,bid,index)=>{
    to_load(data,'right',tool,bid,index)
    to_load(data,'oper',tool,bid,index)
}
const L_NOT_BIT_NOT:slang_opt_visitor=(data:NOT|BIT_NOT,tool,bid,index)=>{
    to_load(data,'right',tool,bid,index)
}
const L_ControlStream:slang_opt_visitor=(data:ControlStream,tool,bid,index)=>{
    to_load(data,'target',tool,bid,index)
    to_load(data,'frame',tool,bid,index)
    if(data instanceof ControlStreamCond)
        to_load(data,'cond',tool,bid,index)
}
const L_RET:slang_opt_visitor=(data:RET,tool,bid,index)=>{
    to_load(data,'frame',tool,bid,index)
}
const L_PUSH:slang_opt_visitor=(data:PUSH,tool,bid,index)=>{
    to_load(data,'target',tool,bid,index)
}
const L_OFFSET_SET:slang_opt_visitor=(data:OFFSET_SET,tool,bid,index)=>{
    to_load(data,'offset',tool,bid,index)
    to_load(data,'value',tool,bid,index)
}
const L_OFFSET_GET:slang_opt_visitor=(data:OFFSET_GET,tool,bid,index)=>{
    to_load(data,'offset',tool,bid,index)
    to_load(data,'data',tool,bid,index)
}
const L_IN_OUT:slang_opt_visitor=(data:IN|OUT,tool,bid,index)=>{
    to_load(data,'oper',tool,bid,index)
    to_load(data,'target',tool,bid,index)
}
const L_PARAM_SET:slang_opt_visitor=(data:PARAM_SET,tool,bid,index)=>{
    to_load(data,'value',tool,bid,index)
}
const L_PARAM_LOAD:slang_opt_visitor=(data:PARAM_LOAD,tool,bid,index)=>{
    to_load(data,'param',tool,bid,index)
}
export default ['last',new Map<any,slang_opt_visitor>([
    [MOV,L_MOV],
    [BINARY,L_BINARY],
    [CMP,L_CMP],
    [NOT,L_NOT_BIT_NOT],
    [BIT_NOT,L_NOT_BIT_NOT],
    [ControlStream,L_ControlStream],
    [RET,L_RET],
    [PUSH,L_PUSH],
    [OFFSET_SET,L_OFFSET_SET],
    [OFFSET_GET,L_OFFSET_GET],
    [IN,L_IN_OUT],
    [OUT,L_IN_OUT],
    [PARAM_SET,L_PARAM_SET],
    [PARAM_LOAD,L_PARAM_LOAD],
])] as [string,Map<any,slang_opt_visitor>]