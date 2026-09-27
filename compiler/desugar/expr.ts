import {addFix, address, desugar_cast, desugar_oper, LiteralToConst, slang_desugar_visitor} from './tool'
import {
    AAssign,
    AddAssign, AdditiveExpression,
    AddressPrefix,
    ArgumentsPostfix,
    ArrayExpression, Assign, BinaryExpression, BitAndAssign, BitOrAssign, BitShlAssign, BitShrAssign,
    BitwiseAndExpression, BitwiseOrExpression, BitwiseXorExpression, BitXorAssign, Class, ClassType, Expression,
    IdentifierExpr, IndexPostfix,
    LambdaExpression,
    LiteralType,
    MapExpression, MemberPostfix, ModAssign, Modifier, MulAssign, MultiplicativeExpression, NumberLiteral, Postfix,
    PostfixExpression, PrefixExpression, ShiftLeftExpression,
    ShiftRightExpression, SubAssign, SubtractiveExpression, TernaryExpression,
    Type
} from '../utils'
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
        const postfix:Postfix=node.postfix[i]
        if(postfix instanceof IndexPostfix)postfix.index=call(postfix.index)
        if(postfix instanceof ArgumentsPostfix)postfix.args=postfix.args.map(call)
        if(oper!=null&&oper!=''){
            let param:Expression[]=[]
            //是++/--,直接整个套入
            if(oper.startsWith('++')||oper.startsWith('--'))
                //postfix++/--和prefix的区分,最后加一个无意义的number
                param=[_node,new NumberLiteral('0')]
            //[i]形式
            if(oper.startsWith('[]'))
                param=[_node,(postfix as IndexPostfix).index]
            //()形式
            if(oper.startsWith('()'))
                param=[_node,...(postfix as ArgumentsPostfix).args]
            return desugar_oper(oper,...param)
        }
        else if(cast!=null) _node=desugar_cast(cast,_node,postfix)
        else if(target!=null&&target!=''){
            //_node的最后一个member改成target
            (<PostfixExpression>_node).postfix[(<PostfixExpression>_node).postfix.length-1]=new MemberPostfix(target);
            (<PostfixExpression>_node).postfix.push(postfix)
        }
        else _node=addFix(_node,postfix)
    }
    return _node
}
const D_PrefixExpression:slang_desugar_visitor=(node:PrefixExpression,call)=>{
    node.expr=call(node.expr)
    let _node=node.expr
    //祖传脱糖
    for(let i=0;i<node.opers.length;i++){
        const oper=node.opers[i]
        const cast=node.casts[i]
        const prefix=node.prefix[i]
        if(oper!=null&&oper!='')return desugar_oper(oper,_node)
        if(cast!=null)return desugar_cast(cast,_node,prefix)
        else _node=addFix(_node,prefix)
    }
    return _node
}
const D_BinaryExpression:slang_desugar_visitor=(node:BinaryExpression,call)=>{
    node.left=call(node.left)
    node.right=call(node.right)
    if(node.oper!=null&&node.oper!='')
        return desugar_oper(node.oper,node.left,node.right)
    return node
}
const D_TernaryExpression:slang_desugar_visitor=(node:TernaryExpression,call)=>{
    node.condition=call(node.condition)
    node.trueExpr=call(node.trueExpr)
    node.falseExpr=call(node.falseExpr)
    return node
}
export default new Map<any,slang_desugar_visitor>([
    [ArrayExpression,D_ArrayOrMapExpression],
    [MapExpression,D_ArrayOrMapExpression],
    [LambdaExpression,D_LambdaExpression],
    [PostfixExpression,D_PostfixExpression],
    [PrefixExpression,D_PrefixExpression],
    [BinaryExpression,D_BinaryExpression],
    [TernaryExpression,D_TernaryExpression]
])