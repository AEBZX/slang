import {slang_check_visitor} from '../tool'
import {
    Assign,
    Await, Delete,
    DoWhileStatement,
    ExprCommand, ForStatement, GotoCommand,
    IfStatement, LabelCommand, ListCommand,
    Return, SwitchStatement,
    Throw, TryStatement,
    VarDecl,
    VM,
    WhileStatement
} from '../../utils'
const Symbol_Assign:slang_check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,2,scope)
    call(ast.value,2,scope)
}
const Symbol_VarDecl:slang_check_visitor=(ast:VarDecl,scope,call)=>{
    if(scope.get(ast.name))
        scope.thr('变量重复定义',ast)
    scope.set(ast.name,ast.t)
    call(ast.t,2,scope)
    call(ast.value,2,scope)
}
const Symbol_Await:slang_check_visitor=(ast:Await,scope,call)=>{
    call(ast.command,2,scope)
}
const Symbol_ExprCommand:slang_check_visitor=(ast:ExprCommand,scope,call)=>{
    call(ast.data,2,scope)
}
const Symbol_Return:slang_check_visitor=(ast:Return,scope,call)=>{
    call(ast.data,2,scope)
}
const Symbol_Throw:slang_check_visitor=(ast:Throw,scope,call)=>{
    call(ast.data,2,scope)
}
const Symbol_VM:slang_check_visitor=(ast:VM,scope,call)=>{
    for(const param of ast.param)
        call(param,2,scope)
}
const Symbol_Label:slang_check_visitor=(ast:LabelCommand,scope,call)=>{
    scope.register_label(ast.name,ast)
}
const Symbol_Goto:slang_check_visitor=(ast:GotoCommand,scope,call)=>{
    scope.delay_set(ast.name,ast)
}
const Symbol_Delete:slang_check_visitor=(ast:Delete,scope,call)=>{
    call(ast.expr,2,scope)
}
const Symbol_If:slang_check_visitor=(ast:IfStatement,scope,call)=>{
    call(ast.condition,2,scope)
    call(ast.commands,2,scope)
    call(ast.else_,2,scope)
}
const Symbol_While_DoWhile:slang_check_visitor=(ast:WhileStatement|DoWhileStatement,scope,call)=>{
    call(ast.condition,2,scope)
    call(ast.commands,2,scope)
}
const Symbol_For:slang_check_visitor=(ast:ForStatement,scope,call)=>{
    scope=scope.enter()
    for(const init of ast.init)
        call(init,2,scope)
    call(ast.condition,2,scope)
    for(const step of ast.step)
        call(step,2,scope)
    call(ast.commands,2,scope)
    scope=scope.leave()
}
const Symbol_Switch:slang_check_visitor=(ast:SwitchStatement,scope,call)=>{
    call(ast.condition,2,scope)
    for(const command of ast.case_list){
        call(command.condition,2,scope)
        call(command.commands,2,scope)
    }
    call(ast.default_,2,scope)
}
const Symbol_Try:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    call(ast.commands,2,scope)
    call(ast.catch_.type,2,scope)
    scope=scope.enter()
    scope.set(ast.catch_.iden,ast.catch_.type)
    call(ast.catch_.command,2,scope)
    scope=scope.leave()
    call(ast.finally_,2,scope)
}
const Symbol_List:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    scope=scope.enter()
    for(const item of ast.commands)
        call(item,2,scope)
    scope=scope.leave()
}
export default new Map<any,slang_check_visitor>([
    [Assign,Symbol_Assign],
    [VarDecl,Symbol_VarDecl],
    [Await,Symbol_Await],
    [ExprCommand,Symbol_ExprCommand],
    [Return,Symbol_Return],
    [Throw,Symbol_Throw],
    [VM,Symbol_VM],
    [LabelCommand,Symbol_Label],
    [GotoCommand,Symbol_Goto],
    [Delete,Symbol_Delete],
    [IfStatement,Symbol_If],
    [WhileStatement,Symbol_While_DoWhile],
    [DoWhileStatement,Symbol_While_DoWhile],
    [ForStatement,Symbol_For],
    [SwitchStatement,Symbol_Switch],
    [TryStatement,Symbol_Try],
    [ListCommand,Symbol_List]
])