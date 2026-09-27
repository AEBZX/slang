import {slang_desugar_visitor} from './tool'
import {ArrayExpression, LambdaExpression, MapExpression, PostfixExpression} from '../utils'
const D_ArrayOrMapExpression:slang_desugar_visitor=(node:MapExpression|ArrayExpression,call)=>{
    if(node instanceof ArrayExpression)node.elements=node.elements.map(call)
    if(node instanceof MapExpression)node.elements.forEach(i=>i=call(i))
    return node
}
const D_LambdaExpression:slang_desugar_visitor=(node:LambdaExpression,call)=>{
    node.body=call(node.body)
    return node
}
const D_PostfixExpression:slang_desugar_visitor=(node:PostfixExpression,call)=>{
    node.expr=call(node.expr)
    let _node=node.expr
    //fix脱糖
    for(let i=0;i<node.opers.length;i++){
        const oper=node.opers[i]
        const target=node.call_targets[i]
        const cast=node.casts[i]
    }
    return _node
}