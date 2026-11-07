import {
    Cast, Class,
    ClassType,
    Enum,
    File,
    GenericType,
    Interface,
    LiteralType,
    Module,
    Operation,
    Value, Variable,
    VoidType,
    Function
} from '../../utils'
import {check_async_modifier, check_dup, check_static_modifier, fill_modifier, slang_check_visitor} from '../tool'
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
    ast.modifiers=fill_modifier(ast)
    //implement必须是ClassType
    if(ast.implement!=null&&!(ast.implement instanceof ClassType))
        scope.thr(`类的/接口implement的模块必须是接口,在行${ast.line.join('\n')}`)
    check_dup(ast.generic,scope,'类/接口中泛型',ast.line)
    for(const i of ast.generic.values())
        if(!(i instanceof ClassType||i instanceof GenericType||i instanceof VoidType))
            scope.thr(`类/接口中泛型的implement的模块必须是接口,在行${ast.line.join('\n')}`)
    for(const i of ast.generic.values())
        call(i,0)
    for(const i of ast.children){
        if(!(i instanceof Operation||i instanceof Cast||i instanceof Variable||i instanceof Function))
            scope.thr(`类/接口内部只能是operation/cast/variable/function,在行${i.line.join('\n')}`)
        if(ast instanceof Class&&i instanceof Function&&i.commands==null)
            scope.thr(`类内部的function必须实现,在行${i.line.join('\n')}`)
        if(ast instanceof Interface&&i instanceof Function&&i.commands!=null)
            scope.thr(`接口内部的function不可以实现,在行${i.line.join('\n')}`)
        call(i,0)
    }
}
const Check_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    ast.modifiers=fill_modifier(ast)
    check_dup(ast.generic,scope,'函数中泛型定义',ast.line)
    check_dup(ast.params,scope,'函数中参数定义',ast.line)
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
export default new Map<any,slang_check_visitor>([
    [File,Check_File],
    [Value,Check_Value],
    [Operation,Check_Operation],
    [Cast,Check_Cast],
    [Module,Check_Module],
    [Enum,Check_Enum],
    [Class,Check_ClassOrInterface],
    [Interface,Check_ClassOrInterface],
    [Function,Check_Function],
    [Variable,Check_Variable]
])