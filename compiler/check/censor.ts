//round0:无需符号表等的静态检查
import {
    ArgumentsPostfix,
    ArrayExpression,
    Assign,
    Await,
    BinaryExpression,
    Break,
    Cast,
    Class,
    ClassType,
    Continue,
    DoWhileStatement,
    Enum,
    ExprCommand,
    File,
    FixType,
    ForeachStatement,
    ForStatement,
    Function,
    IfStatement,
    IndexPostfix,
    Interface,
    LambdaExpression,
    ListCommand,
    LiteralType,
    MapExpression,
    Module,
    Operation,
    PostfixExpression,
    PrefixExpression,
    Return,
    SwitchStatement,
    TernaryExpression,
    Throw,
    TryStatement,
    Type,
    Value,
    VarDecl,
    Variable,
    VM,
    VoidType,
    WhileStatement
} from '../utils'
import {
    check_async_modifier,
    check_dup,
    check_static_modifier,
    Default_Modifier,
    fill_modifier,
    slang_check_visitor
} from './tool'

const Check_File:slang_check_visitor=(ast:File,scope,call)=>{
    const lnk_name=ast.links.map(i=>i.as)
    if(new Set(lnk_name).size!=lnk_name.length)
        scope.thr(`link的别名不能重复,在行${ast.line.join('\n')}`)
    for(const i of ast.children){
        if(!(i instanceof Module||i instanceof Value))
            scope.thr(`文件顶层只能是link/module/value,在行${i.line.join('\n')}`)
        call(i,0)
    }
}
const Check_Value:slang_check_visitor=(ast:Value,scope,call)=>{
    //自身必须静态
    check_static_modifier(ast,scope,'值类型重载')
    //必须是number,string,boolean等literal
    if(!(ast.value instanceof LiteralType))
        scope.thr(`值定义必须是number/string/boolean,在行${ast.line.join('\n')}`)
    //内部必须是operation,cast
    for(const i of ast.children){
        if(!(i instanceof Operation||i instanceof Cast))
            scope.thr(`值定义内部只能是operation/cast,在行${i.line.join('\n')}`)
        call(i,0)
    }
}
const Check_Operation:slang_check_visitor=(ast:Operation,scope,call)=>{
    check_static_modifier(ast,scope,'运算符重载')
    if(ast.command.ret instanceof VoidType)
        scope.thr(`运算符重载不能返回void,在行${ast.line.join('\n')}`)
    //不能有泛型
    if(ast.command.generic.size!=0)
        scope.thr(`运算符重载不能有泛型,在行${ast.line.join('\n')}`)
    call(ast.command,0)
}
const Check_Cast:slang_check_visitor=(ast:Cast,scope,call)=>{
    check_static_modifier(ast,scope,'类型转换')
    if(ast.command.generic.size!=0)
        scope.thr(`类型转换不能有泛型,在行${ast.line.join('\n')}`)
    call(ast.t,0)
    call(ast.command,0)
}
const Check_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    //自身必须静态
    check_static_modifier(ast,scope,'模块')
    for(const i of ast.children){
        if(i instanceof Operation||i instanceof Cast||i instanceof Value)
            scope.thr(`模块内部不能是operation/cast/value,在行${i.line.join('\n')}`)
        if(fill_modifier(i).unstatic)
            scope.thr(`模块内部不能是非static的,在行${i.line.join('\n')}`)
        if(fill_modifier(i)._private)
            scope.thr(`模块内部不能是私有的,在行${i.line.join('\n')}`)
        call(i,0)
    }
}
const Check_Enum:slang_check_visitor=(ast:Enum,scope,call)=>{
    check_async_modifier(ast,scope,'枚举')
    //不重名即可
    check_dup(ast.children,scope,'枚举成员',ast.line)
}
const Check_ClassOrInterface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    check_async_modifier(ast,scope,'类或接口')
    ast.modifiers=Default_Modifier.get(ast)
    //implement必须是ClassType
    if(ast.implement!=null&&!(ast.implement instanceof ClassType))
        scope.thr(`类的/接口implement的模块必须是接口,在行${ast.line.join('\n')}`)
    check_dup(ast.generic.keys(),scope,'类/接口中泛型',ast.line)
    //generic implement必须是ClassType
    for(const i of ast.generic.values())
        if(!(i instanceof ClassType))
            scope.thr(`类/接口中泛型的implement的模块必须是接口,在行${ast.line.join('\n')}`)
    for(const i of ast.generic.values())
        call(i,0)
    for(const i of ast.children){
        if(!(i instanceof Operation||i instanceof Cast||i instanceof Variable||i instanceof Function))
            scope.thr(`类/接口内部只能是operation/cast/value/function,在行${i.line.join('\n')}`)
        if(ast instanceof Class&&i instanceof Function&&i.commands==null)
            scope.thr(`类内部的function必须实现,在行${i.line.join('\n')}`)
        if(ast instanceof Interface&&i instanceof Function&&i.commands!=null)
            scope.thr(`接口内部的function不可以实现,在行${i.line.join('\n')}`)
        call(i,0)
    }
}
const Check_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    ast.modifiers=fill_modifier(ast)
    check_dup(ast.generic.keys(),scope,'函数中泛型定义',ast.line)
    check_dup(ast.params.keys(),scope,'函数中参数定义',ast.line)
    for(const i of ast.params.values())
        call(i,0)
    for(const i of ast.generic.values())
        call(i,0)
    call(ast.commands,0)
}
const Check_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    check_async_modifier(ast,scope,'变量')
    ast.modifiers._async=false
    call(ast.t,0)
    call(ast.value,0)
}
const Check_ListCommand:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    for(const i of ast.commands)call(i,0)
}
const Check_Loop:slang_check_visitor=(ast:WhileStatement|DoWhileStatement|ForeachStatement|ForStatement,scope,call)=>{
    scope.loop=true
    scope=scope.enter()
    call(ast.commands,0)
    scope=scope.leave()
    scope.loop=false
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
    scope.throw=true
    scope=scope.enter()
    call(ast.commands,0)
    scope=scope.leave()
    scope.throw=false
    call(ast.catch_.type,0)
    call(ast.catch_.command,0)
    call(ast.finally_,0)
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
const Check_LambdaExpression:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    check_dup(ast.generic.keys(),scope,'lambda中泛型定义',ast.line)
    check_dup(ast.params.keys(),scope,'lambda中参数定义',ast.line)
    for(const i of ast.params.values())
        call(i,0)
    for(const i of ast.generic.values())
        call(i,0)
    call(ast.body,0)
}
const Check_ArrayExpression:slang_check_visitor=(ast:ArrayExpression,scope,call)=>{
    for(const i of ast.elements)call(i,0)
}
const Check_MapExpression:slang_check_visitor=(ast:MapExpression,scope,call)=>{
    check_dup(ast.elements.keys(),scope,'map中key定义',ast.line)
    for(const i of ast.elements.values())call(i,0)
}
const Check_PostfixOrPrefixExpression:slang_check_visitor=(ast:PostfixExpression|PrefixExpression,scope,call)=>{
    call(ast.expr,0)
    if(ast instanceof ArgumentsPostfix)
        for(const i of ast.args)
            call(i,0)
    if(ast instanceof IndexPostfix)
        call(ast.index,0)
}
const Check_BinaryExpression:slang_check_visitor=(ast:BinaryExpression,scope,call)=>{
    call(ast.left,0)
    call(ast.right,0)
}
const Check_TernaryExpression:slang_check_visitor=(ast:TernaryExpression,scope,call)=>{
    call(ast.condition,0)
    call(ast.trueExpr,0)
    call(ast.falseExpr,0)
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
    [IfStatement, Check_IfStatement],
    [LambdaExpression, Check_LambdaExpression],
    [ExprCommand, Check_ExprCommand],
    [Await,Check_Await],
    [Assign,Check_Assign],
    [VarDecl,Check_VarDecl],
    [SwitchStatement,Check_SwitchStatement],
    [Return,Check_Return],
    [VM,Check_VM],
    [ArrayExpression,Check_ArrayExpression],
    [MapExpression,Check_MapExpression],
    [PostfixExpression,Check_PostfixOrPrefixExpression],
    [PrefixExpression,Check_PostfixOrPrefixExpression],
    [BinaryExpression,Check_BinaryExpression],
    [TernaryExpression,Check_TernaryExpression]
])