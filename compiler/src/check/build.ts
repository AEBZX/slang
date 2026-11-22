import {
    Class,
    File,
    Module,
    Function,
    Interface,
    Operation,
    ClassType,
    Cast,
    Variable,
    Enum,
    Value,
    NumberType, BooleanType
} from '../utils'
import {local, slang_check_visitor} from './tool'
const Build_File:slang_check_visitor=(ast:File,scope,call)=>{
    for(const module of ast.children)
        call(module,1,scope)
}
const Build_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    scope.global.set(local(scope,ast),ast)
    ast.global_local=(local(scope,ast)).split('.')
    const path=scope.path
    for(const item of ast.children) {
        scope.path=path+'.'+ast.name+'.'
        call(item, 1)
    }
    scope.path=path
}
const Build_Value:slang_check_visitor=(ast:Value,scope,call)=>{
    scope.global.set(local(scope,ast),ast)
    scope.cast_oper_type=ast.value
    const _local=ast.value instanceof NumberType?'number':'boolean'
    for(const item of ast.children) {
        scope.path=scope.path==''?_local:scope.path+'.'+_local+'.'
        call(item, 1)
    }
}
const Build_Enum:slang_check_visitor=(ast:Enum,scope,call)=>{
    scope.global.set(local(scope,ast),ast)
    ast.global_local=(local(scope,ast)).split('.')
}
const Build_Class_Interface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    scope.global.set(local(scope,ast),ast)
    ast.global_local=(local(scope,ast)).split('.')
    scope.cast_oper_type=new ClassType((local(scope,ast)).split('.'),Array.from(ast.generic.values()))
    for(const item of ast.children) {
        scope.path=local(scope,item)
        call(item, 1)
    }
}
const Build_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    if(ast.modifiers.unstatic)return
    scope.global.set(local(scope,ast),ast)
    ast.global_local=(local(scope,ast)).split('.')
}
const Build_Operation:slang_check_visitor=(ast:Operation,scope,call)=>{
    scope.global.set(local(scope,ast),ast)
    ast.global_local=(local(scope,ast)).split('.')
    scope.global.operation_set(scope.cast_oper_type,ast)
}
const Build_Cast:slang_check_visitor=(ast:Cast,scope,call)=>{
    scope.global.set(local(scope,ast),ast)
    ast.global_local=(local(scope,ast)).split('.')
    scope.global.cast_set(scope.cast_oper_type,ast)
}
const Build_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    if(ast.modifiers.unstatic)return
    scope.global.set(local(scope,ast),ast)
    ast.global_local=(local(scope,ast)).split('.')
}
export default new Map<any,slang_check_visitor>([
    [File,Build_File],
    [Module,Build_Module],
    [Value,Build_Value],
    [Enum,Build_Enum],
    [Class,Build_Class_Interface],
    [Interface,Build_Class_Interface],
    [Function,Build_Function],
    [Operation,Build_Operation],
    [Cast,Build_Cast],
    [Variable,Build_Variable]
])