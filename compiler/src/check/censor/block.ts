import {slang_check_visitor} from '../tool'
import {
    Cast,
    Class,
    File,
    Interface,
    LiteralType,
    Modifier,
    Module,
    Operation,
    Value,
    Variable,
    Function,
    Enum
} from '../../utils'
const Censor_File:slang_check_visitor=(ast:File,scope,call)=>{
    //link别名相同
    const alias_list=ast.links.map(l=>l.as)
    if(alias_list.length!=new Set(alias_list).size)
        scope.thr('link别名重复',ast)
    //检查子块
    for(const block of ast.children){
        //子块只能是value/module
        if(!(block instanceof Value||block instanceof Module))
            scope.thr('文件顶层只能是value/module',block)
        call(block,0)
    }
}
const Censor_Value:slang_check_visitor=(ast:Value,scope,call)=>{
    //value修饰符强制public=true,static=true,sync=true
    ast.modifiers=new Modifier(false,false,false)
    //重写类型必须是LiteralType
    if(!(ast instanceof LiteralType))
        scope.thr('重写类型必须是LiteralType',ast)
    //子块必须是operation/cast
    for(const child of ast.children){
        if(!(child instanceof Operation||child instanceof Cast))
            scope.thr('value内部必须是operation/cast',child)
        call(child,0)
    }
}
const Censor_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    //module修饰符强制static=true,sync=true
    ast.modifiers=new Modifier(false,false,ast.modifiers._private)
    //子块不能是value/operation/cast
    for(const child of ast.children){
        if(child instanceof Value||child instanceof Operation||child instanceof Cast)
            scope.thr('module内部不能是value/operation/cast',child)
        if(child instanceof Variable&&child.modifiers.unstatic)
            scope.thr('module内部的变量必须是静态的',child)
        call(child,0)
    }
}
const Censor_Enum:slang_check_visitor=(ast:Enum,scope,call)=>{
    //enum强制static=true,sync=true
    ast.modifiers=new Modifier(false,false,ast.modifiers._private)
    //重名检测
    if(ast.children.length!=new Set(ast.children).size)
        scope.thr('enum定义中存在重名',ast)
}
const Censor_Class_Interface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    //修饰符强制static=true,sync=true
    ast.modifiers=new Modifier(false,false,ast.modifiers._private)
    call(ast.implement,0)
    const generic_data=Array.from(ast.generic.keys())
    if(generic_data.length!=new Set(generic_data).size)
        scope.thr('类/接口中的泛型定义中存在重名',ast)
    for(const generic of ast.generic.values())
        call(generic,0)
    //子块只能是function/var/operation/cast
    for(const child of ast.children){
        if(!(child instanceof Function||child instanceof Variable||child instanceof Operation||child instanceof Cast))
            scope.thr('class/interface内部只能是function/var/operation/cast',child)
        call(child,0)
    }
}
const Censor_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    //generic重名检测
    const generic_list=Array.from(ast.generic.keys())
    if(generic_list.length!=new Set(generic_list).size)
        scope.thr('函数中的泛型定义中存在重名',ast)
    //参数重名检测
    const param_list=Array.from(ast.params.keys())
    if(param_list.length!=new Set(param_list).size)
        scope.thr('函数中的参数定义中存在重名',ast)
    for(const type of ast.generic.values())
        call(type,0)
    for(const param of ast.params.values())
        call(param,0)
    call(ast.return_type,0)
    call(ast.commands,0)
}
const Censor_Cast:slang_check_visitor=(ast:Cast,scope,call)=>{
    call(ast.t,0)
    call(ast.command,0)
}
const Censor_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    call(ast.t,0)
    call(ast.value,0)
}
const Censor_Operation:slang_check_visitor=(ast:Operation,scope,call)=>{
    call(ast.command,0)
}