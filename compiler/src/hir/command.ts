import {slang_hir_visitor} from './tool'
import {
    Assign, Await,
    Break,
    Continue,
    HAssign, HAwait,
    HBreak, HContinue,
    HExprCommand, HIdentifierExpr,
    HIfStatement, HListCommand,
    HReturn,
    HVM, HWhileStatement,
    ExprCommand, IdentifierExpr,
    IfStatement, ListCommand,
    Return,
    VM,
    WhileStatement
} from '../utils'
const H_Assign:slang_hir_visitor=(node:Assign,scope,call)=>
    new HAssign(call(node.data),call(node.value))
const H_ExprCommand:slang_hir_visitor=(node:ExprCommand,scope,call)=>
    new HExprCommand(call(node.data))
const H_Break:slang_hir_visitor=(node:Break,scope,call)=>new HBreak()
const H_Continue:slang_hir_visitor=(node:Continue,scope,call)=>new HContinue()
const H_VM:slang_hir_visitor=(node:VM,scope,call)=>
    new HVM(node.data,node.param.map(call))
const H_Return:slang_hir_visitor=(node:Return,scope,call)=>
    new HReturn(call(node.data))
const H_IfStatement:slang_hir_visitor=(node:IfStatement,scope,call)=>
    new HIfStatement(call(node.condition),call(node.commands),call(node.else_))
const H_WhileStatement:slang_hir_visitor=(node:WhileStatement,scope,call)=>
    new HWhileStatement(call(node.condition),call(node.commands))
const H_Await:slang_hir_visitor=(node:Await,scope,call)=>
    new HAwait(call(node.command))
const H_ListCommand:slang_hir_visitor=(node:ListCommand,scope,call)=>{
    scope=scope.enter()
    let commands=node.commands.map(call)
    scope=scope.leave()
    return new HListCommand(commands)
}
export default new Map<any,slang_hir_visitor>([
    [Assign,H_Assign],
    [ExprCommand,H_ExprCommand],
    [Break,H_Break],
    [Continue,H_Continue],
    [VM,H_VM],
    [Return,H_Return],
    [IfStatement,H_IfStatement],
    [WhileStatement,H_WhileStatement],
    [Await,H_Await],
    [ListCommand,H_ListCommand]
])