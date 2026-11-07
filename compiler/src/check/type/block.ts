import {
    ArrayExpression,
    ArrayType,
    BlockType, Cast,
    ClassType,
    Enum,
    Interface,
    LambdaType,
    Module, Operation, Value,
    VarDecl, Variable, VoidType,File,Function,Class
} from '../../utils'
import {
    cast,
    generic_name,
    nameToLocal,
    operation,
    real_type,
    set_name,
    slang_check_visitor,
    to_point,
    type_
} from '../tool'
const Label_File:slang_check_visitor=(ast:File,scope,call)=>{
    scope=scope.enter()
    for(const i of ast.links)
        scope.set(i.as,scope.get(i.module.join('.')))
    for(const i of ast.children)
        call(i,3,scope)
    scope=scope.leave()
}
const Label_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    const full=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    const exist=scope.get(full)
    if(exist!=null&&exist!==ast&&exist instanceof Module)return
    const name=set_name(ast,scope)
    scope=scope.enter()
    scope.path=name
    scope.set('up',new BlockType(name.split('.'),true))
    for(const i of ast.children){
        scope.set(i.name,i)
        if(i instanceof Function)i.type=new LambdaType(i.generic,i.params,i.return_type,true,scope.path==''?i.name:`${scope.path}.${i.name}`)
    }
    for(const i of ast.children)
        call(i,3,scope)
    scope=scope.leave()
}
const Label_ClassOrInterface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    const name=set_name(ast,scope)
    scope=scope.enter()
    scope.path=name
    for(const i of ast.children){
        scope.set(i.name,i)
        if(i instanceof Function)i.type=new LambdaType(i.generic,i.params,i.return_type,true,scope.path==''?i.name:`${scope.path}.${i.name}`)
    }
    for(const [k,v] of ast.generic){
        call(v,3,scope)
        if(!generic_name(k,scope))scope.thr(`泛型${k}重复定义在行${v.line.join('\n')}`)
        scope.set_generic(k,v)
    }
    call(ast.implement,3,scope)
    scope.set('this',new ClassType(nameToLocal(name),Array.from(ast.generic.values()),true))
    scope.set('up',new BlockType(nameToLocal(name),true))
    for(const i of ast.children)
        call(i,3,scope)
    scope=scope.leave()
}
const Label_Enum:slang_check_visitor=(ast:Enum,scope,call)=>{
    set_name(ast,scope)
}
const Label_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    const full=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    scope.set(ast.name,ast)
    scope.set_overload(ast.name,ast)
    ast.type=new LambdaType(ast.generic,ast.params,ast.return_type,true,full)
    scope=scope.enter()
    for(const [k,v] of ast.generic){
        call(v,3,scope)
        if(!generic_name(k,scope))scope.thr(`泛型${k}重复定义在行${v.line.join('\n')}`)
        scope.set_generic(k,v)
    }
    for(const [k,v] of ast.params){
        call(v,3,scope)
        let param=new VarDecl(k,v,null)
        param.type=real_type(v,scope)
        scope.set(k,param)
    }
    scope.set('return',ast.return_type)
    call(ast.return_type,3,scope)
    call(ast.commands,3,scope)
    scope=scope.leave()
}
const Label_Value:slang_check_visitor=(ast:Value,scope,call)=>{
    for(const i of ast.children)
        call(i,3)
}
const Label_OperationOrCast:slang_check_visitor=(ast:Operation|Cast,scope,call)=>{
    call(ast.command,3)
}
const Label_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    call(ast.value,3)
    call(ast.t,3)
    scope.set(ast.name,ast)
    ast.type=real_type(ast.t,scope)
    if(ast.t instanceof VoidType)scope.thr(`变量${ast.name}声明类型为void,在行${(ast.line??[]).join('\n')}`)
    //无初值的声明不做赋值兼容检查
    if(ast.value instanceof ArrayExpression&&ast.type instanceof ArrayType){
        const elem=ast.type.t
        for(const i of ast.value.elements)
            if(!type_(i.type,elem,scope)&&!(i.type instanceof VoidType))
                scope.thr(`数组元素类型错误在行${(i.line??[]).join('\n')}`)
    }
    if(ast.value==null)return
    if(operation('=',ast,scope,to_point(ast.t),to_point(ast.value.type)))return
    if(type_(ast.value.type,ast.t,scope))return
    if(cast(ast,scope,ast.t))return
    scope.thr(`赋值类型错误在行${(ast.line??[]).join('\n')}`)
}
export default new Map<any,slang_check_visitor>([
    [File,Label_File],
    [Module,Label_Module],
    [Class,Label_ClassOrInterface],
    [Interface,Label_ClassOrInterface],
    [Enum,Label_Enum],
    [Function,Label_Function],
    [Value,Label_Value],
    [Operation,Label_OperationOrCast],
    [Cast,Label_OperationOrCast],
    [Variable,Label_Variable]
])