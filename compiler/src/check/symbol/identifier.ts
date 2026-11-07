import {BlockType, Class, ClassType, Enum, EnumType, GenericType, Interface, LambdaType} from '../../utils'
import {resolve_named, slang_check_visitor, verify_generics} from '../tool'
const Verify_ClassType:slang_check_visitor=(ast:ClassType,scope,call)=>{
    //按当前路径解析,模块内声明的接口也能被 resolve 到;枚举作类型标注同样合法
    const data=resolve_named(scope,ast.local.join('.'))
    if(data==null||!(data instanceof Interface||data instanceof Class||data instanceof Enum)){
        scope.thr(`类/接口${ast.local.join('.')}不是Class或Interface,在行${ast.line.join('\n')}`)
        return
    }
    //枚举没有泛型;泛型数量只在类/接口上校验
    if(!(data instanceof Enum)&&ast.generic.length!=data.generic.size)
        scope.thr(`泛型声明不匹配,在行${ast.line.join('\n')}`)
}
const Verify_LambdaType:slang_check_visitor=(ast:LambdaType,scope,call)=>{
    verify_generics(ast,scope,call)
    for(const i of ast.params.values())
        call(i,2)
    call(ast.returnType,2)
}
const Verify_BlockType:slang_check_visitor=(ast:BlockType,scope,call)=>{
    if(!scope.get(ast.local.join('.')))
        scope.thr(`${ast.local.join('.')}不存在,在行${ast.line.join('\n')}`)
}
const Verify_EnumType:slang_check_visitor=(ast:EnumType,scope,call)=>{
    const data=scope.get(ast.local.join('.'))
    if(data==null||!(data instanceof Enum))
        scope.thr(`${ast.local.join('.')}不存在或不是枚举,在行${ast.line.join('\n')}`)
}
const Verify_GenericType:slang_check_visitor=(ast:GenericType,scope,call)=>{
    if(!scope.get_generic(ast.generic))
        scope.thr(`泛型${ast.generic}不存在,在行${ast.line.join('\n')}`)
}
export default new Map<any,slang_check_visitor>([
    [ClassType,Verify_ClassType],
    [LambdaType,Verify_LambdaType],
    [BlockType,Verify_BlockType],
    [EnumType,Verify_EnumType],
    [GenericType,Verify_GenericType]
])