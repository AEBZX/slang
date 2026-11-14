import {
    BlockType,
    Class,
    Module,
    File,
    Value,
    Interface,
    Function,
    LambdaType,
    Variable,
    Operation,
    Cast
} from '../../utils'
import {slang_check_visitor, symbol_iden} from '../tool'
const Type_File:slang_check_visitor=(ast:File,scope,call)=>{
    scope=scope.enter()
    for(const link of ast.links)
        scope.set(link.as,new BlockType([link.module.join('.')],true))
    symbol_iden(ast.children,scope)
    for(const item of ast.children)
        call(item,3)
    scope=scope.leave()
}
const Type_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    ast.type=new BlockType(scope.global.path.split('.'))
    scope=scope.enter()
    scope.set('up',new BlockType(scope.global.path.split('.'),true))
    symbol_iden(ast.children,scope)
    for(const item of ast.children)
        call(item,3)
    scope=scope.leave()
}
const Type_Value:slang_check_visitor=(ast:Value,scope,call)=>{
    scope=scope.enter()
    for(const item of ast.children)
        call(item,3)
    scope=scope.leave()
}
const Type_Class_Interface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    ast.type=new BlockType(scope.global.path.split('.'))
    scope=scope.enter()
    scope.set('up',new BlockType(scope.global.path.split('.'),true))
    call(ast.implement,3)
    symbol_iden(ast.children,scope)
    for(const item of ast.children)
        call(item,3)
    scope=scope.leave()
}
const Type_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    ast.type=new LambdaType(ast.generic,ast.params,ast.return_type,true,ast.name)
    scope=scope.enter()
    for(const [name,type] of ast.generic)
        scope.set_generic(name,type)
    for(const [name,type] of ast.params)
        scope.set(name,type)
    for(const type of ast.generic.values())
        call(type,3)
    for(const type of ast.params.values())
        call(type,3)
    call(ast.commands,3)
    call(ast.return_type,3)
    scope=scope.leave()
}
const Type_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    call(ast.t,3)
    call(ast.value,3)
}
const Type_Operation:slang_check_visitor=(ast:Operation,scope,call)=>{
    call(ast.command,3)
}
const Type_Cast:slang_check_visitor=(ast:Cast,scope,call)=>{
    call(ast.t,3)
    call(ast.command,3)
}