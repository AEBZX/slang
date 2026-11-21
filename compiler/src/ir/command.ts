import {expr_set, slang_ir_factory, to_v, VMMap} from './tool'
import {
    CALL,
    CZ, DELETE,
    HAssign, HAwait, HDelete,
    HGoto,
    HIdentifierExpr,
    HIndexExpr,
    HLabel,
    HReferenceExpr, HReturn, HThrow, HTryStatement, HVM, IfStatement, INT, INT_GET, INT_REGISTER,
    IRArgs,
    JMP, ListCommand,
    MOV, NOT, OFFSET_GET,
    OFFSET_SET, PARAM_SET, RET, THREAD, TryStatement
} from '../utils'
import IR from '../utils/lib/ir'
const G_Assign:slang_ir_factory=(data:HAssign,tool,call)=>{
    const right_id=IRArgs.value(tool.id())
    expr_set(right_id,data.value,tool,call)
    //如果是IdentifierExpr,最简单直接写
    if(data.data instanceof HIdentifierExpr)
        tool.push(new MOV(IRArgs.reg(data.data.name),right_id))
    //如果是解引用先拿指针在算
    if(data.data instanceof HReferenceExpr){
        const address=IRArgs.reg(tool.id())
        expr_set(address,data.data.target,tool,call)
        tool.push(new MOV(to_v(address),right_id))
    }
    //index,offset_set
    if(data.data instanceof HIndexExpr){
        const offset=IRArgs.reg(tool.id())
        const index=IRArgs.reg(tool.id())
        expr_set(offset,data.data.target,tool,call)
        expr_set(index,data.data.index,tool,call)
        tool.push(new OFFSET_SET(offset,index,right_id))
    }
}
const G_Label:slang_ir_factory=(data:HLabel,tool,call)=>{
    tool.push(new JMP(IRArgs.reg(data.name),IRArgs.reg(0)))
    tool.create(data.name)
    tool.replace(data.name)
}
const G_Goto:slang_ir_factory=(data:HGoto,tool,call)=>{
    tool.push(new JMP(IRArgs.reg(data.label),IRArgs.reg(0)))
}
const G_VM:slang_ir_factory=(data:HVM,tool,call)=>{
    const p1=IRArgs.value(tool.id())
    const p2=IRArgs.value(tool.id())
    const p3=IRArgs.value(tool.id())
    expr_set(p1,data.param[0],tool,call)
    expr_set(p2,data.param[1],tool,call)
    expr_set(p3,data.param[2],tool,call)
    tool.push(VMMap.get(data.data)(p1,p2,p3))
}
const G_Return:slang_ir_factory=(data:HReturn,tool,call)=>{
    //约定param[0]是ret
    const id=IRArgs.reg(tool.id())
    expr_set(id,data.data,tool,call)
    tool.push(new PARAM_SET(IRArgs.reg(0),id))
    tool.push(new RET(IRArgs.reg(1)))
}
const G_If:slang_ir_factory=(data:IfStatement,tool,call)=>{
    const id=tool.create()
    const _else=tool.create()
    const cond=IRArgs.reg(tool.id())
    const now=tool.block_id
    expr_set(cond,data.condition,tool,call)
    tool.push(new CZ(IRArgs.reg(id),IRArgs.reg(0),cond))
    tool.push(new NOT(cond,to_v(cond)))
    tool.push(new CZ(IRArgs.reg(_else),IRArgs.reg(0),cond))
    tool.replace(id)
    call(data.commands)
    tool.replace(_else)
    call(data.else_)
    tool.replace(now)
}
const G_Try:slang_ir_factory=(data:HTryStatement,tool,call)=>{
    const try_id=IRArgs.reg(tool.id())
    const catch_id=IRArgs.reg(tool.id())
    const finally_id=IRArgs.reg(tool.id())
    const now=tool.block_id
    tool.push(new INT_REGISTER(try_id))
    tool.push(new CALL(try_id,IRArgs.value(0)))
    tool.replace(try_id.data)
    call(data.try_)
    tool.push(new CALL(finally_id,IRArgs.reg(0)))
    tool.replace(catch_id.data)
    tool.push(new INT_GET(IRArgs.reg(data.iden)))
    call(data.catch_)
    tool.push(new CALL(finally_id,IRArgs.reg(0)))
    tool.replace(now)
}
const G_Await:slang_ir_factory=(data:HAwait,tool,call)=>{
    const now=tool.block_id
    const id=IRArgs.reg(tool.create())
    tool.replace(id.data)
    call(data.command)
    tool.replace(now)
    tool.push(new THREAD(id,IRArgs.reg(0)))
}
const G_ListCommand:slang_ir_factory=(data:ListCommand,tool,call)=>{
    data.commands.forEach(call)
}
const G_Throw:slang_ir_factory=(data:HThrow,tool,call)=>{
    const id=IRArgs.reg(tool.id())
    expr_set(id,data.data,tool,call)
    tool.push(new INT(to_v(id)))
}
const G_Delete:slang_ir_factory=(data:HDelete,tool,call)=>{
    if(data.expr instanceof HIdentifierExpr)
        tool.push(new DELETE(IRArgs.reg(data.expr.name)))
    if(data.expr instanceof HReferenceExpr){
        const address=IRArgs.reg(tool.id())
        expr_set(address,data.expr.target,tool,call)
        tool.push(new DELETE(to_v(address)))
    }
    if(data.expr instanceof HIndexExpr){
        const address=IRArgs.reg(tool.id())
        const offset=IRArgs.reg(tool.id())
        const index=IRArgs.reg(tool.id())
        expr_set(offset,data.expr.target,tool,call)
        expr_set(index,data.expr.index,tool,call)
        tool.push(new OFFSET_GET(address,offset,index))
        tool.push(new DELETE(to_v(address)))
    }
}
export default new Map<any,slang_ir_factory>([
    [HAssign,G_Assign],
    [HLabel,G_Label],
    [HGoto,G_Goto],
    [HVM,G_VM],
    [HReturn,G_Return],
    [IfStatement,G_If],
    [HTryStatement,G_Try],
    [HAwait,G_Await],
    [ListCommand,G_ListCommand],
    [HThrow,G_Throw],
    [HDelete,G_Delete]
])