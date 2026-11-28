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
import {join_path, slang_check_visitor} from './tool'
const Build_File:slang_check_visitor=(ast:File,scope,call)=>{
    for(const module of ast.children){
        scope.path=join_path(scope.path,module instanceof Value?(module.value instanceof NumberType?'number':'boolean'):module.name)
        call(module,1,scope)
    }
}
const Build_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    ast.global_local=scope.path.split('.')
    scope.global.set(scope.path,ast)
    const path=scope.path
    for(const item of ast.children) {
        scope.path=join_path(path,item.name)
        call(item, 1)
    }
    scope.path=path
}
const Build_Value:slang_check_visitor=(ast:Value,scope,call)=>{
    ast.global_local=scope.path.split('.')
    scope.global.set(scope.path,ast)
    scope.cast_oper_type=ast.value
    for(const item of ast.children)
        call(item, 1)
}
const Build_Enum:slang_check_visitor=(ast:Enum,scope,call)=>{
    ast.global_local=scope.path.split('.')
    scope.global.set(scope.path,ast)
}
const Build_Class_Interface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    ast.global_local=scope.path.split('.')
    scope.global.set(scope.path,ast)
    scope.cast_oper_type=new ClassType(ast.global_local,Array.from(ast.generic.values()))
    const path=scope.path
    for(const item of ast.children) {
        //operation/cast 成员脱糖后不带 Block 包装名,global_local 必须是宿主路径
        if(item instanceof Operation||item instanceof Cast)
            call(item, 1)
        else {
            scope.path=join_path(path,item.name)
            call(item, 1)
        }
    }
    scope.path=path
}
const Build_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    if(ast.modifiers.unstatic)return
    ast.global_local=scope.path.split('.')
    scope.global.set(scope.path,ast)
    scope.global.overload_set(scope.path,ast)
}
const Build_Operation:slang_check_visitor=(ast:Operation,scope,call)=>{
    ast.global_local=scope.path.split('.')
    scope.global.operation_set(scope.cast_oper_type,ast)
}
const Build_Cast:slang_check_visitor=(ast:Cast,scope,call)=>{
    ast.global_local=scope.path.split('.')
    //cast 按"输出类型"注册:cast_get 以目标类型查键
    scope.global.cast_set(ast.t,ast)
}
const Build_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    if(ast.modifiers.unstatic)return
    ast.global_local=scope.path.split('.')
    scope.global.set(scope.path,ast)
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
