import {
    ArgumentsPostfix,
    ArrayExpression, BinaryExpression,
    desugar_visitor,
    IndexPostfix,
    LambdaExpression,
    MapExpression,
    PostfixExpression, TernaryExpression
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
    node.left=call(node.left)
    node.right=call(node.right)
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