import {
    ArgumentsPostfix,
    ArrayExpression, BinaryExpression, IndexPostfix,
    LambdaExpression,
    MapExpression,
    PostfixExpression,
    PrefixExpression,
    TernaryExpression
} from '../../utils'
import {check_dup, slang_check_visitor} from '../tool'
const Check_LambdaExpression:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    check_dup(ast.generic,scope,'lambda中泛型定义',ast.line)
    check_dup(ast.params,scope,'lambda中参数定义',ast.line)
    for(const i of ast.params.values())
        call(i,0)
    for(const i of ast.generic.values())
        call(i,0)
    call(ast.body,0)
}
const Check_ArrayExpression:slang_check_visitor=(ast:ArrayExpression,scope,call)=>{
    for(const i of ast.elements)call(i,0)
}
const Check_MapExpression:slang_check_visitor=(ast:MapExpression,scope,call)=>{
    check_dup(ast.elements,scope,'map中key定义',ast.line)
    for(const i of ast.elements.values())call(i,0)
}
const Check_PostfixOrPrefixExpression:slang_check_visitor=(ast:PostfixExpression|PrefixExpression,scope,call)=>{
    call(ast.expr,0)
    if(ast instanceof ArgumentsPostfix)
        for(const i of ast.args)
            call(i,0)
    if(ast instanceof IndexPostfix)
        call(ast.index,0)
}
const Check_BinaryExpression:slang_check_visitor=(ast:BinaryExpression,scope,call)=>{
    call(ast.left,0)
    call(ast.right,0)
}
const Check_TernaryExpression:slang_check_visitor=(ast:TernaryExpression,scope,call)=>{
    call(ast.condition,0)
    call(ast.trueExpr,0)
    call(ast.falseExpr,0)
}
export default new Map<any,slang_check_visitor>([
    [LambdaExpression,Check_LambdaExpression],
    [ArrayExpression,Check_ArrayExpression],
    [MapExpression,Check_MapExpression],
    [PostfixExpression,Check_PostfixOrPrefixExpression],
    [PrefixExpression,Check_PostfixOrPrefixExpression],
    [BinaryExpression,Check_BinaryExpression],
    [TernaryExpression,Check_TernaryExpression]
])