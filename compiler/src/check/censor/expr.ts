import {slang_check_visitor} from '../tool'
import {
    ArgumentsPostfix,
    ArrayExpression, BinaryExpression,
    DecrementPostfix,
    IncrementPostfix,
    IndexPostfix,
    LambdaExpression,
    MapExpression, MemberPostfix, PrefixExpression, TernaryExpression, TypePrefix
} from '../../utils'
const Censor_Array:slang_check_visitor=(ast:ArrayExpression,scope,call)=>{
    for(const item of ast.elements)
        call(item,0)
}
const Censor_Map:slang_check_visitor=(ast:MapExpression,scope,call)=>{
    for(const value of ast.elements.values())
        call(value,0)
}
const Censor_Lambda:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    const param_data=Array.from(ast.params.keys())
    const generic_data=Array.from(ast.generic.keys())
    if(param_data.length!=new Set(param_data).size)
        scope.thr('lambda表达式中参数名称重复',ast)
    if(generic_data.length!=new Set(generic_data).size)
        scope.thr('lambda表达式中泛型名称重复',ast)
    for(const value of ast.generic.values())
        call(value,0)
    for(const value of ast.params.values())
        call(value,0)
    call(ast.body,0)
    call(ast.ret,0)
}
const Censor_IncPostfix_DecPostfix_Member:slang_check_visitor=(ast:IncrementPostfix|DecrementPostfix|MemberPostfix,scope,call)=>{
    call(ast.expr,0)
}
const Censor_Index:slang_check_visitor=(ast:IndexPostfix,scope,call)=>{
    call(ast.expr,0)
    call(ast.index,0)
}
const Censor_Argument:slang_check_visitor=(ast:ArgumentsPostfix,scope,call)=>{
    call(ast.expr,0)
    for(const generic of ast.generic)
        call(generic,0)
    for(const item of ast.args)
        call(item,0)
}
const Censor_Prefix:slang_check_visitor=(ast:PrefixExpression,scope,call)=>{
    call(ast.expr,0)
    if(ast instanceof TypePrefix)
        call(ast.t,0)
}
const Censor_Binary:slang_check_visitor=(ast:BinaryExpression,scope,call)=>{
    call(ast.left,0)
    call(ast.right,0)
}
const Censor_Ternary:slang_check_visitor=(ast:TernaryExpression,scope,call)=>{
    call(ast.condition,0)
    call(ast.trueExpr,0)
    call(ast.falseExpr,0)
}
