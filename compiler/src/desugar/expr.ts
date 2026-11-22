import {char_to_number, de_cast, de_operation, de_ref, slang_desugar_visitor} from './tool'
import {
    AddressPrefix, ArgumentsPostfix,
    ArrayExpression,
    ArrayType, BinaryExpression, BitNotPrefix,
    BooleanLiteral, ClassType, Command, convert, DecrementPostfix, DecrementPrefix,
    Expression, IdentifierExpr, IncrementPostfix, IncrementPrefix, IndexPostfix, LambdaExpression, MemberPostfix,
    MinusPrefix, NewPrefix,
    NotPrefix,
    NullLiteral,
    NumberLiteral,
    NumberType, PointType, PrefixExpression, ReferencePrefix, ReferenceType,
    StringLiteral, TernaryExpression
} from '../utils'

const D_Number:slang_desugar_visitor=(node:NumberLiteral,call)=>{
    if(node.cast!=null)return call(de_cast(node.cast,node))
    const num=convert(node.value)
    if(typeof num=='string')
        return new NumberLiteral(num)
    return new ArrayExpression(num.map(i=>new ArrayExpression(i.map(j=>new NumberLiteral(j)))))
}
const D_String:slang_desugar_visitor=(node:StringLiteral,call)=>{
    if(node.cast!=null)return call(de_cast(node.cast,node))
    if(node.value.length==1)return new NumberLiteral(char_to_number(node.value)+'')
    if(node.value.length==0)return new NullLiteral(null)
    return call(new ArrayExpression(node.value.split('').map(i=>new NumberLiteral(char_to_number(i)+''))))
}
const D_Boolean:slang_desugar_visitor=(node:BooleanLiteral,call)=>{
    if(node.cast)return call(de_cast(node.cast,node))
    return new NumberLiteral(node.value=='true'?'1':'0')
}
const D_IdentifierExpr:slang_desugar_visitor=(node:IdentifierExpr,call)=>{
    return de_ref(<Expression>call(de_cast(node.cast, node)))
}
const D_Array:slang_desugar_visitor=(node:ArrayExpression,call)=> {
    node.elements = node.elements.map(call) as Expression[]
    return node
}
const D_Lambda:slang_desugar_visitor=(node:LambdaExpression,call)=>{
    node.body=call(node.body) as Command
    return de_ref(<Expression>call(de_cast(node.cast,node)))
}
const D_Inc_Dec:slang_desugar_visitor=(node:IncrementPostfix|DecrementPostfix,call)=>{
    node.expr=call(node.expr) as Expression
    node=de_operation(node,node instanceof IncrementPostfix?'++':'--',node.expr) as any
    return de_ref(<Expression>call(de_cast(node.cast,node)))
}
const D_Member:slang_desugar_visitor=(node:MemberPostfix,call)=>{
    node.expr=call(node.expr) as Expression
    return de_ref(<Expression>call(de_cast(node.cast,node)))
}
const D_Index:slang_desugar_visitor=(node:IndexPostfix,call)=>{
    node.expr=call(node.expr) as Expression
    node.index=call(node.index) as Expression
    node=de_operation(node,'[]',node.expr,node.index) as any
    return de_ref(<Expression>call(de_cast(node.cast,node)))
}
const D_Arguments:slang_desugar_visitor=(node:ArgumentsPostfix,call)=>{
    node.expr=call(node.expr) as Expression
    node.args=node.args.map(call) as Expression[]
    if(node.oper!=null)
        return de_ref(<Expression>call(de_cast(node.cast,de_operation(node,node.oper,node.expr,...node.args))))
    //call_target检查
    if(node.call_target!=null){
        //call_target必定是函数调用,node.expr是Identifier/Member,替换为call_target
        if(node.expr instanceof IdentifierExpr)node.expr=new IdentifierExpr(node.call_target)
        if(node.expr instanceof MemberPostfix)node.expr.name=node.call_target
    }
    //把调用者传进去,如果是this调用就充当this,已经deref过不需要重复
    if(node.expr instanceof MemberPostfix&&node.expr.expr.type instanceof ClassType)
        node.args.push(node.expr.expr)
}
const D_Prefix:slang_desugar_visitor=(node:PrefixExpression,call)=>{
    let oper=null
    if(node instanceof IncrementPrefix)oper='++'
    if(node instanceof DecrementPrefix)oper='--'
    if(node instanceof NotPrefix)oper='!'
    if(node instanceof BitNotPrefix)oper='~'
    if(node instanceof MinusPrefix)oper='-'
    if(node instanceof ReferencePrefix)oper='&'
    if(node instanceof AddressPrefix)oper='*'
    if(node instanceof NewPrefix)oper='new'
    node.expr=call(node.expr) as Expression
    node=de_operation(node,oper,node.expr) as any
    if(node instanceof NewPrefix)node=node.expr as any
    return de_ref(<Expression>call(de_cast(node.cast,node)))
}
const D_Binary:slang_desugar_visitor=(node:BinaryExpression,call)=>{
    node.left=call(node.left) as Expression
    node.right=call(node.right) as Expression
    node=de_operation(node,node.oper,node.left,node.right) as any
    return de_ref(<Expression>call(de_cast(node.cast,node)))
}
const D_Ternary:slang_desugar_visitor=(node:TernaryExpression,call)=>{
    node.condition=call(node.condition) as Expression
    node.trueExpr=call(node.trueExpr) as Expression
    node.falseExpr=call(node.falseExpr) as Expression
    return de_ref(<Expression>call(de_cast(node.cast,node)))
}
export default new Map<any,slang_desugar_visitor>([
    [NumberLiteral,D_Number],
    [StringLiteral,D_String],
    [BooleanLiteral,D_Boolean],
    [IdentifierExpr,D_IdentifierExpr],
    [ArrayExpression,D_Array],
    [LambdaExpression,D_Lambda],
    [IncrementPostfix,D_Inc_Dec],
    [DecrementPostfix,D_Inc_Dec],
    [MemberPostfix,D_Member],
    [ArgumentsPostfix,D_Arguments],
    [IndexPostfix,D_Index],
    [IncrementPrefix,D_Prefix],
    [DecrementPrefix,D_Prefix],
    [NotPrefix,D_Prefix],
    [BitNotPrefix,D_Prefix],
    [MinusPrefix,D_Prefix],
    [ReferencePrefix,D_Prefix],
    [AddressPrefix,D_Prefix],
    [NewPrefix,D_Prefix],
    [BinaryExpression,D_Binary],
    [TernaryExpression,D_Ternary]
])