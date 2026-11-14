import {slang_check_visitor, symbol_check_implement, symbol_do_generic, symbol_iden} from '../tool'
import {
    ASTTree,
    Class,
    File,
    Interface,
    Module,
    Value,
    Function,
    Variable,
    ClassType,
    Operation,
    Cast, BlockType
} from '../../utils'
const Symbol_File:slang_check_visitor=(ast:File,scope,call)=> {
    scope = scope.enter()
    for (const link of ast.links) {
        if (!scope.global.get(link.module.join('.')))
            scope.thr('link的模块不存在', link)
        scope.set(link.as, scope.global.get(link.module.join('.')))
    }
    scope.set('up',new BlockType([],true))
    symbol_iden(ast.children,scope)
    for(const item of ast.children)
        call(item,2)
    scope=scope.leave()
}
const Symbol_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    scope=scope.enter()
    scope.set('up',new BlockType([],true))
    symbol_iden(ast.children,scope)
    for(const item of ast.children)
        call(item,2)
    scope=scope.leave()
}
const Symbol_Value:slang_check_visitor=(ast:Value,scope,call)=>{
    scope=scope.enter()
    symbol_iden(ast.children,scope)
    scope.cast_oper_type=ast.value
    for(const item of ast.children)
        call(item,2)
    scope=scope.leave()
}
const Symbol_Class_Interface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    scope=scope.enter()
    symbol_iden(ast.children,scope)
    //检查implement
    symbol_check_implement(ast,ast.implement,scope)
    symbol_do_generic(ast,ast.generic,scope,call)
    call(ast.implement,2)
    //注册this
    scope.set('this',new ClassType([ast.name],Array.from(ast.generic.values()),true))
    scope.cast_oper_type=new ClassType([ast.name],Array.from(ast.generic.values()))
    for(const item of ast.children)
        call(item,2)
    scope=scope.leave()
}
const Symbol_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    scope=scope.enter()
    symbol_do_generic(ast,ast.generic,scope,call)
    for(const type of ast.generic.values())
        call(type,2)
    for(const [name,type] of ast.params)
        scope.set(name,type)
    call(ast.commands,2)
    call(ast.return_type,2)
    scope=scope.leave()
}
const Symbol_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    call(ast.t,2)
    call(ast.value,2)
}
const Symbol_Operation:slang_check_visitor=(ast:Operation,scope,call)=>{
    call(ast.command,2)
}
const Symbol_Cast:slang_check_visitor=(ast:Cast,scope,call)=>{
    call(ast.t,2)
    call(ast.command,2)
}