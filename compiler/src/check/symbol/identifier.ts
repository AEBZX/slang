import {slang_check_visitor, symbol_do_generic} from '../tool'
import {ClassType, FixType, GenericType, LambdaType} from '../../utils'
const Symbol_Generic:slang_check_visitor=(ast:GenericType,scope,call)=>{
    if(!scope.get_generic(ast.generic))
        scope.thr('泛型不存在',ast)
}
const Symbol_Lambda:slang_check_visitor=(ast:LambdaType,scope,call)=> {
    symbol_do_generic(ast,ast.generic,scope,call)
    for(const type of ast.params.values())
        call(type,2,scope)
    call(ast.returnType,2,scope)
}
const Symbol_FixType:slang_check_visitor=(ast:FixType,scope,call)=>{
    call(ast.t,2,scope)
}
export default new Map<any,slang_check_visitor>([
    [GenericType,Symbol_Generic],
    [LambdaType,Symbol_Lambda],
    [FixType,Symbol_FixType]
])