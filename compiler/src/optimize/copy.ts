//拷贝传播
import {
    BINARY,
    BIT_NOT,
    CMP,
    ControlStream,
    ControlStreamCond,
    DELETE,
    IN,
    IRArgs,
    MOV,
    NOT,
    OFFSET_GET,
    OFFSET_SET,
    OUT,
    PARAM_LOAD,
    PARAM_SET,
    PUSH,
    RET
} from '../utils'
import {copy, mov_rep, set_arg, slang_opt_visitor} from './tool'
const CPY_MOV:slang_opt_visitor=(data:MOV, tool, bid, index)=>{
    set_arg(data,'right',copy(data.right,tool),tool,bid,index)
    //注意:这里不能把 mov 删掉换成"让产出指令直接写目标槽"。
    //产出指令可能已经被别的轮次替换掉了(cpy_set_table 还指着旧对象),
    //改它的结果槽等于改一个不在流里的指令,目标槽就再也没人写 → 运行时读到垃圾。
    //保可运行优先,这条 mov 保留。
    //mov 槽X, R 之后,读槽X 就等于读 R。
    //左值是 value 形式时,代表"编号未知的槽",没法记也不该去猜
    if(data.left.type=='reg')tool.cpy_rep_table.set(data.left.data,data.right)
}
const record_result=(data:any,tool:any,slot:IRArgs,left:string)=>{
    if(slot.type!='reg')return
    tool.cpy_set_table.set(slot.data,{left,command:data})
}
const CPY_BINARY:slang_opt_visitor=(data:BINARY,tool,bid,index)=>{
    set_arg(data,'left',copy(data.left,tool),tool,bid,index)
    set_arg(data,'right',copy(data.right,tool),tool,bid,index)
    record_result(data,tool,data.result,'result')
}
const CPY_NOT_OR_BIT_NOT:slang_opt_visitor=(data:NOT|BIT_NOT,tool,bid,index)=>{
    set_arg(data,'right',copy(data.right,tool),tool,bid,index)
    record_result(data,tool,data.left,'left')
}
const CPY_CMP:slang_opt_visitor=(data:CMP,tool,bid,index)=>{
    set_arg(data,'right',copy(data.right,tool),tool,bid,index)
    record_result(data,tool,data.left,'left')
}
const CPY_ControlStream:slang_opt_visitor=(data:ControlStream,tool,bid,index)=>{
    set_arg(data,'target',copy(data.target,tool),tool,bid,index)
    set_arg(data,'frame',copy(data.frame,tool),tool,bid,index)
    if(data instanceof ControlStreamCond)
        set_arg(data,'cond',copy(data.cond,tool),tool,bid,index)
}
const CPY_RET:slang_opt_visitor=(data:RET,tool,bid,index)=>{
    set_arg(data,'frame',copy(data.frame,tool),tool,bid,index)
}
const CPY_PUSH:slang_opt_visitor=(data:PUSH,tool,bid,index)=>{
    set_arg(data,'target',copy(data.target,tool),tool,bid,index)
}
const CPY_OFFSET_SET:slang_opt_visitor=(data:OFFSET_SET,tool,bid,index)=>{
    set_arg(data,'offset',copy(data.offset,tool),tool,bid,index)
    set_arg(data,'value',copy(data.value,tool),tool,bid,index)
}
const CPY_OFFSET_GET:slang_opt_visitor=(data:OFFSET_GET,tool,bid,index)=>{
    set_arg(data,'data',copy(data.data,tool),tool,bid,index)
    set_arg(data,'offset',copy(data.offset,tool),tool,bid,index)
    record_result(data,tool,data.target,'target')
}
const CPY_IN_OR_OUT:slang_opt_visitor=(data:IN|OUT,tool,bid,index)=>{
    set_arg(data,'target',copy(data.target,tool),tool,bid,index)
    set_arg(data,'oper',copy(data.oper,tool),tool,bid,index)
}
const CPY_DELETE:slang_opt_visitor=(data:DELETE,tool,bid,index)=>{
    if(data.data.type=='value')return
    //槽被释放,关于它的记录全部作废
    tool.cpy_set_table.delete(data.data.data)
    tool.cpy_rep_table.delete(data.data.data)
    for(const [k,v] of tool.cpy_rep_table)
        if(v.data==data.data.data)
            tool.cpy_rep_table.delete(k)
}
const CPY_PARAM_LOAD:slang_opt_visitor=(data:PARAM_LOAD,tool,bid,index)=>{
    set_arg(data,'param',copy(data.param,tool),tool,bid,index)
}
const CPY_PARAM_SET:slang_opt_visitor=(data:PARAM_SET,tool,bid,index)=>{
    set_arg(data,'value',copy(data.value,tool),tool,bid,index)
}
export default ['copy',new Map<any,slang_opt_visitor>([
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
])] as [string,Map<any,slang_opt_visitor>]
