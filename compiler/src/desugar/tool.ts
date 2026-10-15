import {
    AddressPrefix,
    ArgumentsPostfix,
    ASTTree, BooleanType, ClassType, Command,
    Expression, IdentifierExpr, InequalExpression, ListCommand, LiteralType, MemberPostfix, NullLiteral,
    NumberType,
    PostfixExpression,
    PrefixExpression,
    StringType, Throw, Type
} from '../utils'

export type slang_desugar_visitor=(node:ASTTree,call:(node:ASTTree)=>ASTTree)=>ASTTree
export const LiteralToConst=new Map<any,string>([
    [NumberType,'number'],
    [StringType,'string'],
    [BooleanType,'boolean']
])
export function desugar_cast(cast:string,data:Expression){
    let expr=null
    for(const i of cast.split('.'))
        expr=expr==null?new IdentifierExpr(i):new MemberPostfix(expr,i)
    return new ArgumentsPostfix(expr,[],[data])
}
export function desugar_oper(oper:string,...param:Expression[]){
    let expr=null
    for(const i of oper.split('.'))
        expr=expr==null?new IdentifierExpr(i):new MemberPostfix(expr,i)
    return new ArgumentsPostfix(expr,[],param.map(address))
}
export function expr_desugar(node:Expression,...param:Expression[]){
    if(node.oper!=null&&node.oper!='')
        return desugar_oper(node.oper,...param)||node
    if(node.cast!=null&&node.cast!='')
        return desugar_cast(node.cast,node)||node
    //普通节点:无 oper/cast 也要回落原节点,返回 undefined 会毁掉整棵树
    return node
}
export function address(expr:Expression){
    return new AddressPrefix(expr)
}
export function no_bool_cond(expr:Expression){
    if(!(expr.type instanceof BooleanType))
        return new InequalExpression(expr,new NullLiteral(''))
    return expr
}