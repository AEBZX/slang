import {slang_hir_visitor} from './tool'
import {
    Assign, Await,
    Break,
    Continue,
    HAssign, HAwait,
    HIfStatement, HListCommand,
    HReturn,
    HVM, HWhileStatement,
    IfStatement, ListCommand,
    Return,
    VM,
    WhileStatement
} from '../utils'
const H_Assign:slang_hir_visitor=(node:Assign,scope,call)=>
    new HAssign(call(node.data),call(node.value))
const H_Break:slang_hir_visitor=(node:Break,scope,call)=>new Break()
const H_Continue:slang_hir_visitor=(node:Continue,scope,call)=>new Continue()
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
const H_ListCommand:slang_hir_visitor=(node:ListCommand,scope,call)=>
    new HListCommand(node.commands.map(call))
export default new Map<any,slang_hir_visitor>([
    [Assign,H_Assign],
    [Break,H_Break],
    [Continue,H_Continue],
    [VM,H_VM],
    [Return,H_Return],
    [IfStatement,H_IfStatement],
    [WhileStatement,H_WhileStatement],
    [Await,H_Await],
    [ListCommand,H_ListCommand]
])