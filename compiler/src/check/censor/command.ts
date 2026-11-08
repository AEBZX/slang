import {slang_check_visitor} from '../tool'
import {
    Assign,
    Await,
    Break,
    Continue, DoWhileStatement,
    ExprCommand, ForeachStatement, ForStatement,
    IfStatement, ListCommand,
    Return,
    SwitchStatement,
    Throw, TryStatement,
    VarDecl,
    VM, WhileStatement
} from '../../utils'
const Censor_Assign:slang_check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,0)
    call(ast.value,0)
}
const Censor_VarDecl:slang_check_visitor=(ast:VarDecl,scope,call)=>{
    call(ast.t,0)
    call(ast.value,0)
}
const Censor_Await:slang_check_visitor=(ast:Await,scope,call)=>{
    call(ast.command,0)
}
const Censor_ExprCommand:slang_check_visitor=(ast:ExprCommand,scope,call)=>{
    call(ast.data,0)
}
const Censor_Return:slang_check_visitor=(ast:Return,scope,call)=>{
    call(ast.data,0)
}
const Censor_Break_Continue:slang_check_visitor=(ast:Break|Continue,scope,call)=>{
    if(!scope.loop())
        scope.thr('break/continue只能在循环中使用',ast)
}
const Censor_Throw:slang_check_visitor=(ast:Throw,scope,call)=>{
    call(ast.data,0)
}
const Censor_VM:slang_check_visitor=(ast:VM,scope,call)=>{
    for(const param of ast.param)
        call(param,0)
}
const Censor_If:slang_check_visitor=(ast:IfStatement,scope,call)=>{
    call(ast.condition,0)
    call(ast.commands,0)
    call(ast.else_,0)
}
const Censor_Switch:slang_check_visitor=(ast:SwitchStatement,scope,call)=>{
    call(ast.condition,0)
    for(const case_ of ast.case_list){
        call(case_.condition,0)
        call(case_.commands,0)
    }
    call(ast.default_,0)
}
const Censor_While_DoWhile:slang_check_visitor=(ast:DoWhileStatement|WhileStatement,scope,call)=>{
    call(ast.condition,0)
    call(ast.commands,0)
}
const Censor_For:slang_check_visitor=(ast:ForStatement,scope,call)=>{
    for(const init of ast.init)
        call(init,0)
    call(ast.condition,0)
    for(const step of ast.step)
        call(step,0)
    call(ast.commands,0)
}
const Censor_Foreach:slang_check_visitor=(ast:ForeachStatement,scope,call)=>{
    call(ast.data,0)
    call(ast.commands,0)
}
const Censor_Try:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    call(ast.commands,0)
    call(ast.catch_.type,0)
    call(ast.catch_.command,0)
    call(ast.finally_,0)
}
const Censor_List:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    for(const command of ast.commands)
        call(command,0)
}
