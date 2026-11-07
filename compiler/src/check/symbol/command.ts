import {
    Assign,
    Await,
    DoWhileStatement,
    ExprCommand, ForeachStatement, ForStatement,
    IfStatement,
    ListCommand,
    Return, SwitchStatement,
    Throw, TryStatement,
    VarDecl,
    WhileStatement
} from '../../utils'
import {slang_check_visitor} from '../tool'
const Verify_Await:slang_check_visitor=(ast:Await,scope,call)=>{
    call(ast.command,2)
}
const Verify_ListCommand:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    scope=scope.enter()
    ast.commands.forEach(i=>call(i,2,scope))
    scope=scope.leave()
}
const Verify_Assign:slang_check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,2)
    call(ast.value,2)
}
const Verify_VarDecl:slang_check_visitor=(ast:VarDecl,scope,call)=>{
    //同一个作用域里不能重复声明;父作用域的同名允许遮蔽
    if(scope.data.has(ast.name))
        scope.thr(`变量${ast.name}重复声明,在行${ast.line.join('\n')}`)
    scope.set(ast.name,ast)
    call(ast.t,2)
    call(ast.value,2)
}
const Verify_ReturnOrThrowOrExprCommand:slang_check_visitor=(ast:ExprCommand|Throw|Return,scope,call)=>{
    call(ast.data,2)
}
const Verify_If:slang_check_visitor=(ast:IfStatement,scope,call)=>{
    call(ast.condition,2)
    call(ast.commands,2)
    call(ast.else_,2)
}
const Verify_WhileOrDoWhile:slang_check_visitor=(ast:WhileStatement|DoWhileStatement,scope,call)=>{
    call(ast.condition,2)
    call(ast.commands,2)
}
const Verify_Switch:slang_check_visitor=(ast:SwitchStatement,scope,call)=>{
    call(ast.condition,2)
    ast.case_list.forEach(i=>{
        call(i.condition,2)
        call(i.commands,2)
    })
    call(ast.default_,2)
}
const Verify_Try:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    call(ast.commands,2)
    call(ast.catch_.type,2)
    scope.set(ast.catch_.iden,new VarDecl(ast.catch_.iden,ast.catch_.type,null))
    call(ast.catch_.command,2)
    call(ast.finally_,2)
}
const Verify_For:slang_check_visitor=(ast:ForStatement,scope,call)=>{
    scope=scope.enter()
    ast.init.forEach(i=>call(i,2,scope))
    call(ast.condition,2,scope)
    call(ast.commands,2,scope)
    ast.step.forEach(i=>call(i,2,scope))
    scope=scope.leave()
}
const Verify_Foreach:slang_check_visitor=(ast:ForeachStatement,scope,call)=>{
    scope=scope.enter()
    call(ast.data,2,scope)
    scope.set(ast.iden,new VarDecl(ast.iden,null,null))
    call(ast.commands,2,scope)
    scope=scope.leave()
}
export default new Map<any,slang_check_visitor>([
    [Await,Verify_Await],
    [ListCommand,Verify_ListCommand],
    [Assign,Verify_Assign],
    [VarDecl,Verify_VarDecl],
    [ExprCommand,Verify_ReturnOrThrowOrExprCommand],
    [Return,Verify_ReturnOrThrowOrExprCommand],
    [Throw,Verify_ReturnOrThrowOrExprCommand],
    [IfStatement,Verify_If],
    [WhileStatement,Verify_WhileOrDoWhile],
    [DoWhileStatement,Verify_WhileOrDoWhile],
    [SwitchStatement,Verify_Switch],
    [TryStatement,Verify_Try],
    [ForStatement,Verify_For],
    [ForeachStatement,Verify_Foreach]
])