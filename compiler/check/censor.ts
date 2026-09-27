//round0:无需符号表等的静态检查
import {
    BooleanType,
    Break,
    Cast,
    Class, ClassType, Continue, DoWhileStatement,
    Enum,
    File, ForeachStatement, ForStatement,
    Function, IfStatement,
    Interface, LambdaExpression, Link,
    ListCommand, LiteralType,
    Module, NumberType,
    Operation, StringType, SwitchStatement, Throw, TryStatement,
    Value,
    Variable,
    VoidType, WhileStatement
} from '../utils'
import {Default_Modifier, fill_modifier, slang_check_visitor} from './tool'
const Check_File:slang_check_visitor=(ast:File,scope,call)=>{
    let lnk_name=ast.links.map(i=>i.as)
    if(new Set(lnk_name).size!=lnk_name.length)
        scope.thr(`link的别名不能重复,在行${ast.line.join('\n')}`)
    ast.children.forEach(i=>{
        if(!(i instanceof Module||i instanceof Value))
            scope.thr(`文件顶层只能是link/module/value,在行${i.line.join('\n')}`)
        call(i,0,scope)
    })
}
const Check_Value:slang_check_visitor=(ast:Value,scope,call)=>{
    //自身必须静态
    ast.modifiers=fill_modifier(ast)
    if(ast.modifiers.unstatic)
        scope.thr(`值定义不能是非static的,在行${ast.line.join('\n')}`)
    if(ast.modifiers._private)
        scope.thr(`值定义不能是私有的,在行${ast.line.join('\n')}`)
    if(ast.modifiers._async)
        scope.thr(`值定义不能是异步的,在行${ast.line.join('\n')}`)
    ast.modifiers=Default_Modifier.get(ast)
    //必须是number,string,boolean等literal
    if(!(ast.value instanceof LiteralType))
        scope.thr(`值定义必须是number/string/boolean,在行${ast.line.join('\n')}`)
    //内部必须是operation,cast
    ast.children.forEach(i=>{
        if(!(i instanceof Operation||i instanceof Cast))
            scope.thr(`值定义内部只能是operation/cast,在行${i.line.join('\n')}`)
        call(i,0,scope)
    })
}
const Check_Operation:slang_check_visitor=(ast:Operation,scope,call)=>{
    ast.modifiers=fill_modifier(ast)
    if(ast.modifiers.unstatic)
        scope.thr(`运算符重载不能是非static的,在行${ast.line.join('\n')}`)
    if(ast.modifiers._private)
        scope.thr(`运算符重载不能是私有的,在行${ast.line.join('\n')}`)
    if(ast.modifiers._async)
        scope.thr(`运算符重载不能是异步的,在行${ast.line.join('\n')}`)
    ast.modifiers=Default_Modifier.get(ast)
    if(ast.command.ret instanceof VoidType)
        scope.thr(`运算符重载不能返回void,在行${ast.line.join('\n')}`)
    //不能有泛型
    if(ast.command.generic.size!=0)
        scope.thr(`运算符重载不能有泛型,在行${ast.line.join('\n')}`)
    call(ast.command,0,scope)
}
const Check_Cast:slang_check_visitor=(ast:Cast,scope,call)=>{
    ast.modifiers=fill_modifier(ast)
    if(ast.modifiers.unstatic)
        scope.thr(`类型转换不能是非static的,在行${ast.line.join('\n')}`)
    if(ast.modifiers._private)
        scope.thr(`类型转换不能是私有的,在行${ast.line.join('\n')}`)
    if(ast.modifiers._async)
        scope.thr(`类型转换不能是异步的,在行${ast.line.join('\n')}`)
    ast.modifiers=Default_Modifier.get(ast)
    if(ast.command.generic.size!=0)
        scope.thr(`类型转换不能有泛型,在行${ast.line.join('\n')}`)
    call(ast.command,0,scope)
}
const Check_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    //自身必须静态
    ast.modifiers=fill_modifier(ast)
    if(ast.modifiers._async)
        scope.thr(`模块不能是异步的,在行${ast.line.join('\n')}`)
    ast.modifiers=Default_Modifier.get(ast)
    ast.children.forEach(i=>{
        if(i instanceof Operation||i instanceof Cast||i instanceof Value)
            scope.thr(`模块内部不能是operation/cast/value,在行${i.line.join('\n')}`)
        if(fill_modifier(i).unstatic)
            scope.thr(`模块内部不能是非static的,在行${i.line.join('\n')}`)
        if(fill_modifier(i)._private)
            scope.thr(`模块内部不能是私有的,在行${i.line.join('\n')}`)
        call(i,0,scope)
    })
}
const Check_Enum:slang_check_visitor=(ast:Enum,scope,call)=>{
    ast.modifiers=fill_modifier(ast)
    if(ast.modifiers._async){
        scope.thr(`枚举不能是异步的,在行${ast.line.join('\n')}`)
        ast.modifiers._async=false
    }
    //不重名即可
    if(new Set(ast.children).size!=ast.children.length)
        scope.thr(`枚举成员不能重复,在行${ast.line.join('\n')}`)
}
const Check_ClassOrInterface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    ast.modifiers=fill_modifier(ast)
    if(ast.modifiers._async)
        scope.thr(`类/接口不能是异步的,在行${ast.line.join('\n')}`)
    ast.modifiers=Default_Modifier.get(ast)
    //implement必须是ClassType
    if(ast.implement!=null&&!(ast.implement instanceof ClassType))
        scope.thr(`类的/接口implement必须是ClassType,在行${ast.line.join('\n')}`)
    let generic_name=Array.from(ast.generic.keys())
    if(new Set(generic_name).size!=generic_name.length)
        scope.thr(`类/接口中泛型的定义不能重复,在行${ast.line.join('\n')}`)
    //generic implement必须是ClassType
    for(let i of ast.generic.values())
        if(!(i instanceof ClassType))
            scope.thr(`类/接口中泛型的implement必须是ClassType,在行${ast.line.join('\n')}`)
    ast.children.forEach(i=>{
        if(!(i instanceof Operation||i instanceof Cast||i instanceof Variable||i instanceof Function))
            scope.thr(`类/接口内部只能是operation/cast/value/function,在行${i.line.join('\n')}`)
        if(ast instanceof Class&&i instanceof Function&&i.commands==null)
            scope.thr(`类内部的function必须实现,在行${i.line.join('\n')}`)
        if(ast instanceof Interface&&i instanceof Function&&i.commands!=null)
            scope.thr(`接口内部的function不可以实现,在行${i.line.join('\n')}`)
        call(i,0,scope)
    })
}
const Check_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    ast.modifiers=fill_modifier(ast)
    let generic_name=Array.from(ast.generic.keys())
    if(new Set(generic_name).size!=generic_name.length)
        scope.thr(`函数中泛型的定义不能重复,在行${ast.line.join('\n')}`)
    let param_name=Array.from(ast.params.keys())
    if(new Set(param_name).size!=param_name.length)
        scope.thr(`函数中参数的定义不能重复,在行${ast.line.join('\n')}`)
    call(ast.commands,0,scope)
}
const Check_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    ast.modifiers=fill_modifier(ast)
    if(ast.modifiers._async)
        scope.thr(`变量不能是异步的,在行${ast.line.join('\n')}`)
    ast.modifiers._async=false
    call(ast.value,0,scope)
}
const Check_ListCommand:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    ast.commands.forEach(i=>call(i,0,scope))
}
const Check_Loop:slang_check_visitor=(ast:WhileStatement|DoWhileStatement|ForeachStatement|ForStatement,scope,call)=>{
    scope.loop=true
    call(ast.commands,0,scope)
    scope.loop=false
    if(ast instanceof WhileStatement||ast instanceof DoWhileStatement)
        call(ast.condition,0,scope)
    if(ast instanceof ForeachStatement)
        call(ast.data,0,scope)
}
const Check_BreakContinue:slang_check_visitor=(ast:Break|Continue, scope, call)=>{
    if(!scope.loop)
        scope.thr(`break/continue只能在循环中使用,在行${ast.line.join('\n')}`)
}
const Check_Try:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    scope.throw=true
    call(ast.commands,0,scope)
    scope.throw=false
    call(ast.catch_.command,0,scope)
    call(ast.finally_,0,scope)
}
const Check_Throw:slang_check_visitor=(ast:Throw,scope,call)=>{
    if(!scope.throw)
        scope.thr(`throw只能在try中使用,在行${ast.line.join('\n')}`)
    call(ast.data,0,scope)
}
const Check_If:slang_check_visitor=(ast:IfStatement,scope,call)=>{
    call(ast.condition,0,scope)
    call(ast.commands,0,scope)
    call(ast.else_,0,scope)
}
const Check_Lambda:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    let generic_name=Array.from(ast.generic.keys())
    if(new Set(generic_name).size!=generic_name.length)
        scope.thr(`lambda中泛型的定义不能重复,在行${ast.line.join('\n')}`)
    let param_name=Array.from(ast.params.keys())
    if(new Set(param_name).size!=param_name.length)
        scope.thr(`lambda中参数的定义不能重复,在行${ast.line.join('\n')}`)
    call(ast.body,0,scope)
}
export const Round0=new Map<any,slang_check_visitor>([
    [File, Check_File],
    [Value, Check_Value],
    [Operation, Check_Operation],
    [Cast, Check_Cast],
    [Module, Check_Module],
    [Enum, Check_Enum],
    [Class, Check_ClassOrInterface],
    [Interface, Check_ClassOrInterface],
    [Function, Check_Function],
    [Variable, Check_Variable],
    [ListCommand, Check_ListCommand],
    [WhileStatement, Check_Loop],
    [DoWhileStatement, Check_Loop],
    [ForeachStatement, Check_Loop],
    [ForStatement, Check_Loop],
    [Break, Check_BreakContinue],
    [Continue, Check_BreakContinue],
    [TryStatement, Check_Try],
    [Throw, Check_Throw],
    [IfStatement, Check_If],
    [LambdaExpression, Check_Lambda]
])