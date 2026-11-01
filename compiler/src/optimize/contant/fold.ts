import {BINARYMap, CMPMap, oper_of, read_const, same_slot, set_arg, slang_opt_visitor, slot_const} from '../tool'
import {
    BINARY,
    BIT_NOT,
    CMP,
    ControlStreamCond,
    CALL,
    CZ,
    IRArgs,
    JMP,
    JZ,
    LOAD,
    MOV,
    NOT,
    OFFSET_GET,
    PARAM_LOAD,
    THREAD,
    TZ
} from '../../utils'
//两操作数都是编译期常量,把整条运算换成 mov 结果槽,常量
function fold_binary(data:BINARY,tool,fn:(a:number,b:number)=>number){
    const left=read_const(data.left,tool)
    const right=read_const(data.right,tool)
    if(typeof left!='number'||typeof right!='number')return null
    return new MOV(data.result,IRArgs.reg(fn(left,right)))
}
const CFOLD_BINARY:slang_opt_visitor=(data:BINARY,tool,bid,index)=>{
    const fn=BINARYMap.get(data.id)
    if(fn==null)return
    const rep=fold_binary(data,tool,fn)
    if(rep!=null)tool.sweep(bid,index,rep)
}
const CFOLD_NOT_OR_BIT_NOT:slang_opt_visitor=(data:NOT|BIT_NOT,tool,bid,index)=>{
    const right=read_const(data.right,tool)
    if(typeof right!='number')return
    const v=data instanceof NOT?(right==0?1:0):~right
    tool.sweep(bid,index,new MOV(data.left,IRArgs.reg(v)))
}
const CFOLD_CMP:slang_opt_visitor=(data:CMP,tool,bid,index)=>{
    //左值既当目标又当左操作数,它的常量要从槽里查
    const left=slot_const(data.left,tool)
    const right=read_const(data.right,tool)
    const oper=oper_of(data,tool)
    if(typeof left!='number'||typeof right!='number'||oper==null)return
    const fn=CMPMap.get(oper)
    if(fn==null)return
    tool.sweep(bid,index,new MOV(data.left,IRArgs.reg(fn(left,right))))
}
const CFOLD_ControlStreamCond:slang_opt_visitor=(data:ControlStreamCond,tool,bid,index)=>{
    const cond=read_const(data.cond,tool)
    if(cond==1){
        //条件恒真:换成无条件跳转
        if(data instanceof JZ)tool.sweep(bid,index,new JMP(data.target,data.frame))
        if(data instanceof CZ)tool.sweep(bid,index,new CALL(data.target,data.frame))
        if(data instanceof TZ)tool.sweep(bid,index,new THREAD(data.target,data.frame))
    }
    //条件恒假:整条删掉
    if(cond==0)tool.sweep(bid,index,)
}
const CFOLD_OFFSET_GET:slang_opt_visitor=(data:OFFSET_GET,tool,bid,index)=>{
    const key=[data.data,data.offset]
    if(key.some(i=>i.type!='value'))return
    const v=tool.cprop_offset_table.get(key.map(i=>i.data).join(':'))
    if(typeof v!='number')return
    tool.sweep(bid,index,new LOAD(data.target,IRArgs.reg(tool.pool_id(v))))
}
const CFOLD_PARAM_LOAD:slang_opt_visitor=(data:PARAM_LOAD,tool,bid,index)=>{
    const param=read_const(data.param,tool)
    if(typeof param!='number')return
    const v=tool.cprop_param_table.get(param)
    if(typeof v!='number')return
    tool.sweep(bid,index,new LOAD(data.data,IRArgs.reg(tool.pool_id(v))))
}
//same_slot 在这里用不上,保留导出给 peephole 用
export {same_slot,set_arg}
export default ['constant_fold',new Map<any,slang_opt_visitor>([
    [BINARY,CFOLD_BINARY],
    [NOT,CFOLD_NOT_OR_BIT_NOT],
    [BIT_NOT,CFOLD_NOT_OR_BIT_NOT],
    [CMP,CFOLD_CMP],
    [ControlStreamCond,CFOLD_ControlStreamCond],
    [OFFSET_GET,CFOLD_OFFSET_GET],
    [PARAM_LOAD,CFOLD_PARAM_LOAD]
])] as [string,Map<any,slang_opt_visitor>]
