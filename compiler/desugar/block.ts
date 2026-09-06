import {
    Block,
    BlockType,
    Cast,
    Class,
    ClassType,
    desugar_visitor,
    Enum,
    File,
    LambdaType,
    Modifier,
    Module,
    NumberLiteral,
    Operation,
    Variable,
    Function, LambdaExpression, NullLiteral, Value, type_name
} from '../utils'

const D_Module:desugar_visitor=(node:Module,call)=>{
    node.children=node.children.map(i=>call(i)) as Block[]
    return node
}
const D_Class:desugar_visitor=(node:Class,call)=>{
    for(let i of node.children)
        if(i instanceof Function&&i.modifiers.unstatic&&i.name!='constructor'&&!i.params.has('this'))
            i.params=new Map([['this',new ClassType((node.type as any).local,[])],...i.params])
    node.children=node.children.map(i=>call(i)) as Block[]
    return node
}
const D_File:desugar_visitor=(node:File,call)=>{
    node.children=node.children.map(i=>call(i)) as Block[]
    return node
}
const D_Enum:desugar_visitor=(node:Enum,call)=>{
    let index=0
    let cls=new Class(node.modifiers, node.name,new Map(), new ClassType(['std','ObjectInterface'],[]), node.children.map(i =>
        new Variable(new Modifier(false, false, false), i, node.type, new NumberLiteral(`${index++}`))
    ))
    cls.type=node.type
    return call(cls)
}
const D_Function:desugar_visitor=(node:Function,call)=>{
    //函数重载:同名第 index 个(index>0)改为 原名+序号,避免与代表函数槽位冲突
    let name=node.index>0?node.name+node.index:node.name
    let ret=new Variable(node.modifiers, name,
        new LambdaType(new Map(),node.params, node.return_type,node.modifiers._async),
        new LambdaExpression(new Map(),node.params, node.return_type, node.commands))
    ret.type=node.type
    return call(ret)
}
const D_Variable:desugar_visitor=(node:Variable,call)=>{
    node.value=node.value==null?new NullLiteral(''):call(node.value)
    return node
}
//value 块 → 类:value 是给字面类型(内建)扩展 operation/cast 的容器,
//脱糖成静态容器类 _value_<类型名>,内部 operation/cast 为静态函数成员
//(check 阶段 value 不进符号表,块 id/路径在此由 desugar 命名)
const D_Value:desugar_visitor=(node:Value,call)=>{
    let type=node.value
    let name='_value_'+type_name(type)
    //把所属字面类型传给 operation/cast,供生成完整块路径
    for(let i of node.children)
        (i as any)._value=type
    let children=node.children.map(i=>call(i)) as Block[]
    let cls=new Class(null,name,new Map(),new ClassType(['std','ObjectInterface'],[]),children)
    cls.type=new BlockType([name])
    return cls
}
//operation 符号 lambda → 静态 Variable:方法名=操作符原文(如 '+','[]'),
//同操作符多签名=函数重载;名字不用语义映射(add/sub 会与用户方法撞名)
const D_Operation:desugar_visitor=(node:Operation,call)=>{
    let body=call(node.command) as LambdaExpression
    let ret=new Variable(new Modifier(false,false,false),node.oper,
        new LambdaType(body.generic,body.params,body.ret,false),body)
    ret.type=new BlockType(['_value_'+type_name((node as any)._value),node.oper])
    return ret
}
//cast 类型 lambda → 静态 Variable:方法名=目标类型名
const D_Cast:desugar_visitor=(node:Cast,call)=>{
    let body=call(node.command) as LambdaExpression
    let ret=new Variable(new Modifier(false,false,false),type_name(node.t),
        new LambdaType(body.generic,body.params,body.ret,false),body)
    ret.type=new BlockType(['_value_'+type_name((node as any)._value),type_name(node.t)])
    return ret
}
export default new Map<any,desugar_visitor>([
    [File,D_File],
    [Module,D_Module],
    [Class,D_Class],
    [Enum,D_Enum],
    [Function,D_Function],
    [Variable,D_Variable],
    [Value,D_Value],
    [Operation,D_Operation],
    [Cast,D_Cast],
])
