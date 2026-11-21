import {
    AAssign,
    Await, Command, Delete,
    GotoCommand,
    HAssign,
    HAwait, HDelete, HExpr,
    HGoto, HIfStatement, HIRTree,
    HLabel, HListCommand,
    HReturn,
    HThrow, HTryStatement, HVM, IfStatement,
    LabelCommand, ListCommand,
    Return, Throw, TryStatement, VM
} from '../utils'
import {slang_hir_visitor} from './tool'

const H_AAssign:slang_hir_visitor=(node:AAssign,scope,call)=>{
    return new HAssign(call(node.data),call(node.value))
}
const H_Await:slang_hir_visitor=(node:Await,scope,call)=>{
    return new HAwait(call(node.command))
}
const H_Return:slang_hir_visitor=(node:Return,scope,call)=>{
    return new HReturn(call(node.data))
}
const H_Label:slang_hir_visitor=(node:LabelCommand,scope,call)=>{
    const id=scope.global_id()
    scope.label_set(node.name,id)
    return new HLabel(id)
}
const H_Goto:slang_hir_visitor=(node:GotoCommand,scope,call)=>{
    return new HGoto(scope.label_get(node.name))
}
const H_Throw:slang_hir_visitor=(node:Throw,scope,call)=>{
    return new HThrow(call(node.data))
}
const H_VM:slang_hir_visitor=(node:VM,scope,call)=>{
    return new HVM(node.data,node.param.map(call) as HExpr[])
}
const H_Delete:slang_hir_visitor=(node:Delete,scope,call)=>{
    return new HDelete(call(node.expr))
}
const H_If:slang_hir_visitor=(node:IfStatement,scope,call)=>{
    return new HIfStatement(call(node.condition),call(node.commands),call(node.else_))
}
const H_Try:slang_hir_visitor=(node:TryStatement,scope,call)=>{
    const id=scope.global_id()
    scope=scope.enter()
    scope.symbol_set(node.catch_.iden,id)
    const catch_=call(node.catch_.command)
    scope=scope.leave()
    return new HTryStatement(call(node.commands),catch_,id,call(node.finally_))
}
const H_ListCommand:slang_hir_visitor=(node:ListCommand,scope,call)=>{
    scope=scope.enter()
    const command=node.commands.map(call)
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