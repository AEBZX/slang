import {slang_check_visitor} from '../tool'
import {
    Assign,
    Await,
    DoWhileStatement,
    ExprCommand, ForStatement,
    IfStatement, ListCommand,
    Return, SwitchStatement,
    Throw, TryStatement,
    VarDecl,
    VM,
    WhileStatement
} from '../../utils'
const Symbol_Assign:slang_check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,2)
    call(ast.value,2)
}
const Symbol_VarDecl:slang_check_visitor=(ast:VarDecl,scope,call)=>{
    if(scope.get(ast.name))
        scope.thr('变量重复定义',ast)
    scope.set(ast.name,ast.t)
    call(ast.t,2)
    call(ast.value,2)
}
const Symbol_Await:slang_check_visitor=(ast:Await,scope,call)=>{
    call(ast.command,2)
}
const Symbol_ExprCommand:slang_check_visitor=(ast:ExprCommand,scope,call)=>{
    call(ast.data,2)
}
const Symbol_Return:slang_check_visitor=(ast:Return,scope,call)=>{
    call(ast.data,2)
}
const Symbol_Throw:slang_check_visitor=(ast:Throw,scope,call)=>{
    call(ast.data,2)
}
const Symbol_VM:slang_check_visitor=(ast:VM,scope,call)=>{
    for(const param of ast.param)
        call(param,2)
}
const Symbol_If:slang_check_visitor=(ast:IfStatement,scope,call)=>{
    call(ast.condition,2)
    call(ast.commands,2)
    call(ast.else_,2)
}
const Symbol_While_DoWhile:slang_check_visitor=(ast:WhileStatement|DoWhileStatement,scope,call)=>{
    call(ast.condition,2)
    call(ast.commands,2)
}
const Symbol_For:slang_check_visitor=(ast:ForStatement,scope,call)=>{
    scope=scope.enter()
    for(const init of ast.init)
        call(init,2)
    call(ast.condition,2)
    for(const step of ast.step)
        call(step,2)
    call(ast.commands,2)
    scope=scope.leave()
}
const Symbol_Switch:slang_check_visitor=(ast:SwitchStatement,scope,call)=>{
    call(ast.condition,2)
    for(const command of ast.case_list){
        call(command.condition,2)
        call(command.commands,2)
    }
    call(ast.default_,2)
}
const Symbol_Try:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    call(ast.commands,2)
    call(ast.catch_.type,2)
    scope=scope.enter()
    scope.set(ast.catch_.iden,ast.catch_.type)
    call(ast.catch_.command,2)
    scope=scope.leave()
    call(ast.finally_,2)
}
const Symbol_List:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    scope=scope.enter()
    for(const item of ast.commands)
        call(item,2)
    scope=scope.leave()
}