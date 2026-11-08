import {get_label, pop_labels, push_labels, set_label, slang_hir_visitor} from './tool'
import {
    Assign, Await,
    Break,
    Continue,
    HAssign, HAwait,
    HExprCommand, HIdentifierExpr,
    HIfStatement, HListCommand,
    HReturn,
    HVM,
    ExprCommand, IdentifierExpr,
    IfStatement, ListCommand,
    Return,
    VM,
    WhileStatement, HLabel, GotoCommand, LabelCommand, HGoto, TryStatement, HTryStatement, Throw, HThrow
} from '../utils'
const H_Assign:slang_hir_visitor=(node:Assign,scope,call)=>
    new HAssign(call(node.data),call(node.value))
const H_ExprCommand:slang_hir_visitor=(node:ExprCommand,scope,call)=>
    new HExprCommand(call(node.data))
const H_Label:slang_hir_visitor=(node:LabelCommand,scope,call)=>{
    const id=get_label(node.name)
    const label=id==null?scope.id():id
    set_label(node.name,label)
    return new HLabel(label)
}
const H_Goto:slang_hir_visitor=(node:GotoCommand,scope,call)=>{
    //只沿标签栈向上找:内层标签遮蔽外层
    const id=get_label(node.name)
    if(id==null)throw new Error(`未定义的标签:${node.name}`)
    return new HGoto(id)
}
const H_VM:slang_hir_visitor=(node:VM,scope,call)=>
    new HVM(node.data,node.param.map(call))
const H_Return:slang_hir_visitor=(node:Return,scope,call)=>
    new HReturn(call(node.data))
const H_IfStatement:slang_hir_visitor=(node:IfStatement,scope,call)=>
    new HIfStatement(call(node.condition),call(node.commands),call(node.else_))
const H_Await:slang_hir_visitor=(node:Await,scope,call)=>
    new HAwait(call(node.command))
const H_ListCommand:slang_hir_visitor=(node:ListCommand,scope,call)=>{
    scope=scope.enter()
    const labels=new Map<string,number>()
    for(const c of node.commands)
        if(c instanceof LabelCommand){
            if(labels.has(c.name))throw new Error(`标签重复定义:${c.name}`)
            labels.set(c.name,scope.id())
        }
    push_labels(labels)
    const commands=node.commands.map(i=>call(i,scope))
    pop_labels()
    scope=scope.leave()
    return new HListCommand(commands)
}
const H_Try:slang_hir_visitor=(node:TryStatement,scope,call)=>{
    const id=scope.id()
    scope=scope.enter()
    const try_=call(node.commands)
    scope=scope.leave()
    scope=scope.enter()
    scope.set(node.catch_.iden,id)
    const catch_=call(node.catch_.command)
    scope=scope.leave()
    scope=scope.enter()
    const finally_=call(node.finally_)
    scope=scope.leave()
    return new HTryStatement(try_,catch_,id,finally_)
}
const H_Throw:slang_hir_visitor=(node:Throw,scope,call)=>{
    return new HThrow(call(node.data))
}
export default new Map<any,slang_hir_visitor>([
    [Assign,H_Assign],
    [ExprCommand,H_ExprCommand],
    [VM,H_VM],
    [Return,H_Return],
    [IfStatement,H_IfStatement],
    [Await,H_Await],
    [ListCommand,H_ListCommand],
    [Throw,H_Throw],
    [TryStatement,H_Try],
    [LabelCommand,H_Label],
    [GotoCommand,H_Goto]
])