//拷贝传播
import {
    BINARY,
    BIT_NOT,
    CMP,
    ControlStream,
    ControlStreamCond, DELETE, IN,
    MOV,
    NOT, OFFSET_GET,
    OFFSET_SET,
    opt_visitor, OUT, PARAM_LOAD, PARAM_SET,
    PUSH,
    RET
} from '../utils'
import {copy, mov_rep, slang_opt_visitor, to_r, to_v} from './tool'
const CPY_MOV:slang_opt_visitor=(data:MOV, tool, bid, index)=>{
    data.right=copy(data.right,tool)
    tool.sweep(bid,index,mov_rep(data,tool))
    if(data.left.type=='reg')tool.cpy_rep_table.set(to_v(data.left),data.right)
    if(data.left.type=='value'&&data.right.type=='value')
        tool.cpy_rep_table.set(data.left,to_r(data.right))
}
const CPY_BINARY:slang_opt_visitor=(data:BINARY,tool,bid,index)=>{
    data.left=copy(data.left,tool)
    data.right=copy(data.right,tool)
    tool.sweep(bid,index,data)
    if(data.left.type=='reg')tool.cpy_set_table.set(to_v(data.left),{
        left:'result',
        command:data
    })
}
const CPY_NOT_OR_BIT_NOT:slang_opt_visitor=(data:NOT|BIT_NOT,tool,bid,index)=>{
    data.right=copy(data.right,tool)
    tool.sweep(bid,index,data)
    if(data.right.type=='reg')tool.cpy_set_table.set(to_v(data.right),{
        left:'left',
        command:data
    })
}
const CPY_CMP:slang_opt_visitor=(data:CMP,tool,bid,index)=>{
    data.right=copy(data.right,tool)
    data.oper=copy(data.oper,tool)
    tool.sweep(bid,index,data)
}
const CPY_ControlStream:slang_opt_visitor=(data:ControlStream,tool,bid,index)=>{
    data.target=copy(data.target,tool)
    data.frame=copy(data.frame,tool)
    if(data instanceof ControlStreamCond)
        data.cond=copy(data.cond,tool)
    tool.sweep(bid,index,data)
}
const CPY_RET:slang_opt_visitor=(data:RET,tool,bid,index)=>{
    data.frame=copy(data.frame,tool)
    tool.sweep(bid,index,data)
}
const CPY_PUSH:slang_opt_visitor=(data:PUSH,tool,bid,index)=>{
    data.target=copy(data.target,tool)
    tool.sweep(bid,index,data)
}
const CPY_OFFSET_SET:slang_opt_visitor=(data:OFFSET_SET,tool,bid,index)=>{
    data.offset=copy(data.offset,tool)
    data.value=copy(data.value,tool)
    tool.sweep(bid,index,data)
    if(data.target.type=='reg')tool.cpy_set_table.set(to_v(data.target),{
        left:'target',
        command:data
    })
}
const CPY_OFFSET_GET:slang_opt_visitor=(data:OFFSET_GET,tool,bid,index)=>{
    data.data=copy(data.data,tool)
    data.offset=copy(data.offset,tool)
    tool.sweep(bid,index,data)
    if(data.target.type=='reg')tool.cpy_set_table.set(to_v(data.target),{
        left:'target',
        command:data
    })
}
const CPY_IN_OR_OUT:slang_opt_visitor=(data:IN|OUT,tool,bid,index)=>{
    data.target=copy(data.target,tool)
    data.oper=copy(data.oper,tool)
    tool.sweep(bid,index,data)
}
const CPY_DELETE:slang_opt_visitor=(data:DELETE,tool,bid,index)=>{
    if(data.data.type=='value')return
    tool.cpy_set_table.delete(data.data)
    for(const [k,v] of tool.cpy_rep_table)
        if(v==data.data)
            tool.cpy_rep_table.delete(k)
}
const CPY_PARAM_LOAD:slang_opt_visitor=(data:PARAM_LOAD,tool,bid,index)=>{
    data.param=copy(data.param,tool)
    tool.sweep(bid,index,data)
}
const CPY_PARAM_SET:slang_opt_visitor=(data:PARAM_SET,tool,bid,index)=>{
    data.value=copy(data.value,tool)
    tool.sweep(bid,index,data)
}
export default ['copy',new Map<any,opt_visitor>([
    [MOV,CPY_MOV],
    [BINARY,CPY_BINARY],
    [NOT,CPY_NOT_OR_BIT_NOT],
    [BIT_NOT,CPY_NOT_OR_BIT_NOT],
    [CMP,CPY_CMP],
    [ControlStream,CPY_ControlStream],
    [RET,CPY_RET],
    [PUSH,CPY_PUSH],
    [OFFSET_SET,CPY_OFFSET_SET],
    [OFFSET_GET,CPY_OFFSET_GET],
    [IN,CPY_IN_OR_OUT],
    [OUT,CPY_IN_OR_OUT],
    [DELETE,CPY_DELETE],
    [PARAM_LOAD,CPY_PARAM_LOAD],
    [PARAM_SET,CPY_PARAM_SET]
])]  as [string,Map<any,slang_opt_visitor>]