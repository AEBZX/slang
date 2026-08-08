import {
    Block,
    Class,
    ClassType,
    desugar_visitor,
    Enum,
    File,
    Modifier,
    Module,
    NumberLiteral,
    NumberType,
    Variable,
    Function, LambdaType, LambdaExpression, NullLiteral
} from '../utils'

const D_Module:desugar_visitor=(node:Module,call)=>{
    node.children=node.children.map(i=>call(i)) as Block[]
    return node
}
const D_Class:desugar_visitor=(node:Class,call)=>{
    //成员函数加this参数:this指向当前类实例;constructor特殊处理不加
    for(let i of node.children)
        if(i instanceof Function&&i.modifiers.unstatic&&i.name!='constructor'&&!i.params.has('this'))
            i.params=new Map([['this',new ClassType((node.type as any).local)],...i.params])
    node.children=node.children.map(i=>call(i)) as Block[]
    return node
}
const D_File:desugar_visitor=(node:File,call)=>{
    node.children=node.children.map(i=>call(i)) as Block[]
    return node
}
const D_Enum:desugar_visitor=(node:Enum,call)=>{
    let index=0
    return call(new Class(node.modifiers, node.name, [], node.children.map(i =>
        new Variable(new Modifier(false, false, false), i, new NumberType(), new NumberLiteral(`${index++}`))
    )))
}
const D_Function:desugar_visitor=(node:Function,call)=>call(new Variable(node.modifiers, node.name,
        new LambdaType(node.params, node.return_type,node.modifiers._async),
        new LambdaExpression(node.params, node.return_type, node.commands)))
const D_Variable:desugar_visitor=(node:Variable,call)=>{
    node.value=node.value==null?new NullLiteral(''):call(node.value)
    return node
}
export default new Map<any,desugar_visitor>([
    [File,D_File],
    [Module,D_Module],
    [Class,D_Class],
    [Enum,D_Enum],
    [Function,D_Function],
    [Variable,D_Variable],
])