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
    //link别名走lnk表,普通变量无lnk则保留自身id
    let linked=name!=null?scope.lnk_get(name):null
    if(linked!=null)name=linked
    return new HIdentifierExpr(name)
}
const H_ArrayExpr:hir_visitor=(node:ArrayExpression,scope,call)=>new HArrayExpr(node.elements.map(i=>call(i,scope)))
const H_MapExpr:hir_visitor=(node:MapExpression,scope,call)=>new HMapExpr(new Map(Array.from(node.elements.entries()).map(i=>[i[0],call(i[1],scope)])))
const H_LambdaExpr:hir_visitor=(node:LambdaExpression,scope,call)=>{
    scope=scope.enter()
    let params=Array.from(node.params.entries()).map(i=>{
        //this参数复用类作用域已分配的this_id,保持成员内this与类实例一致
        let id=i[0]=='this'&&scope.get('this')!=null?scope.get('this'):scope.id()
        scope.set(i[0],id)
        return id
    })
    let cmd=call(node.body,scope)
    scope=scope.leave()
    return new HLambdaExpr(params,cmd)
}
const H_PostfixExpr:hir_visitor=(node:PostfixExpression,scope,call)=>{
    let _primary=node.expr
    //如果primary是identifier,那么尽量的匹配足够多的Member作为一整个Identifier
    if(_primary instanceof IdentifierExpr){
        let g=(a:IdentifierExpr,fix:Postfix):IdentifierExpr=>{
            if(fix instanceof MemberPostfix)
                return new IdentifierExpr(a.name+'.'+fix.name)
            return a
        }
        let delete_index:number=0
        for(let i=0;i<node.postfix.length;i++)
            if(g(<IdentifierExpr>_primary,node.postfix[i])!=_primary){
                _primary=g(<IdentifierExpr>_primary,node.postfix[i])
                delete_index=i+1
            }else
                break
        //去掉已折叠的Member,保留Arguments/Index等
        node.postfix=node.postfix.slice(delete_index)
    }
    let primary=call(_primary,scope)
    for(let i of node.postfix){
        if(i instanceof IndexPostfix)
            primary=new HIndexExpr(primary,call(i.index,scope))
        if(i instanceof ArgumentsPostfix)
            primary=new HArgumentsExpr(primary,i.args.map(i=>call(i,scope)))
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
    let primary=call(node.expr,scope)
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
            return new HBinaryExpr(call(node.left,scope),'+',call(node.right,scope))
        case SubtractiveExpression:
            return new HBinaryExpr(call(node.left,scope),'-',call(node.right,scope))
        case MultiplicativeExpression:
            return new HBinaryExpr(call(node.left,scope),'*',call(node.right,scope))
        case ModExpression:
            return new HBinaryExpr(call(node.left,scope),'%',call(node.right,scope))
        case DivisionExpression:
            return new HBinaryExpr(call(node.left,scope),'/',call(node.right,scope))
        case ShiftLeftExpression:
            return new HBinaryExpr(call(node.left,scope),'<<',call(node.right,scope))
        case ShiftRightExpression:
            return new HBinaryExpr(call(node.left,scope),'>>',call(node.right,scope))
        case GreaterExpression:
            return new HBinaryExpr(call(node.left,scope),'>',call(node.right,scope))
        case LessExpression:
            return new HBinaryExpr(call(node.left,scope),'<',call(node.right,scope))
        case GreaterEqualExpression:
            return new HBinaryExpr(call(node.left,scope),'>=',call(node.right,scope))
        case LessEqualExpression:
            return new HBinaryExpr(call(node.left,scope),'<=',call(node.right,scope))
        case EqualityExpression:
            return new HBinaryExpr(call(node.left,scope),'==',call(node.right,scope))
        case InequalityExpression:
            return new HBinaryExpr(call(node.left,scope),'!=',call(node.right,scope))
        case BitwiseAndExpression:
            return new HBinaryExpr(call(node.left,scope),'&',call(node.right,scope))
        case BitwiseOrExpression:
            return new HBinaryExpr(call(node.left,scope),'|',call(node.right,scope))
        case BitwiseXorExpression:
            return new HBinaryExpr(call(node.left,scope),'^',call(node.right,scope))
        case LogicalOrExpression:
            return new HBinaryExpr(call(node.left,scope),'||',call(node.right,scope))
        case LogicalAndExpression:
            return new HBinaryExpr(call(node.left,scope),'&&',call(node.right,scope))
    }
}
const H_TernaryExpr:hir_visitor=(node:TernaryExpression,scope,call)=>{
    return new HTernaryExpr(call(node.condition,scope),call(node.trueExpr,scope),call(node.falseExpr,scope))
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