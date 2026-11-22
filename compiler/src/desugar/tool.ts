import {
    ArgumentsPostfix,
    ASTTree,
    BinaryExpression,
    BooleanType,
    Expression,
    IdentifierExpr, InequalExpression,
    MemberPostfix, NullLiteral, ReferencePrefix, ReferenceType
} from '../utils'
export type slang_desugar_visitor=(node:ASTTree,call:(node:ASTTree)=>ASTTree)=>ASTTree
export function de_operation(ast:ASTTree,oper:string,...param:Expression[]){
    param=param.map(de_ref)
    if(oper==null)return ast
    let ret:Expression=null
    for(const i of oper.split('.')){
        if(ret==null)ret=new IdentifierExpr(i)
        else ret=new MemberPostfix(ret,i)
    }
    return new ArgumentsPostfix(ret,[],param)
}
export function de_cast(cast:string,data:Expression){
    if(cast==null)return data
    let ret:Expression=null
    for(const i of cast.split('.')){
        if(ret==null)ret=new IdentifierExpr(i)
        else ret=new MemberPostfix(ret,i)
    }
    return new ArgumentsPostfix(ret,[],[data])
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
//引用本质就是取地址,除了identifier,index,member,其他都是指针实现
//非'identifier'引用返回的都是地址,需要解引用,如果是引用值初始化,return就不需要操作
export function de_ref(expr:Expression){
    if(!(expr.type instanceof ReferenceType))return expr
    if(expr.type.literal=='identifier')return expr
    let ret=new ReferencePrefix(expr)
    ret.type=expr.type
    return ret
}