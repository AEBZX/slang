import {Class, ClassType, Enum, EnumType, FixType, Interface} from '../../utils'
import {bindGenerics, param_is, resolve_named, slang_check_visitor} from '../tool'
const Label_FixType:slang_check_visitor=(ast:FixType,scope,call)=>{
    call(ast.t,3)
}
const Label_ClassType:slang_check_visitor=(ast:ClassType,scope,call)=>{
    //generic和定义范围是否兼容;跨模块裸类型名靠 resolve_named 的路径补全
    const block=resolve_named(scope,ast.local.join('.'))
    if(block==null||!(block instanceof Class||block instanceof Interface||block instanceof Enum)){
        scope.thr(`类/接口${ast.local.join('.')}不存在,在行${(ast.line??[]).join('\n')}`)
        return
    }
    if(block instanceof Enum)return
    bindGenerics(scope,block.generic,ast.generic)
    if(!param_is(ast.generic,block.generic,scope))
        scope.thr(`generic参数类型错误,在行${(ast.line??[]).join('\n')}`)
}
const Label_EnumType:slang_check_visitor=(ast:EnumType,scope,call)=>{
    const block=resolve_named(scope,ast.local.join('.'))
    if(block==null||!(block instanceof Enum))scope.thr(`未定义的枚举${ast.local.join('.')}`)
}
export default new Map<any,slang_check_visitor>([
    [FixType,Label_FixType],
    [ClassType,Label_ClassType],
    [EnumType,Label_EnumType]
])