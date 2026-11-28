import {instance_field, slang_check_visitor, symbol_do_generic} from '../tool'
import {Class, ClassType, FixType, GenericType, Interface, LambdaType} from '../../utils'
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
//标注用 ClassType 就地解析:相对路径→绝对路径,并携带实例视图 field
const Symbol_ClassType:slang_check_visitor=(ast:ClassType,scope,call)=>{
    const block=scope.get(ast.local.join('.'))
    if(block instanceof Class||block instanceof Interface){
        ast.local=block.global_local
        ast.field=instance_field(block.children,false)
    }
}
const Symbol_FixType:slang_check_visitor=(ast:FixType,scope,call)=>{
    call(ast.t,2,scope)
}
export default new Map<any,slang_check_visitor>([
    [GenericType,Symbol_Generic],
    [LambdaType,Symbol_Lambda],
    [ClassType,Symbol_ClassType],
    [FixType,Symbol_FixType]
])