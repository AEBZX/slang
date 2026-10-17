import {oper_of, same_slot, slang_opt_visitor, value} from './tool'
import {BINARY, CMP, ControlStreamCond, IRArgs, MOV, NOT} from '../utils'
import {CmpDict} from '../ir/tool'
//窥孔:只做"结果就等于某个操作数/常量"的等价替换,一律换成 mov,不能整条删掉
//(删掉的话目标槽就没人写了)
const PEEPHOLE_MOV:slang_opt_visitor=(data:MOV, tool, bid, index)=>{
    //mov x,x
    if(same_slot(data.left,data.right))tool.sweep(bid,index,)
}
const PEEPHOLE_BINARY:slang_opt_visitor=(data:BINARY,tool,bid,index)=>{
    const result=data.result
    const to_left=()=>tool.sweep(bid,index,new MOV(result,data.left))
    const to_zero=()=>tool.sweep(bid,index,new MOV(result,IRArgs.reg(0)))
    const right=value(data.right)
    const same=same_slot(data.left,data.right)
    //结果就是另一个操作数:a+0 a-0 a<<0 a>>0 a|0 a^0
    if((data.id=='add'||data.id=='sub'||data.id=='or'||data.id=='xor')&&right==0)return to_left()
    if((data.id=='shl'||data.id=='shr')&&right==0)return to_left()
    if((data.id=='mul'||data.id=='div')&&right==1)return to_left()
    if((data.id=='and'||data.id=='or')&&same)return to_left()
    //结果恒为 0:a-a a^a a&0 a*0
    if((data.id=='sub'||data.id=='xor')&&same)return to_zero()
    if((data.id=='and'||data.id=='mul')&&right==0)return to_zero()
}
const PEEPHOLE_CMP:slang_opt_visitor=(data:CMP,tool,bid,index)=>{
    //只有两个操作数是同一个槽时才成立:a>a / a<a / a!=a 恒 0,a<=a / a>=a / a==a 恒 1
    if(!same_slot(data.left,data.right))return
    const oper=oper_of(data,tool)
    if(oper==null)return
    const zero=[CmpDict.get('>'),CmpDict.get('<'),CmpDict.get('!=')]
    const one=[CmpDict.get('<='),CmpDict.get('>='),CmpDict.get('==')]
    if(zero.includes(oper))tool.sweep(bid,index,new MOV(data.left,IRArgs.reg(0)))
    if(one.includes(oper))tool.sweep(bid,index,new MOV(data.left,IRArgs.reg(1)))
}
export default ['peephole',new Map<any,slang_opt_visitor>([
    [MOV,PEEPHOLE_MOV],
    [BINARY,PEEPHOLE_BINARY],
    [CMP,PEEPHOLE_CMP]
])] as [string,Map<any,slang_opt_visitor>]
