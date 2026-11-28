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
    scope.global.path=''
    scope = scope.enter(false,true)
    for (const link of ast.links) {
        if (!scope.global.get(link.module.join('.')))
            scope.thr('link的模块不存在', link)
        scope.set(link.as, scope.global.get(link.module.join('.')))
    }
    symbol_iden(ast.children,scope)
    for(const item of ast.children)
        call(item,2,scope)
    scope=scope.leave()
}
const Symbol_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    scope.global.path=ast.global_local.join('.')
    scope=scope.enter(false,true)
    scope.set('up',new BlockType([],ast.children))
    symbol_iden(ast.children,scope)
    for(const item of ast.children)
        call(item,2,scope)
    scope=scope.leave()
}
const Symbol_Value:slang_check_visitor=(ast:Value,scope,call)=>{
    scope=scope.enter(false,true)
    symbol_iden(ast.children,scope)
    for(const item of ast.children)
        call(item,2,scope)
    scope=scope.leave()
}
const Symbol_Class_Interface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    scope.global.path=ast.global_local.join('.')
    scope=scope.enter(false,true)
    symbol_iden(ast.children,scope)
    symbol_do_generic(ast,ast.generic,scope,call)
    if(ast.implement!=null){
        //检查implement
        symbol_check_implement(ast,ast.implement,scope)
        call(ast.implement,2,scope);
        //替换为绝对路径
        (ast.implement as ClassType).local=(scope.get((ast.implement as ClassType).local.join('.')) as Class|Interface).global_local
    }
    //注册this
    scope.set('this',new ClassType([ast.name],ast.children))
    for(const item of ast.children)
        call(item,2,scope)
    scope=scope.leave()
}
const Symbol_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    scope=scope.enter(true)
    symbol_do_generic(ast,ast.generic,scope,call)
    for(const type of ast.generic.values())
        call(type,2,scope)
    for(const [name,type] of ast.params)
        scope.set(name,type)
    call(ast.commands,2,scope)
    call(ast.return_type,2,scope)
    scope=scope.leave()
}
const Symbol_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    call(ast.t,2,scope)
    call(ast.value,2,scope)
}
const Symbol_Operation:slang_check_visitor=(ast:Operation,scope,call)=>{
    call(ast.command,2,scope)
}
const Symbol_Cast:slang_check_visitor=(ast:Cast,scope,call)=>{
    call(ast.t,2,scope)
    call(ast.command,2,scope)
}
export default new Map<any,slang_check_visitor>([
    [File,Symbol_File],
    [Module,Symbol_Module],
    [Value,Symbol_Value],
    [Class,Symbol_Class_Interface],
    [Interface,Symbol_Class_Interface],
    [Function,Symbol_Function],
    [Variable,Symbol_Variable],
    [Operation,Symbol_Operation],
    [Cast,Symbol_Cast]
])