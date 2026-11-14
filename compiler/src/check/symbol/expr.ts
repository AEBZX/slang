import {slang_check_visitor, symbol_do_generic} from '../tool'
import {
    ArgumentsPostfix,
    ArrayExpression, BinaryExpression,
    DecrementPostfix, DecrementPrefix,
    IdentifierExpr,
    IncrementPostfix,
    IncrementPrefix, IndexPostfix,
    LambdaExpression, MemberPostfix, PrefixExpression, TernaryExpression, TypePrefix
} from '../../utils'
const Symbol_Identifier:slang_check_visitor=(ast:IdentifierExpr,scope,call)=>{
    if(!scope.get(ast.name))
        scope.thr('未定义的变量',ast)
}
const Symbol_Array:slang_check_visitor=(ast:ArrayExpression,scope,call)=>{
    for(const item of ast.elements)
        call(item,2)
}
const Symbol_Lambda:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    scope=scope.enter()
    symbol_do_generic(ast,ast.generic,scope,call)
    for(const type of ast.params.values())
        call(type,2)
    for(const [name,type] of ast.params)
        scope.set(name,type)
    call(ast.body,2)
    call(ast.ret,2)
    scope=scope.leave()
}
const Symbol_Inc_Dec:slang_check_visitor=(ast:IncrementPostfix|DecrementPostfix,scope,call)=>{
    call(ast.expr,2)
}
const Symbol_Member:slang_check_visitor=(ast:MemberPostfix,scope,call)=>{
    call(ast.expr,2)
}
const Symbol_Index:slang_check_visitor=(ast:IndexPostfix,scope,call)=>{
    call(ast.expr,2)
    call(ast.index,2)
}
const Symbol_Arguments:slang_check_visitor=(ast:ArgumentsPostfix,scope,call)=>{
    call(ast.expr,2)
    for(const type of ast.generic)
        call(type,2)
    for(const item of ast.args)
        call(item,2)
}
const Symbol_Prefix:slang_check_visitor=(ast:PrefixExpression,scope,call)=>{
    call(ast.expr,2)
    if(ast instanceof TypePrefix)
        call(ast.t,2)
}
const Symbol_Binary:slang_check_visitor=(ast:BinaryExpression,scope,call)=>{
    call(ast.left,2)
    call(ast.right,2)
}
const Symbol_Ternary:slang_check_visitor=(ast:TernaryExpression,scope,call)=>{
    call(ast.condition,2)
    call(ast.trueExpr,2)
    call(ast.falseExpr,2)
}