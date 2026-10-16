import {BINARYMap, CMPMap, is_constant, slang_opt_visitor, to_peephole_l, to_v, value} from './tool'
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
} from '../utils'
import {CmpDict} from "../ir/tool";
const PEEPHOLE_MOV:slang_opt_visitor=(data:MOV, tool, bid, index)=>{
    //两者相同
    if(to_peephole_l(data.left)==data.right)
        tool.sweep(bid,index,)
}
const PEEPHOLE_BINARY:slang_opt_visitor=(data:BINARY,tool,bid,index)=>{
    if(data.id=='shl'||data.id=='shr'&&value(data.right)==0)
        //a>>0=a<<0=a
        tool.sweep(bid,index,)
    //+0/-0
    if(data.id=='add'||data.id=='sub'&&value(data.right)==0)
        //a+0=a-0=a
        tool.sweep(bid,index,)
    //*1,/1
    if(data.id=='mul'||data.id=='div'&&value(data.right)==1)
        //a*1=a/a=a
        tool.sweep(bid,index,)
    //*0
    if(data.id=='mul'&&value(data.right)==0)
        //a*0=0
        tool.sweep(bid,index,new MOV(data.left,IRArgs.reg(0)))
    //a-a
    if(data.id=='sub'&&to_peephole_l(data.right)==data.left)
        //a-a=0
        tool.sweep(bid,index,new MOV(data.left,IRArgs.reg(0)))
    //and/or a a
    if(data.id=='and'||data.id=='or'&&to_peephole_l(data.right)==data.left)
        //a&a=a|a=a
        tool.sweep(bid,index,)
    //xor a a
    if(data.id=='xor'&&to_peephole_l(data.right)==data.left)
        //a^a=0
        tool.sweep(bid,index,new MOV(data.left,IRArgs.reg(0)))
    //and a 0
    if(data.id=='and'||data.id=='or'||data.id=='xor'&&value(data.right)==0)
        //a&0=0
        tool.sweep(bid,index,new MOV(data.left,IRArgs.reg(0)))
}
const PEEPHOLE_CMP:slang_opt_visitor=(data:CMP,tool,bid,index)=>{
    if(data.oper.type!='reg')return
    const flag=data.oper.data
    //a>a=a<a=a!=a=0
    if(CmpDict.get('>')==flag||CmpDict.get('<')==flag||CmpDict.get('!=')==flag)
        tool.sweep(bid,index,new MOV(data.left,IRArgs.reg(0)))
    //a<=a=a>=a=a==a=1
    if(CmpDict.get('<=')==flag||CmpDict.get('>=')==flag||CmpDict.get('==')==flag)
        tool.sweep(bid,index,new MOV(data.left,IRArgs.reg(1)))
}
export default ['peephole',new Map<any,slang_opt_visitor>([
    [MOV,PEEPHOLE_MOV],
    [BINARY,PEEPHOLE_BINARY],
    [CMP,PEEPHOLE_CMP]
])] as [string,Map<any,slang_opt_visitor>]