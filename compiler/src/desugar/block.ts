import {slang_desugar_visitor} from './tool'
import {
    Block, BooleanType, Cast,
    Class,
    Command, Enum, Expression,
    File,
    Function, IdentifierExpr,
    Interface,
    LambdaExpression,
    LambdaType, ListCommand, Modifier,
    Module, NumberLiteral, NumberType, Operation, ReferenceType, Return, Value,
    VarDecl,
    Variable, VoidType
} from '../utils'
const D_File:slang_desugar_visitor=(node:File,call)=>{
    node.children=node.children.map(call) as Block[]
    return node
}
const D_Module:slang_desugar_visitor=(node:Module,call)=>{
    node.children=node.children.map(call) as Block[]
    return node
}
const D_Class_Interface:slang_desugar_visitor=(node:Interface|Class,call)=>{
    node.children=node.children.map(call) as Block[]
    return node
}
const D_Function:slang_desugar_visitor=(node:Function,call)=>{
    //不是static就是类/接口成员,最后面加一个Reference的this
    if(node.modifiers.unstatic)
        node.params=new Map([...node.params,['this',new ReferenceType(new VoidType())]])
    node.commands=call(node.commands) as Command
    if(node.name=='constructor')
        node.commands=call(new ListCommand([node.commands,new Return(new IdentifierExpr('this'))]))
    return new Variable(node.modifiers,node.name+'@'+node.index,
        new LambdaType(node.generic,node.params,node.return_type),
        new LambdaExpression(node.generic,node.params,node.return_type,node.commands))
}
const D_Value:slang_desugar_visitor=(node:Value,call)=>{
    return call(new Module(node.modifiers,node instanceof BooleanType?'boolean':'number',node.children))
}
const D_Operation:slang_desugar_visitor=(node:Operation,call)=>{
    const fn=new Function(node.modifiers,node.oper,new Map(),new Map(),node.command.ret,node.command.body)
    fn.index=node.index
    return call(fn)
}
const D_Cast:slang_desugar_visitor=(node:Cast,call)=>{
    const fn=new Function(node.modifiers,'cast',new Map(),new Map(),node.command.ret,node.command.body)
    fn.index=node.id
    return call(fn)
}
const D_Enum:slang_desugar_visitor=(node:Enum,call)=>{
    return new Module(node.modifiers,node.name,
        node.children.map(((i,index)=>{
            return new Variable(new Modifier(false,false,false),
                i,new NumberType(),new NumberLiteral(''+index))
        }))
    )
}
const D_Variable:slang_desugar_visitor=(node:Variable,call)=>{
    //variable不oper/cast
    return new Variable(node.modifiers,node.name,node.t,call(node.value) as Expression)
}
export default new Map<any,slang_desugar_visitor>([
    [File,D_File],
    [Module,D_Module],
    [Variable,D_Variable],
    [Class,D_Class_Interface],
    [Interface,D_Class_Interface],
    [Function,D_Function],
    [Value,D_Value],
    [Operation,D_Operation],
    [Cast,D_Cast],
    [Enum,D_Enum]
])