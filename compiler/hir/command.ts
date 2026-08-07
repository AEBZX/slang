import {
    ArgumentsPostfix,
    Assign, Break,
    Call, Continue,
    HArgumentsExpr,
    HAssign, HBreak, HCall, HContinue,
    HIdentifierExpr, HIfStatement,
    hir_visitor, HListCommand, HReturn, HThread, HVM,
    HWhileStatement, IfStatement, LambdaType, ListCommand, PostfixExpression, Return,
    VarDeclaration, VM, WhileStatement
} from '../utils'
const H_Assign:hir_visitor=(node:Assign,scope,call)=>new HAssign(call(node.data),call(node.value))
const H_VarDeclaration:hir_visitor=(node:VarDeclaration,scope,call)=>{
    scope.set(node.name,scope.id())
    return new HAssign(new HIdentifierExpr(scope.get(node.name)),call(node.value))
}
const H_Call:hir_visitor=(node:Call,scope,call)=>{
    let c=node.data as PostfixExpression
    let _await=(c.types[c.types.length-2] as LambdaType)._await
    let param=c.postfix.pop() as ArgumentsPostfix
    return _await?new HThread(call(c),param.args.map(i=>call(i))):
        new HCall(call(c),param.args.map(i=>call(i)))
}
const H_Break:hir_visitor=(node:Break,scope,call)=>new HBreak()
const H_Continue:hir_visitor=(node:Continue,scope,call)=>new HContinue()
const H_VM:hir_visitor=(node:VM,scope,call)=>new HVM(node.data)
const H_Return:hir_visitor=(node:Return,scope,call)=>new HReturn(call(node.data))
const H_IfStatement:hir_visitor=(node:IfStatement,scope,call)=>new HIfStatement(call(node.condition),call(node.commands),call(node.else_))
const H_WhileStatement:hir_visitor=(node:WhileStatement,scope,call)=>new HWhileStatement(call(node.condition),call(node.commands))
const H_ListCommand:hir_visitor=(node:ListCommand,scope,call)=>new HListCommand(node.commands.map(i=>call(i)))
export default new Map<any,hir_visitor>([
    [VarDeclaration,H_VarDeclaration],
    [Call,H_Call],
    [Break,H_Break],
    [Continue,H_Continue],
    [VM,H_VM],
    [Return,H_Return],
    [IfStatement,H_IfStatement],
    [WhileStatement,H_WhileStatement],
    [ListCommand,H_ListCommand],
    [Assign,H_Assign]
])