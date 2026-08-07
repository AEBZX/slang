import {
    AdditiveExpression,
    AddressPrefix,
    ArgumentsPostfix,
    ArrayExpression, BinaryExpression, BitNotPrefix, BitwiseAndExpression, BitwiseOrExpression, BitwiseXorExpression,
    BooleanLiteral, DecrementPostfix, DecrementPrefix, DivisionExpression, EqualityExpression, GreaterEqualExpression,
    GreaterExpression, HAddressExpr, HArgumentsExpr, HArrayExpr,
    HBinaryExpr, HBitNotExpr,
    HBooleanLiteral, HExpr, HIdentifierExpr, HIndexExpr,
    hir_visitor, HLambdaExpr, HMapExpr, HMemberExpr, HMinusExpr, HNotExpr, HNullLiteral,
    HNumberLiteral, HPostDecrementExpr, HPostIncrementExpr, HPreDecrementExpr, HPreIncrementExpr, HReferenceExpr,
    HStringLiteral, HTernaryExpr, IdentifierExpr,
    IncrementPostfix, IncrementPrefix, IndexPostfix,
    InequalityExpression, LambdaExpression,
    LessEqualExpression, LessExpression,
    LogicalAndExpression, LogicalOrExpression, MapExpression, MemberPostfix, MinusPrefix,
    ModExpression, MultiplicativeExpression,
    NewPrefix,
    NotPrefix, NullLiteral,
    NumberLiteral,
    Postfix, PostfixExpression, PrefixExpression, ReferencePrefix, ShiftLeftExpression, ShiftRightExpression,
    StringLiteral, SubtractiveExpression, TernaryExpression
} from '../utils'
const H_NumberLiteral:hir_visitor=(node:NumberLiteral,scope,call)=>new HNumberLiteral(parseFloat(node.value))
const H_StringLiteral:hir_visitor=(node:StringLiteral,scope,call)=>new HStringLiteral(node.value.substring(1,node.value.length-1))
const H_BooleanLiteral:hir_visitor=(node:BooleanLiteral,scope,call)=>new HBooleanLiteral(node.value=='true')
const H_NullLiteral:hir_visitor=(node:NullLiteral,scope,call)=>new HNullLiteral()
const H_IdentifierExpr:hir_visitor=(node:IdentifierExpr,scope,call)=>{
    let name=scope.get(node.name)
    if(scope.get(node.name))
        name=scope.lnk_get(name)
    return new HIdentifierExpr(name)
}
const H_ArrayExpr:hir_visitor=(node:ArrayExpression,scope,call)=>new HArrayExpr(node.elements.map(i=>call(i)))
const H_MapExpr:hir_visitor=(node:MapExpression,scope,call)=>new HMapExpr(new Map(Array.from(node.elements.entries()).map(i=>[i[0],call(i[1])])))
const H_LambdaExpr:hir_visitor=(node:LambdaExpression,scope,call)=>new HLambdaExpr(Array.from(node.params.entries()).map(i=>scope.id()),call(node.body))
const H_PostfixExpr:hir_visitor=(node:PostfixExpression,scope,call)=>{
    let _primary=node.expr
    //如果primary是identifier,那么尽量的匹配足够多的Member作为一整个Identifier
    if(_primary instanceof IdentifierExpr){
        let g=(a:IdentifierExpr,fix:Postfix):IdentifierExpr=>{
            if(fix instanceof MemberPostfix)
                return new IdentifierExpr(a.name+'.'+fix.name)
            return a
        }
        let delete_index:number=node.postfix.length
        for(let i=0;i<node.postfix.length;i++)
            if(g(<IdentifierExpr>_primary,node.postfix[i])!=_primary){
                _primary=g(<IdentifierExpr>_primary,node.postfix[i])
                delete_index=i
            }
        //去掉
        node.postfix=node.postfix.slice(delete_index)
    }
    let primary=call(_primary)
    for(let i of node.postfix){
        if(i instanceof IndexPostfix)
            primary=new HIndexExpr(primary,call(i.index))
        if(i instanceof ArgumentsPostfix)
            primary=new HArgumentsExpr(primary,i.args.map(i=>call(i)))
        if(i instanceof MemberPostfix)
            primary=new HMemberExpr(primary,new HIdentifierExpr(scope.get(i.name)))
        if(i instanceof IncrementPostfix)
            primary=new HPostIncrementExpr(primary)
        if(i instanceof DecrementPostfix)
            primary=new HPostDecrementExpr(primary)
    }
    return primary
}
const H_PrefixExpr:hir_visitor=(node:PrefixExpression,scope,call)=>{
    let primary=call(node.expr)
    for(let i of node.prefix){
        if(i instanceof IncrementPrefix)
            primary=new HPreIncrementExpr(primary)
        if(i instanceof DecrementPrefix)
            primary=new HPreDecrementExpr(primary)
        if(i instanceof NotPrefix)
            primary=new HNotExpr(primary)
        if(i instanceof BitNotPrefix)
            primary=new HBitNotExpr(primary)
        if(i instanceof MinusPrefix)
            primary=new HMinusExpr(primary)
        if(i instanceof ReferencePrefix)
            primary=new HReferenceExpr(primary)
        if(i instanceof AddressPrefix)
            primary=new HAddressExpr(primary)
        //忽略NewPrefix
    }
    return primary
}
const H_BinaryExpr:hir_visitor=(node:BinaryExpression,scope,call)=>{
    switch (node.constructor) {
        case AdditiveExpression:
            return new HBinaryExpr(call(node.left),'+',call(node.right))
        case SubtractiveExpression:
            return new HBinaryExpr(call(node.left),'-',call(node.right))
        case MultiplicativeExpression:
            return new HBinaryExpr(call(node.left),'*',call(node.right))
        case ModExpression:
            return new HBinaryExpr(call(node.left),'%',call(node.right))
        case DivisionExpression:
            return new HBinaryExpr(call(node.left),'/',call(node.right))
        case ShiftLeftExpression:
            return new HBinaryExpr(call(node.left),'<<',call(node.right))
        case ShiftRightExpression:
            return new HBinaryExpr(call(node.left),'>>',call(node.right))
        case GreaterExpression:
            return new HBinaryExpr(call(node.left),'>',call(node.right))
        case LessExpression:
            return new HBinaryExpr(call(node.left),'<',call(node.right))
        case GreaterEqualExpression:
            return new HBinaryExpr(call(node.left),'>=',call(node.right))
        case LessEqualExpression:
            return new HBinaryExpr(call(node.left),'<=',call(node.right))
        case EqualityExpression:
            return new HBinaryExpr(call(node.left),'==',call(node.right))
        case InequalityExpression:
            return new HBinaryExpr(call(node.left),'!=',call(node.right))
        case BitwiseAndExpression:
            return new HBinaryExpr(call(node.left),'&',call(node.right))
        case BitwiseOrExpression:
            return new HBinaryExpr(call(node.left),'|',call(node.right))
        case BitwiseXorExpression:
            return new HBinaryExpr(call(node.left),'^',call(node.right))
        case LogicalOrExpression:
            return new HBinaryExpr(call(node.left),'||',call(node.right))
        case LogicalAndExpression:
            return new HBinaryExpr(call(node.left),'&&',call(node.right))
    }
}
const H_TernaryExpr:hir_visitor=(node:TernaryExpression,scope,call)=>{
    return new HTernaryExpr(call(node.condition),call(node.trueExpr),call(node.falseExpr))
}
export default new Map<any,hir_visitor>([
    [NullLiteral,H_NullLiteral],
    [IdentifierExpr,H_IdentifierExpr],
    [ArrayExpression,H_ArrayExpr],
    [MapExpression,H_MapExpr],
    [LambdaExpression,H_LambdaExpr],
    [PostfixExpression,H_PostfixExpr],
    [PrefixExpression,H_PrefixExpr],
    [BinaryExpression,H_BinaryExpr],
    [TernaryExpression,H_TernaryExpr],
    [StringLiteral,H_StringLiteral],
    [NumberLiteral,H_NumberLiteral],
    [BooleanLiteral,H_BooleanLiteral]
])