import {
    AAssign,
    Await, Command, Delete,
    GotoCommand,
    HAssign,
    HAwait, HDelete, HExpr,
    HGoto, HIdentifierExpr, HIfStatement, HIRTree,
    HLabel, HListCommand,
    HReturn,
    HThrow, HTryStatement, HVM, IdentifierExpr, IfStatement,
    LabelCommand, ListCommand,
    Return, Throw, TryStatement, VM
} from '../utils'
import {slang_hir_visitor} from './tool'

const H_AAssign:slang_hir_visitor=(node:AAssign,scope,call)=>{
    if(node.data instanceof IdentifierExpr&&!scope.symbol_get(node.data.name))
        scope.symbol_set(node.data.name,scope.global_id())
    return new HAssign(call(node.data),call(node.value,scope))
}
const H_Await:slang_hir_visitor=(node:Await,scope,call)=>{
    return new HAwait(call(node.command,scope))
}
const H_Return:slang_hir_visitor=(node:Return,scope,call)=>{
    return new HReturn(call(node.data,scope))
}
const H_Label:slang_hir_visitor=(node:LabelCommand,scope,call)=>{
    return new HLabel(scope.label_get(node.name))
}
const H_Goto:slang_hir_visitor=(node:GotoCommand,scope,call)=>{
    return new HGoto(scope.label_get(node.name))
}
const H_Throw:slang_hir_visitor=(node:Throw,scope,call)=>{
    return new HThrow(call(node.data,scope))
}
const H_VM:slang_hir_visitor=(node:VM,scope,call)=>{
    return new HVM(node.data,node.param.map(i=>call(i,scope)) as HExpr[])
}
const H_Delete:slang_hir_visitor=(node:Delete,scope,call)=>{
    return new HDelete(call(node.expr,scope))
}
const H_If:slang_hir_visitor=(node:IfStatement,scope,call)=>{
    return new HIfStatement(call(node.condition,scope),call(node.commands,scope),call(node.else_,scope))
}
const H_Try:slang_hir_visitor=(node:TryStatement,scope,call)=>{
    const id=scope.global_id()
    scope=scope.enter()
    scope.symbol_set(node.catch_.iden,id)
    const catch_=call(node.catch_.command,scope)
    scope=scope.leave()
    return new HTryStatement(call(node.commands,scope),catch_,id,call(node.finally_,scope))
}
const H_ListCommand:slang_hir_visitor=(node:ListCommand,scope,call)=>{
    scope=scope.enter()
    const command=node.commands.map(i=>call(i,scope))
    scope=scope.leave()
    return new HListCommand(command)
}
export default new Map<any,slang_hir_visitor>([
    [AAssign,H_AAssign],
    [Await,H_Await],
    [Return,H_Return],
    [LabelCommand,H_Label],
    [GotoCommand,H_Goto],
    [Throw,H_Throw],
    [VM,H_VM],
    [Delete,H_Delete],
    [IfStatement,H_If],
    [TryStatement,H_Try],
    [ListCommand,H_ListCommand]
])