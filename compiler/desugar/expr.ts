import {
    ArgumentsPostfix,
    ArrayExpression, BinaryExpression, BooleanType, Call,
    desugar_visitor,
    IndexPostfix, InequalityExpression, MemberPostfix, IdentifierExpr,
    LambdaExpression, LogicalAndExpression, LogicalOrExpression,
    MapExpression, NullLiteral,
    PostfixExpression, TernaryExpression, type_name
} from '../utils'
const D_LambdaExpression:desugar_visitor=(node:LambdaExpression,call)=>{
    node.body=call(node.body)
    return node
}
const D_ArrayExpression:desugar_visitor=(node:ArrayExpression,call)=>{
    node.elements=node.elements.map(i=>call(i))
    return node
}
const D_MapExpression:desugar_visitor=(node:MapExpression,call)=>{
    node.elements=new Map(Array.from(node.elements.entries()).map(i=>[i[0],call(i[1])]))
    return node
}
const D_PostfixExpression:desugar_visitor=(node:PostfixExpression,call)=>{
    node.expr=call(node.expr)
    for(let i of node.postfix){
        if(i instanceof IndexPostfix)
            i.index=call(i.index)
        else if(i instanceof ArgumentsPostfix)
            i.args=i.args.map(i=>call(i))
    }
    return node
}
const D_BinaryExpression:desugar_visitor=(node:BinaryExpression,call)=>{
    let left=call(node.left)
    let right=call(node.right)
    //运算符重载:check 决策命中 operation(标在 node._oper)后,把 a+b 脱糖成容器静态函数调用
    //a+b → _value_<类型名>.+(a,b);函数名=操作符原文,多签名同名=函数重载
    let oper=(node as any)._oper
    if(oper){
        let self_type=(oper as any)._value
        let cls='_value_'+type_name(self_type)
        return new PostfixExpression(new IdentifierExpr(cls),
            [new MemberPostfix(oper.oper),new ArgumentsPostfix([], [left,right])])
    }
    //缺括号:原写法 A||(B&&C&&D) 使 LogicalAndExpression 无条件包装(boolean 也被转 !=null),
    //与 LogicalOrExpression 只对非 boolean 包装的行为不对称
    if((node instanceof LogicalAndExpression||node instanceof LogicalOrExpression)&&
        !(node.right.type instanceof BooleanType)&&!(node.left.type instanceof BooleanType)){
        node.right=new InequalityExpression(node.right,new NullLiteral(''))
        node.left=new InequalityExpression(node.left,new NullLiteral(''))
        return node
    }
    return node
}
const D_TernaryExpression:desugar_visitor=(node:TernaryExpression,call)=>{
    node.condition=call(node.condition)
    node.trueExpr=call(node.trueExpr)
    node.falseExpr=call(node.falseExpr)
    return node
}
export default new Map<any,desugar_visitor>([
    [LambdaExpression,D_LambdaExpression],
    [ArrayExpression,D_ArrayExpression],
    [MapExpression,D_MapExpression],
    [PostfixExpression,D_PostfixExpression],
    [BinaryExpression,D_BinaryExpression],
    [TernaryExpression,D_TernaryExpression]
])