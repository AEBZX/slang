import {BINARYMap, CMPMap, is_constant, slang_opt_visitor, to_v} from '../tool'
import {
    BINARY,
    BIT_NOT,
    CALL,
    CMP,
    ControlStreamCond,
    CZ,
    IRArgs,
    JMP,
    JZ, LOAD,
    MOV,
    NOT, OFFSET_GET,
    OFFSET_STR_SET, PARAM_LOAD, PARAM_SET,
    THREAD,
    TZ
} from '../../utils'
const CFOLD_BINARY:slang_opt_visitor=(data:BINARY,tool,bid,index)=>{
    if(is_constant(data.left,data.right))
        tool.sweep(bid,index,new MOV(data.result,IRArgs.reg(BINARYMap.get(data.id)(data.left.data,data.right.data))))
}
const CFOLD_NOT_OR_BIT_NOT:slang_opt_visitor=(data:NOT|BIT_NOT,tool,bid,index)=>{
    if(is_constant(data.right))
        tool.sweep(bid,index,new MOV(data.left,
            data instanceof NOT?IRArgs.reg(!(data.right.data==1)?1:0):IRArgs.reg(~data.right.data)))
}
const CFOLD_CMP:slang_opt_visitor=(data:CMP,tool,bid,index)=>{
    if(is_constant(data.right,data.oper)&&typeof tool.cprop_table.get(to_v(data.left))=='number')
        tool.sweep(bid,index,new MOV(
            data.left,
            IRArgs.reg(CMPMap.get(data.oper.data)(tool.cprop_table.get(to_v(data.left)) as number,data.right.data))
        ))
}
const CFOLD_ControlStreamCond:slang_opt_visitor=(data:ControlStreamCond,tool,bid,index)=>{
    if(is_constant(data.cond)&&data.cond.data==1){
        if(data instanceof JZ)tool.sweep(bid,index,new JMP(data.target,data.frame))
        if(data instanceof CZ)tool.sweep(bid,index,new CALL(data.target,data.frame))
        if(data instanceof TZ)tool.sweep(bid,index,new THREAD(data.target,data.frame))
    }
    //直接删除
    if(is_constant(data.cond)&&data.cond.data==0)
        tool.sweep(bid,index,)
}
const CFOLD_OFFSET_GET:slang_opt_visitor=(data:OFFSET_GET,tool,bid,index)=>{
    if(is_constant(data.offset,data.data)&&tool.cprop_offset_table.has([data.offset,data.data]))
        tool.sweep(bid,index,new LOAD(data.target,IRArgs.reg(tool.r_pool.get(tool.cprop_offset_table.get([data.offset,data.data])))))
}
const CFOLD_PARAM_LOAD:slang_opt_visitor=(data:PARAM_LOAD,tool,bid,index)=>{
    if(is_constant(data.param)&&tool.cprop_param_table.get(data.param))
        tool.sweep(bid,index,new LOAD(data.data,IRArgs.reg(tool.r_pool.get(tool.cprop_param_table.get(data.param)))))
}
export default ['constant_fold',new Map<any,slang_opt_visitor>([
    [BINARY,CFOLD_BINARY],
    [NOT,CFOLD_NOT_OR_BIT_NOT],
    [BIT_NOT,CFOLD_NOT_OR_BIT_NOT],
    [CMP,CFOLD_CMP],
    [ControlStreamCond,CFOLD_ControlStreamCond],
    [OFFSET_GET,CFOLD_OFFSET_GET],
    [PARAM_LOAD,CFOLD_PARAM_LOAD]
])] as [string,Map<any,slang_opt_visitor>]