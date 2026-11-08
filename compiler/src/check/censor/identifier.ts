import {slang_check_visitor} from '../tool'
import {ClassType, FixType, LambdaType, ReferenceType} from '../../utils'
const Censor_Lambda:slang_check_visitor=(ast:LambdaType,scope,call)=>{
    const param_data=Array.from(ast.params.keys())
    const generic_data=Array.from(ast.generic.keys())
    if(param_data.length!=new Set(param_data).size)
        scope.thr('lambda类型定义中参数名称重复',ast)
    if(generic_data.length!=new Set(generic_data).size)
        scope.thr('lambda类型定义中泛型名称重复',ast)
    for(const value of ast.generic.values())
        call(value,0)
    for(const value of ast.params.values())
        call(value,0)
    call(ast.returnType,0)
}
const Censor_Class:slang_check_visitor=(ast:ClassType,scope,call)=>{
    for(const value of ast.generic)
        call(value,0)
}
const Censor_FixType:slang_check_visitor=(ast:FixType,scope,call)=>{
    call(ast.t,0)
}