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
    let i=0
    for(;i<node.opers.length;i++){
        let target=node.call_func[i]
        let oper=node.opers[i]
        let postfix=node.postfix[i]
        let type=node._type[i]
        if(oper!=''){
        }
    }
    return _node
}