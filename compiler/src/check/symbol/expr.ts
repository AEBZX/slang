import {
    ArgumentsPostfix,
    ArrayExpression, BinaryExpression,
    Expression, IndexPostfix,
    LambdaExpression,
    MapExpression,
    PostfixExpression, PrefixExpression, TernaryExpression, TypePrefix,
    VarDecl
} from '../../utils'
import {slang_check_visitor, verify_generics} from '../tool'
const Verify_LambdaExpression:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    scope=scope.enter()
    for(const [k,v] of ast.generic)
        scope.set_generic(k,v)
    if(new Set(ast.params.keys()).size!=ast.params.size)
        scope.thr(`参数重复声明,在行${ast.line.join('\n')}`)
    for(const i of ast.params.values())
        call(i,2,scope)
    for(const [i,j] of ast.params)
        scope.set(i,new VarDecl(i,j,null))
    //generic implement且是否是Interface的是否存在
    verify_generics(ast,scope,call)
    call(ast.body,2,scope)
    call(ast.ret,2,scope)
    scope=scope.leave()
}
const Verify_MapExpressionOrArrayExpression:slang_check_visitor=(ast:MapExpression|ArrayExpression,scope,call)=>{
    ast.elements.forEach((i:Expression)=>call(i,2,scope))
}
const Verify_PostfixExpression:slang_check_visitor=(ast:PostfixExpression,scope,call)=> {
    call(ast.expr, 2)
    if (ast instanceof ArgumentsPostfix)
        for (const i of ast.args)
            call(i, 2)
    if(ast instanceof IndexPostfix)
        call(ast.index,2)
}
const Verify_PrefixExpression:slang_check_visitor=(ast:PrefixExpression,scope,call)=> {
    //TypePrefix 的转换目标类型在 ast.t 上,ast.type 是表达式自己的推断类型
    if(ast instanceof TypePrefix)
        call(ast.t,2)
    call(ast.expr,2)
}
const Verify_BinaryExpression:slang_check_visitor=(ast:BinaryExpression,scope,call)=> {
    call(ast.left,2)
    call(ast.right,2)
}
const Verify_TernaryExpression:slang_check_visitor=(ast:TernaryExpression,scope,call)=> {
    call(ast.condition,2)
    call(ast.trueExpr,2)
    call(ast.falseExpr,2)
}
export default new Map<any,slang_check_visitor>([
    [LambdaExpression,Verify_LambdaExpression],
    [MapExpression,Verify_MapExpressionOrArrayExpression],
    [ArrayExpression,Verify_MapExpressionOrArrayExpression],
    [PostfixExpression,Verify_PostfixExpression],
    [PrefixExpression,Verify_PrefixExpression],
    [BinaryExpression,Verify_BinaryExpression],
    [TernaryExpression,Verify_TernaryExpression]
])