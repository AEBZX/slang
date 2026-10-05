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
    Type, IncrementPostfix, IncrementPrefix, DecrementPostfix, DecrementPrefix, ReferencePrefix
} from '../utils'
import {slang_check_visitor} from "../check/tool";
const D_ArrayOrMapExpression:slang_desugar_visitor=(node:MapExpression|ArrayExpression,call)=>{
    if(node instanceof ArrayExpression)node.elements=node.elements.map(call) as Expression[]
    if(node instanceof MapExpression)node.elements.forEach(i=>i=call(i) as Expression)
    return node
}
const D_LambdaExpression:slang_desugar_visitor=(node:LambdaExpression,call)=>{
    node.body=call(node.body)
    return node
}
const D_IncrementOrDecrementPostfixOrPrefix:slang_desugar_visitor=(node:IncrementPostfix|IncrementPrefix|DecrementPostfix|DecrementPrefix,call)=>{
    node.expr=call(node.expr) as Expression
    expr_desugar(node,node.expr)
    return node
}
const D_MemberPostfix:slang_desugar_visitor=(node:MemberPostfix,call)=>{
    node.expr=call(node.expr) as Expression
    expr_desugar(node,node.expr)
    return node
}
const D_IndexPostfix:slang_desugar_visitor=(node:IndexPostfix,call)=>{
    node.expr=call(node.expr) as Expression
    node.index=call(node.index) as Expression
    expr_desugar(node,node.expr,node.index)
    return node
}
const D_ArgumentsPostfix:slang_desugar_visitor=(node:ArgumentsPostfix,call)=>{
    node.expr=call(node.expr) as Expression
    node.args=node.args.map(call) as Expression[]
    expr_desugar(node,node.expr,...node.args)
    return node
}
const D_PrefixExpression:slang_desugar_visitor=(node:PrefixExpression,call)=>{
    node.expr=call(node.expr) as Expression
    expr_desugar(node,node.expr)
    return node
}
const D_BinaryExpression:slang_desugar_visitor=(node:BinaryExpression,call)=>{
    node.left=call(node.left) as Expression
    node.right=call(node.right) as Expression
    expr_desugar(node,node.left,node.right)
    return node
}
const D_TernaryExpression:slang_desugar_visitor=(node:TernaryExpression,call)=>{
    node.condition=call(node.condition) as Expression
    node.trueExpr=call(node.trueExpr) as Expression
    node.falseExpr=call(node.falseExpr) as Expression
    expr_desugar(node)
    return node
}
export default new Map<any,slang_desugar_visitor>([
    [ArrayExpression,D_ArrayOrMapExpression],
    [MapExpression,D_ArrayOrMapExpression],
    [LambdaExpression,D_LambdaExpression],
    [BinaryExpression,D_BinaryExpression],
    [TernaryExpression,D_TernaryExpression]
])