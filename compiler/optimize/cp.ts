import {
    BINARY,
    CALL,
    CMP,
    CZ, IN,
    JMP,
    JZ,
    LOAD,
    MOV, OFFSET_ADDR,
    OFFSET_GET,
    OFFSET_SET,
    opt_visitor, OUT, PARAM_LOAD, PARAM_SET,
    PUSH,
    THREAD,
    TZ
} from '../utils'
export const C_MOV:opt_visitor=(data:MOV, tool, bid, index)=>tool.$.cp2(data.right,bid,index,data.left)
export const C_BINARY:opt_visitor=(data:BINARY, tool, bid, index)=>{
    tool.$.cp1(data.left,bid,index)
    tool.$.cp1(data.right,bid,index)
}
export const C_CMP:opt_visitor=(data:CMP, tool, bid, index)=>{
    tool.$.cp1(data.right,bid,index)
    tool.$.cp1(data.oper,bid,index)
}
export const C_BZ:opt_visitor=(data:JZ|CZ|TZ, tool, bid, index)=>{
    tool.$.cp1(data.cond,bid,index)
    tool.$.cp1(data.target,bid,index)
}
export const C_B:opt_visitor=(data:JMP|CALL|THREAD, tool, bid, index)=>{
    tool.$.cp1(data.target,bid,index)
}
export const C_PUSH:opt_visitor=(data:PUSH, tool, bid, index)=>{
    tool.$.cp1(data.target,bid,index)
}
export const C_OFFSET_SET:opt_visitor=(data:OFFSET_SET, tool, bid, index)=>{
    tool.$.cp1(data.target,bid,index)
    tool.$.cp1(data.offset,bid,index)
    tool.$.cp1(data.value,bid,index)

}
export const C_OFFSET_GET:opt_visitor=(data:OFFSET_GET,tool,bid,index)=>{
    tool.$.cp1(data.data,bid,index)
    tool.$.cp1(data.offset,bid,index)
}
export const C_OFFSET_ADDR:opt_visitor=(data:OFFSET_ADDR,tool,bid,index)=>{
    tool.$.cp1(data.data,bid,index)
    tool.$.cp1(data.offset,bid,index)
}
export const C_IN:opt_visitor=(data:IN, tool, bid, index)=>{
    tool.$.cp1(data.oper,bid,index)
    tool.$.cp1(data.data,bid,index)
}
export const C_OUT:opt_visitor=(data:OUT,tool,bid,index)=>{
    tool.$.cp1(data.oper,bid,index)
}
export const C_PARAM_SET:opt_visitor=(data:PARAM_SET,tool,bid,index)=>{
    tool.$.cp1(data.param,bid,index)
    tool.$.cp1(data.value,bid,index)
}
export const C_PARAM_LOAD:opt_visitor=(data:PARAM_LOAD,tool,bid,index)=>{
    tool.$.cp1(data.param,bid,index)
}
export default new Map<any,opt_visitor>([
    [MOV, C_MOV],
    [BINARY, C_BINARY],
    [CMP, C_CMP],
    [JZ, C_BZ],
    [CZ, C_BZ],
    [TZ, C_BZ],
    [JMP, C_B],
    [CALL, C_B],
    [THREAD, C_B],
    [PUSH, C_PUSH],
    [OFFSET_SET, C_OFFSET_SET],
    [OFFSET_GET, C_OFFSET_GET],
    [OFFSET_ADDR, C_OFFSET_ADDR],
    [IN, C_IN],
    [OUT, C_OUT],
    [PARAM_SET, C_PARAM_SET],
    [PARAM_LOAD, C_PARAM_LOAD],
])