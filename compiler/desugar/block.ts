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
    Function, LambdaExpression, NullLiteral, Value, NumberType, StringType, BooleanType, ListCommand, Return,
    IdentifierExpr
} from '../utils'
import {slang_desugar_visitor} from './tool'
const D_Module:slang_desugar_visitor=(node:Module,call)=>{
    node.children=node.children.map(call) as Block[]
    return node
}
const D_Value:slang_desugar_visitor=(node:Value,call)=>{
    const literal=node.value instanceof NumberType?'number':
        node.value instanceof StringType?'string':
            node.value instanceof BooleanType?'boolean':''
    return new Module(new Modifier(false,false,false),literal,node.children.map(call) as Block[])
}
const D_Operation:slang_desugar_visitor=(node:Operation,call)=>{
    node.command=call(node.command) as LambdaExpression
    return new Function(new Modifier(false,false,false),node.oper+'@'+node.index,new Map(),
        node.command.params,node.command.ret,node.command.body)
}
const D_Cast:slang_desugar_visitor=(node:Cast,call)=>{
    node.command=call(node.command) as LambdaExpression
    return new Function(new Modifier(false,false,false),'cast@'+node.id,new Map(),
        node.command.params,node.command.ret,node.command.body)
}
const D_Function:slang_desugar_visitor=(node:Function,call)=>{
    node.commands=call(node.commands)
    if(node.name=='constructor')node.commands=new ListCommand([node.commands,new Return(new IdentifierExpr('this'))])
    node.name=node.name+(node.index==null?'':'@'+node.index)
    return node
}
const D_Class:slang_desugar_visitor=(node:Class,call)=>{
    node.children=node.children.map(call) as Block[]
    return node
}