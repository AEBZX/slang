import {
    AddressPrefix,
    ArgumentsPostfix,
    ASTTree, BooleanType, ClassType, Command,
    Expression, IdentifierExpr, InequalityExpression, ListCommand, LiteralType, MemberPostfix, NullLiteral,
    NumberType,
    Postfix,
    PostfixExpression,
    Prefix,
    PrefixExpression,
    StringType, Throw, Type
} from '../utils'

export type slang_desugar_visitor=(node:ASTTree,call:(node:ASTTree)=>ASTTree)=>ASTTree
export function addFix(node:Expression,...fix:Prefix[]|Postfix[]){
    if(node instanceof PostfixExpression&&fix[0] instanceof Postfix){
        node.postfix.push(fix)
        return node
    }
    if(node instanceof PrefixExpression&&fix[0] instanceof Prefix){
        node.prefix.push(fix)
        return node
    }
    if(fix[0] instanceof Prefix)return new PrefixExpression(node,fix)
    if(fix[0] instanceof Postfix)return new PostfixExpression(node,fix)
}
export const LiteralToConst=new Map<any,string>([
    [NumberType,'number'],
    [StringType,'string'],
    [BooleanType,'boolean']
])
export function desugar_cast(cast:string,data:Expression,append:Postfix){
    let _postfix=[]
    let member=cast.split('.').map(i=>new MemberPostfix(i))
    const call_iden=member[0].name
    member.pop()
    _postfix.push(member)
    _postfix.push(new ArgumentsPostfix(null,[data]))
    _postfix.push(append)
    return new PostfixExpression(new IdentifierExpr(call_iden),_postfix)
}
export function desugar_oper(oper:string,...param:Expression[]){
    let _postfix=[]
    let member=oper.split('.').map(i=>new MemberPostfix(i))
    const call_iden=member[0].name
    member.pop()
    _postfix.push(member)
    _postfix.push(new ArgumentsPostfix(null,param.map(address)))
    return new PostfixExpression(new IdentifierExpr(call_iden),_postfix)
}
export function address(expr:Expression){
    return addFix(expr,new AddressPrefix())
}
export function no_bool_cond(expr:Expression){
    if(!(expr.type instanceof BooleanType))
        return new InequalityExpression(expr,new NullLiteral(''))
    return expr
}