import {
    Assign,
    Await,
    Break,
    Continue,
    DoWhileStatement, ExprCommand, FixType,
    ForeachStatement,
    ForStatement, GotoCommand, IfStatement, LabelCommand,
    ListCommand,
    Return, SwitchStatement, Throw, TryStatement, Type, VarDecl, VM, VoidType,
    WhileStatement
} from '../../utils'
import {slang_check_visitor} from '../tool'
const Check_ListCommand:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    scope=scope.enter()
    //先登记本层标签:goto 可以前向引用;标签按作用域,内层同名不算重复
    for(const i of ast.commands)
        if(i instanceof LabelCommand){
            if(scope.label.has(i.name))scope.thr(`标签${i.name}已存在,在行${i.line.join('\n')}`)
            else scope.label.add(i.name)
        }
    for(const i of ast.commands)call(i,0,scope)
    scope=scope.leave()
}
const Check_Loop:slang_check_visitor=(ast:WhileStatement|DoWhileStatement|ForeachStatement|ForStatement,scope,call)=>{
    const old=scope.loop
    scope.loop=true
    call(ast.commands,0)
    scope.loop=old
    if(ast instanceof WhileStatement||ast instanceof DoWhileStatement)
        call(ast.condition,0)
    if(ast instanceof ForeachStatement)
        call(ast.data,0)
    if(ast instanceof ForStatement){
        ast.init.forEach(i=>call(i,0))
        call(ast.condition,0)
        ast.step.forEach(i=>call(i,0))
    }
}
const Check_BreakContinue:slang_check_visitor=(ast:Break|Continue, scope, call)=>{
    if(!scope.loop_())
        scope.thr(`break/continue只能在循环中使用,在行${ast.line.join('\n')}`)
}
const Check_Try:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    const old=scope.throw
    scope.throw=true
    call(ast.commands,0)
    call(ast.catch_.type,0)
    call(ast.catch_.command,0)
    call(ast.finally_,0)
    //catch / finally 也在 try 的范围内,它们的 throw 要等到这里才恢复标志
    scope.throw=old
}
const Check_Throw:slang_check_visitor=(ast:Throw,scope,call)=>{
    if(!scope.throw_())
        scope.thr(`throw只能在try中使用,在行${ast.line.join('\n')}`)
    call(ast.data,0)
}
const Check_IfStatement:slang_check_visitor=(ast:IfStatement,scope,call)=>{
    call(ast.condition,0)
    call(ast.commands,0)
    call(ast.else_,0)
}
const Check_ExprCommand:slang_check_visitor=(ast:ExprCommand,scope,call)=>{
    call(ast.data,0)
}
const Check_Await:slang_check_visitor=(ast:Await,scope,call)=>{
    call(ast.command,0)
}
const Check_Assign:slang_check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,0)
    call(ast.value,0)
}
const Check_VarDecl:slang_check_visitor=(ast:VarDecl,scope,call)=>{
    const is_void=(t:Type)=>{
        if(t instanceof VoidType)return t
        if(t instanceof FixType)return is_void(t.t)
    }
    if(is_void(ast.t))
        scope.thr(`var的类型不能是void,在行${ast.line.join('\n')}`)
    call(ast.value,0)
}
const Check_SwitchStatement:slang_check_visitor=(ast:SwitchStatement,scope,call)=>{
    call(ast.condition,0)
    for(const i of ast.case_list){
        call(i.condition,0)
        call(i.commands,0)
    }
    call(ast.default_,0)
}
const Check_Return:slang_check_visitor=(ast:Return,scope,call)=>{
    call(ast.data,0)
}
const Check_VM:slang_check_visitor=(ast:VM,scope,call)=>{
    for(const i of ast.param)call(i,0)
}
const Check_Label:slang_check_visitor=(ast:LabelCommand,scope,call)=>{
    //重复/预登记在 ListCommand 里统一做,这里只保证本层有登记
    if(!scope.label.has(ast.name))scope.label.add(ast.name)
}
const Check_Goto:slang_check_visitor=(ast:GotoCommand,scope,call)=>{
    if(!scope.has_label(ast.name))scope.thr(`标签${ast.name}不存在,在行${ast.line.join('\n')}`)
}
export default new Map<any,slang_check_visitor>([
    [ListCommand,Check_ListCommand],
    [WhileStatement,Check_Loop],
    [DoWhileStatement,Check_Loop],
    [ForeachStatement,Check_Loop],
    [ForStatement,Check_Loop],
    [Break,Check_BreakContinue],
    [Continue,Check_BreakContinue],
    [TryStatement,Check_Try],
    [Throw,Check_Throw],
    [IfStatement,Check_IfStatement],
    [ExprCommand,Check_ExprCommand],
    [Await,Check_Await],
    [Assign,Check_Assign],
    [VarDecl,Check_VarDecl],
    [SwitchStatement,Check_SwitchStatement],
    [Return,Check_Return],
    [VM,Check_VM],
    [LabelCommand,Check_Label],
    [GotoCommand,Check_Goto]
])