import {address, desugar_cast, desugar_oper, expr_desugar, LiteralToConst, slang_desugar_visitor} from './tool'
import {
    AAssign,
    AddAssign, AddExpression,
    AddressPrefix,
    ArgumentsPostfix,
    ArrayExpression, Assign, BinaryExpression, AndAssign, OrAssign, ShlAssign, ShrAssign,
    AndExpression, OrExpression, XorExpression, XorAssign, Class, ClassType, Expression,
    IdentifierExpr, IndexPostfix,
    LambdaExpression,
    LiteralType,
    MapExpression, MemberPostfix, ModAssign, Modifier, MulAssign, MulExpression, NumberLiteral,
    PostfixExpression, PrefixExpression, ShlExpression,
    ShrExpression, SubAssign, SubExpression, TernaryExpression,
    Type, IncrementPostfix, IncrementPrefix, DecrementPostfix, DecrementPrefix, ReferencePrefix, NewPrefix, MinusPrefix
} from '../utils'
import {slang_check_visitor} from "../check/tool";
const D_ArrayOrMapExpression:slang_desugar_visitor=(node:MapExpression|ArrayExpression,call)=>{
    if(node instanceof ArrayExpression)node.elements=node.elements.map(call) as Expression[]
    if(node instanceof MapExpression){
        for(const [k,v] of node.elements)
            node.elements.set(k,call(v) as Expression)
    }
    return node
}
const D_LambdaExpression:slang_desugar_visitor=(node:LambdaExpression,call)=>{
    node.body=call(node.body)
    return node
}
const D_IncrementOrDecrementPostfixOrPrefix:slang_desugar_visitor=(node:IncrementPostfix|IncrementPrefix|DecrementPostfix|DecrementPrefix,call)=>{
    node.expr=call(node.expr) as Expression
    return expr_desugar(node,node.expr)
}
const D_MemberPostfix:slang_desugar_visitor=(node:MemberPostfix,call)=>{
    node.expr=call(node.expr) as Expression
    return expr_desugar(node,node.expr)
}
const D_IndexPostfix:slang_desugar_visitor=(node:IndexPostfix,call)=>{
    node.expr=call(node.expr) as Expression
    node.index=call(node.index) as Expression
    return expr_desugar(node,node.expr,node.index)
}
const D_ArgumentsPostfix:slang_desugar_visitor=(node:ArgumentsPostfix,call)=>{
    node.expr=call(node.expr) as Expression
    node.args=node.args.map(call) as Expression[]
    //添加this
    //a.b(a,b,c)如果加个this那么没有副作用,可以不用判断是不是ClassObject.Field
    if(node.expr instanceof MemberPostfix&&node.expr.expr.type instanceof ClassType)
        node.args.push(node.expr.expr)
    if(node.call_target!=null){
        let expr=null
        for(const i of node.call_target.split('.'))
            expr=expr==null?new IdentifierExpr(i):new MemberPostfix(expr,i)
        return call(new ArgumentsPostfix(expr,node.generic,node.args))
    }
    return expr_desugar(node,node.expr,...node.args)
}
const D_PrefixExpression:slang_desugar_visitor=(node:PrefixExpression,call)=>{
    node.expr=call(node.expr) as Expression
    const _node=expr_desugar(node,node.expr)
    if(_node instanceof MinusPrefix)
        return new SubExpression(new NumberLiteral('0'),node.expr)
    if(_node instanceof NewPrefix)
        return _node.expr
    return _node
}
const D_BinaryExpression:slang_desugar_visitor=(node:BinaryExpression,call)=>{
    node.left=call(node.left) as Expression
    node.right=call(node.right) as Expression
    return expr_desugar(node,node.left,node.right)
}
const D_TernaryExpression:slang_desugar_visitor=(node:TernaryExpression,call)=>{
    node.condition=call(node.condition) as Expression
    node.trueExpr=call(node.trueExpr) as Expression
    node.falseExpr=call(node.falseExpr) as Expression
    return expr_desugar(node)
}
export default new Map<any,slang_desugar_visitor>([
    [ArrayExpression,D_ArrayOrMapExpression],
    [MapExpression,D_ArrayOrMapExpression],
    [LambdaExpression,D_LambdaExpression],
    [BinaryExpression,D_BinaryExpression],
    [TernaryExpression,D_TernaryExpression],
    [IncrementPrefix,D_IncrementOrDecrementPostfixOrPrefix],
    [DecrementPrefix,D_IncrementOrDecrementPostfixOrPrefix],
    [IncrementPostfix,D_IncrementOrDecrementPostfixOrPrefix],
    [DecrementPostfix,D_IncrementOrDecrementPostfixOrPrefix],
    [MemberPostfix,D_MemberPostfix],
    [IndexPostfix,D_IndexPostfix],
    [ArgumentsPostfix,D_ArgumentsPostfix],
    [PrefixExpression,D_PrefixExpression],
])