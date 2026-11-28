import {
    ArgumentsPostfix, Assign,
    ASTTree,
    BinaryExpression,
    BooleanType,
    Expression,
    IdentifierExpr, InequalExpression, LiteralType,
    MemberPostfix, NullLiteral, NumberType, ReferencePrefix, ReferenceType, Type, VarDecl
} from '../utils'
export type slang_desugar_visitor=(node:ASTTree,call:(node:ASTTree)=>ASTTree)=>ASTTree
export function de_operation(ast:VarDecl|Assign|Expression,expr:Expression,oper:string,...param:Expression[]){
    param=param.map(de_ref)
    if(oper==null)return ast
    const type=type_view(expr.type)
    ast.oper=null
    if(type instanceof LiteralType)
        //number等就是调用value里的静态函数
        return new ArgumentsPostfix(new MemberPostfix(new IdentifierExpr(
            type instanceof NumberType?'number':'boolean'
        ),oper),[],[expr,...param])
    //class就是调用内部函数
    return new ArgumentsPostfix(new MemberPostfix(expr,oper),[],param)
}
export function de_cast(cast:string,data:Expression){
    if(cast==null)return data
    data.cast=null
    const type=type_view(data.type)
    if(type instanceof LiteralType)
        return new ArgumentsPostfix(new MemberPostfix(new IdentifierExpr(
            type instanceof NumberType?'number':'boolean'
        ),cast),[],[data])
    return new ArgumentsPostfix(new MemberPostfix(data,cast),[],[])
}
export function de_cond(data:Expression){
    if(data.type instanceof BooleanType)return data
    return new InequalExpression(data,new NullLiteral(''))
}
export function char_to_number(data:string){
    const bytes = new TextEncoder().encode(data)
    let n = 0
    for (const b of bytes) n = n * 256 + b
    return n
}
export function type_view(type:Type){
    if(type instanceof ReferenceType)return type_view(type.t)
    return type
}
//引用本质就是取地址,除了identifier,index,member,其他都是指针实现
//非'identifier'引用返回的都是地址,需要解引用,如果是引用值初始化,return就不需要操作
export function de_ref(expr:Expression){
    if(!(expr.type instanceof ReferenceType))return expr
    if(expr.type.literal=='identifier')return expr
    let ret=new ReferencePrefix(expr)
    ret.type=expr.type
    return ret
}