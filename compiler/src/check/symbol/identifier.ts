import {slang_check_visitor, symbol_do_generic} from '../tool'
import {ClassType, FixType, GenericType, LambdaType} from '../../utils'
const Symbol_Generic:slang_check_visitor=(ast:GenericType,scope,call)=>{
    if(!scope.get_generic(ast.generic))
        scope.thr('泛型不存在',ast)
}
const Symbol_Lambda:slang_check_visitor=(ast:LambdaType,scope,call)=> {
    symbol_do_generic(ast,ast.generic,scope,call)
    for(const type of ast.params.values())
        call(type,2)
    call(ast.returnType,2)
}
const Symbol_ClassType:slang_check_visitor=(ast:ClassType,scope,call)=>{
    for(const type of ast.generic)
        call(type,2)
}
const Symbol_FixType:slang_check_visitor=(ast:FixType,scope,call)=>{
    call(ast.t,2)
}