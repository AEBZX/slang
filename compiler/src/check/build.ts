import {Class, File, Module, Function, Interface, Operation, ClassType, Cast, Variable, Enum, Value} from '../utils'
import {slang_check_visitor} from './tool'
const Build_File:slang_check_visitor=(ast:File,scope,call)=>{
    for(const module of ast.children)
        call(module,1)
    //下一轮检查
    call(ast,2)
}
const Build_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    scope.global.set(scope.path+'.'+ast.name,ast)
    ast.global_local=(scope.path+'.'+ast.name).split('.')
    for(const item of ast.children) {
        scope.path=scope.path+'.'+ast.name+'.'
        call(item, 1)
    }
}
const Build_Value:slang_check_visitor=(ast:Value,scope,call)=>{
    scope.global.set(scope.path+'.'+ast.name,ast)
    scope.cast_oper_type=ast.value
    for(const item of ast.children)
        call(item,1)
}
const Build_Enum:slang_check_visitor=(ast:Enum,scope,call)=>{
    scope.global.set(scope.path+'.'+ast.name,ast)
    ast.global_local=(scope.path+'.'+ast.name).split('.')
}
const Build_Class_Interface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    scope.global.set(scope.path+'.'+ast.name,ast)
    ast.global_local=(scope.path+'.'+ast.name).split('.')
    scope.cast_oper_type=new ClassType((scope.path+'.'+ast.name).split('.'),Array.from(ast.generic.values()))
    for(const item of ast.children) {
        scope.path=scope.path+'.'+ast.name+'.'
        call(item, 1)
    }
}
const Build_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    if(ast.modifiers.unstatic)return
    scope.global.set(scope.path+'.'+ast.name,ast)
    scope.global.overload_set(scope.path+'.'+ast.name,ast)
    ast.global_local=(scope.path+'.'+ast.name).split('.')
}
const Build_Operation:slang_check_visitor=(ast:Operation,scope,call)=>{
    scope.global.set(scope.path+'.'+ast.name,ast)
    scope.global.operation_set(scope.cast_oper_type,ast)
    scope.path=scope.path+'.'+ast.name+'.'
}
const Build_Cast:slang_check_visitor=(ast:Cast,scope,call)=>{
    scope.global.set(scope.path+'.'+ast.name,ast)
    scope.global.cast_set(scope.cast_oper_type,ast)
    scope.path=scope.path+'.'+ast.name+'.'
}
const Build_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    if(ast.modifiers.unstatic)return
    scope.global.set(scope.path+'.'+ast.name,ast)
    ast.global_local=(scope.path+'.'+ast.name).split('.')
}