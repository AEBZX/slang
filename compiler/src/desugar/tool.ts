import {
    ArgumentsPostfix,
    ASTTree,
    BinaryExpression,
    BooleanType,
    Expression,
    IdentifierExpr, InequalExpression,
    MemberPostfix, NullLiteral
} from '../utils'
export type slang_desugar_visitor=(node:ASTTree,call:(node:ASTTree)=>ASTTree)=>ASTTree
export function de_operation(oper:string,...param:Expression[]){
    if(oper==null)return param[0]
    let ret:Expression=null
    for(const i of oper.split('.')){
        if(ret==null)ret=new IdentifierExpr(i)
        else ret=new MemberPostfix(ret,i)
    }
    return new ArgumentsPostfix(ret,[],param)
}
export function de_cast(cast:string,data:Expression){
    if(cast==null)return null
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