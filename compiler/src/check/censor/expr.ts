import {slang_check_visitor} from '../tool'
import {
    ArgumentsPostfix,
    ArrayExpression, BinaryExpression,
    DecrementPostfix,
    IncrementPostfix,
    IndexPostfix,
    LambdaExpression, MemberPostfix, PrefixExpression, TernaryExpression, TypePrefix
} from '../../utils'
const Censor_Array:slang_check_visitor=(ast:ArrayExpression,scope,call)=>{
    for(const item of ast.elements)
        call(item,0,scope)
}
const Censor_Lambda:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    const param_data=Array.from(ast.params.keys())
    const generic_data=Array.from(ast.generic.keys())
    if(param_data.length!=new Set(param_data).size)
        scope.thr('lambda表达式中参数名称重复',ast)
    if(generic_data.length!=new Set(generic_data).size)
        scope.thr('lambda表达式中泛型名称重复',ast)
    for(const value of ast.generic.values())
        call(value,0,scope)
    for(const value of ast.params.values())
        call(value,0,scope)
    call(ast.body,0,scope)
    call(ast.ret,0,scope)
}
const Censor_IncPostfix_DecPostfix_Member:slang_check_visitor=(ast:IncrementPostfix|DecrementPostfix|MemberPostfix,scope,call)=>{
    call(ast.expr,0,scope)
}
const Censor_Index:slang_check_visitor=(ast:IndexPostfix,scope,call)=>{
    call(ast.expr,0,scope)
    call(ast.index,0,scope)
}
const Censor_Argument:slang_check_visitor=(ast:ArgumentsPostfix,scope,call)=>{
    call(ast.expr,0,scope)
    for(const generic of ast.generic)
        call(generic,0,scope)
    for(const item of ast.args)
        call(item,0,scope)
}
const Censor_Prefix:slang_check_visitor=(ast:PrefixExpression,scope,call)=>{
    call(ast.expr,0,scope)
    if(ast instanceof TypePrefix)
        call(ast.t,0,scope)
}
const Censor_Binary:slang_check_visitor=(ast:BinaryExpression,scope,call)=>{
    call(ast.left,0,scope)
    call(ast.right,0,scope)
}
const Censor_Ternary:slang_check_visitor=(ast:TernaryExpression,scope,call)=>{
    call(ast.condition,0,scope)
    call(ast.trueExpr,0,scope)
    call(ast.falseExpr,0,scope)
}
export default new Map<any,slang_check_visitor>([
    [ArrayExpression,Censor_Array],
    [LambdaExpression,Censor_Lambda],
    [IncrementPostfix,Censor_IncPostfix_DecPostfix_Member],
    [DecrementPostfix,Censor_IncPostfix_DecPostfix_Member],
    [MemberPostfix,Censor_IncPostfix_DecPostfix_Member],
    [IndexPostfix,Censor_Index],
    [ArgumentsPostfix,Censor_Argument],
    [PrefixExpression,Censor_Prefix],
    [BinaryExpression,Censor_Binary],
    [TernaryExpression,Censor_Ternary]
])