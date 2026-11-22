import {BinaryDict, expr_set, left_addr, slang_ir_factory, to_v} from './tool'
import {
    BINARY, BIT_NOT, CALL, CZ, HAddressExpr, HArgumentsExpr,
    HArrayExpr, HBinaryExpr, HBitNotExpr,
    HIdentifierExpr, HIndexExpr,
    HLambdaExpr, HNotExpr,
    HNullLiteral,
    HNumberLiteral, HPostDecrementExpr, HPostIncrementExpr, HPreDecrementExpr, HPreIncrementExpr, HReferenceExpr,
    HTernaryExpr,
    IRArgs,
    MOV, NOT, OFFSET_GET,
    OFFSET_SET,
    PARAM_LOAD, PARAM_SET, POP, PUSH, REF
} from '../utils'

const G_Number:slang_ir_factory=(data:HNumberLiteral,tool,call)=>{
    tool.const_pool.add(data.value)
    tool.push(new MOV(tool.set_arg,IRArgs.reg(data.value)))
}
const G_Null:slang_ir_factory=(data:HNullLiteral,tool,call)=>{
    //null就是寄存器号为0的寄存器
    tool.push(new MOV(tool.set_arg,IRArgs.value(0)))
}
const G_IdentifierExpr:slang_ir_factory=(data:HIdentifierExpr,tool,call)=>{
    tool.push(new MOV(tool.set_arg,IRArgs.value(data.name)))
}
const G_ArrayExpr:slang_ir_factory=(data:HArrayExpr,tool,call)=>{
    const set_arg=tool.set_arg
    const value_arg=IRArgs.reg(tool.id())
    for(const [index,value] of data.elements.entries()){
        expr_set(value_arg,value,tool,call)
        tool.push(new OFFSET_SET(set_arg,IRArgs.reg(index),value_arg))
    }
}
const G_HLambdaExpr:slang_ir_factory=(data:HLambdaExpr,tool,call)=>{
    const id=tool.create()
    const now=tool.block_id
    tool.params=data.params
    tool.push(new MOV(tool.set_arg,IRArgs.reg(id)))
    tool.replace(id)
    for(const [index,param] of data.params.entries())
        tool.push(new PARAM_LOAD(IRArgs.reg(param),IRArgs.reg(index+1)))
    call(data.commands)
    tool.replace(now)
}
const G_IndexExpr:slang_ir_factory=(data:HIndexExpr,tool,call)=>{
    const set_arg=tool.set_arg
    const offset=IRArgs.reg(tool.id())
    const index=IRArgs.reg(tool.id())
    expr_set(offset,data.target,tool,call)
    expr_set(index,data.index,tool,call)
    tool.push(new OFFSET_GET(set_arg,offset,index))
    tool.push(new REF(set_arg,to_v(tool.set_arg)))
}
const G_PostInc:slang_ir_factory=(data:HPostIncrementExpr,tool,call)=>{
    const set_arg=tool.set_arg
    const expr=IRArgs.reg(tool.id())
    expr_set(expr,data.target,tool,call)
    tool.push(new MOV(set_arg,to_v(expr)))
    const left_address=IRArgs.reg(tool.id())
    left_addr(left_address,data.target,tool,call)
    tool.push(new BINARY('add',to_v(left_address),to_v(expr),IRArgs.reg(1)))
}
const G_PostDec:slang_ir_factory=(data:HPostDecrementExpr,tool,call)=>{
    const set_arg=tool.set_arg
    const expr=IRArgs.reg(tool.id())
    expr_set(expr,data.target,tool,call)
    tool.push(new MOV(set_arg,to_v(expr)))
    const left_address=IRArgs.reg(tool.id())
    left_addr(left_address,data.target,tool,call)
    tool.push(new BINARY('sub',to_v(left_address),to_v(expr),IRArgs.reg(1)))
}
const G_PreInc:slang_ir_factory=(data:HPreIncrementExpr,tool,call)=>{
    const set_arg=tool.set_arg
    const expr=IRArgs.reg(tool.id())
    expr_set(expr,data.target,tool,call)
    const left_address=IRArgs.reg(tool.id())
    left_addr(left_address,data.target,tool,call)
    tool.push(new BINARY('add',to_v(left_address),to_v(expr),IRArgs.reg(1)))
    tool.push(new MOV(set_arg,to_v(expr)))
}
const G_PreDec:slang_ir_factory=(data:HPreDecrementExpr,tool,call)=>{
    const set_arg=tool.set_arg
    const expr=IRArgs.reg(tool.id())
    expr_set(expr,data.target,tool,call)
    const left_address=IRArgs.reg(tool.id())
    left_addr(left_address,data.target,tool,call)
    tool.push(new BINARY('sub',to_v(left_address),to_v(expr),IRArgs.reg(1)))
    tool.push(new MOV(set_arg,to_v(expr)))
}
const G_Arguments:slang_ir_factory=(data:HArgumentsExpr,tool,call)=>{
    const set_arg=tool.set_arg
    const param=tool.params
    const param_set_arg=IRArgs.reg(tool.id())
    for(const [index,value] of data.args.entries()){
        expr_set(param_set_arg,value,tool,call)
        tool.push(new PARAM_SET(IRArgs.reg(index+1),param_set_arg))
    }
    for(const i of param)
        tool.push(new PUSH(IRArgs.reg(i)))
    const target=IRArgs.reg(tool.id())
    expr_set(target,data.target,tool,call)
    tool.push(new CALL(to_v(target),IRArgs.reg(1)))
    for(const i of param)
        tool.push(new POP())
    tool.push(new PARAM_LOAD(set_arg,IRArgs.reg(0)))
}
const G_Not:slang_ir_factory=(data:HNotExpr,tool,call)=>{
    const set_arg=tool.set_arg
    const expr=IRArgs.reg(tool.id())
    expr_set(expr,data.target,tool,call)
    tool.push(new NOT(set_arg,to_v(expr)))
}
const G_BitNot:slang_ir_factory=(data:HBitNotExpr,tool,call)=>{
    const set_arg=tool.set_arg
    const expr=IRArgs.reg(tool.id())
    expr_set(expr,data.target,tool,call)
    tool.push(new BIT_NOT(set_arg,to_v(expr)))
}
const G_Address:slang_ir_factory=(data:HAddressExpr,tool,call)=>{
    const set_arg=tool.set_arg
    left_addr(set_arg,data.target,tool,call)
}
const G_Reference:slang_ir_factory=(data:HReferenceExpr,tool,call)=>{
    const set_arg=tool.set_arg
    const address=IRArgs.reg(tool.id())
    expr_set(address,data.target,tool,call)
    tool.push(new REF(set_arg,to_v(address)))
}
const G_Binary:slang_ir_factory=(data:HBinaryExpr,tool,call)=>{
    const set_arg=tool.set_arg
    const left=IRArgs.reg(tool.id())
    const right=IRArgs.reg(tool.id())
    expr_set(left,data.left,tool,call)
    expr_set(right,data.right,tool,call)
    tool.push(new BINARY(BinaryDict.get(data.op),set_arg,to_v(left),to_v(right)))
}
const G_Ternary:slang_ir_factory=(data:HTernaryExpr,tool,call)=>{
    const set_arg=tool.set_arg
    const cond=IRArgs.reg(tool.id())
    const left=IRArgs.reg(tool.id())
    const right=IRArgs.reg(tool.id())
    const true_block=IRArgs.reg(tool.create())
    const false_block=IRArgs.reg(tool.create())
    const now=tool.block_id
    expr_set(cond,data.condition,tool,call)
    expr_set(left,data.trueExpr,tool,call)
    expr_set(right,data.falseExpr,tool,call)
    tool.replace(true_block.data)
    tool.push(new MOV(set_arg,left))
    tool.replace(false_block.data)
    tool.push(new MOV(set_arg,right))
    tool.replace(now)
    tool.push(new CZ(true_block,IRArgs.reg(1),cond))
    tool.push(new NOT(cond,to_v(cond)))
    tool.push(new CZ(false_block,IRArgs.reg(1),cond))
}
export default new Map<any,slang_ir_factory>([
    [HNumberLiteral,G_Number],
    [HNullLiteral,G_Null],
    [HIdentifierExpr,G_IdentifierExpr],
    [HArrayExpr,G_ArrayExpr],
    [HLambdaExpr,G_HLambdaExpr],
    [HIndexExpr,G_IndexExpr],
    [HPostIncrementExpr,G_PostInc],
    [HPostDecrementExpr,G_PostDec],
    [HPreIncrementExpr,G_PreInc],
    [HPreDecrementExpr,G_PreDec],
    [HArgumentsExpr,G_Arguments],
    [HNotExpr,G_Not],
    [HBitNotExpr,G_BitNot],
    [HAddressExpr,G_Address],
    [HReferenceExpr,G_Reference],
    [HBinaryExpr,G_Binary],
    [HTernaryExpr,G_Ternary]
])