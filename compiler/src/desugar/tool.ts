import {
    NotPrefix,
    LogicAndExpression,
    GreaterEqualExpression,
    GreaterExpression,
    EqualExpression,
    AddressPrefix,
    ArgumentsPostfix,
    LambdaExpression, ASTTree, BooleanType, ClassType, Command,
    Expression, IdentifierExpr, InequalExpression, ListCommand, LiteralType, MemberPostfix, NullLiteral,
    NumberType,
    PostfixExpression,
    PrefixExpression,
    StringType, Throw, Type,
    LessExpression, LessEqualExpression, LogicOrExpression, BooleanLiteral
} from '../utils'

export type slang_desugar_visitor=(node:ASTTree,call:(node:ASTTree)=>ASTTree)=>ASTTree

export type loop_labels={break:string,continue:string}
//每个 File 开始时重置:同一进程里重复编译同一程序必须得到同样的标签
export let loop_context={id:0,stack:[] as loop_labels[]}
export function reset_loops(){
    loop_context.id=0
    loop_context.stack=[]
}
export function push_loop():loop_labels{
    const labels={break:`break@${loop_context.id}`,continue:`while@${loop_context.id}`}
    loop_context.id++
    loop_context.stack.push(labels)
    return labels
}
export function pop_loop(){
    loop_context.stack.pop()
}
export function current_loop():loop_labels{
    return loop_context.stack[loop_context.stack.length-1]
}
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
function is_bool_shape(expr:Expression){
    return expr instanceof EqualExpression||expr instanceof InequalExpression
        ||expr instanceof GreaterExpression||expr instanceof LessExpression
        ||expr instanceof GreaterEqualExpression||expr instanceof LessEqualExpression
        ||expr instanceof LogicAndExpression||expr instanceof LogicOrExpression
        ||expr instanceof NotPrefix||expr instanceof BooleanLiteral
}
//这条语句里(递归,但不进 lambda 体)会不会抛:if/while/for 里的 throw 也算
export function contains_throw(node:ASTTree,depth=0):boolean{
    if(node==null||typeof node!='object'||depth>20)return false
    if(node instanceof LambdaExpression)return false
    if(node instanceof Throw)return true
    if(Array.isArray(node))return node.some(i=>contains_throw(<any>i,depth+1))
    if(node instanceof Map)return [...(<any>node).values()].some(i=>contains_throw(<any>i,depth+1))
    //AST 节点的子节点在构造参数里,不在 children 上,所以按字段走
    for(const k of Object.keys(node)){
        if(k=='line'||k=='type'||k=='children')continue
        if(contains_throw((<any>node)[k],depth+1))return true
    }
    return false
}
export function no_bool_cond(expr:Expression){
    if(expr.type instanceof BooleanType||is_bool_shape(expr))
        return expr
    return new InequalExpression(expr,new NullLiteral(''))
}