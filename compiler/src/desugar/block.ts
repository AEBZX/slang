import {slang_desugar_visitor} from './tool'
import {
    Block, BooleanType, Cast,
    Class,
    Command, Enum, Expression,
    File,
    Function,
    Interface,
    LambdaExpression,
    LambdaType, Modifier,
    Module, NumberLiteral, NumberType, Operation, ReferenceType, Value,
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
    if(!node.modifiers.unstatic)
        node.params=new Map([...node.params,['this',new ReferenceType(new VoidType())]])
    node.commands=call(node.commands) as Command
    return new Variable(node.modifiers,node.name+'@'+node.index,
        new LambdaType(node.generic,node.params,node.return_type),
        new LambdaExpression(node.generic,node.params,node.return_type,node.commands))
}
const D_Value:slang_desugar_visitor=(node:Value,call)=>{
    return call(new Module(node.modifiers,node instanceof BooleanType?'boolean':'number',node.children))
}
const D_Operation:slang_desugar_visitor=(node:Operation,call)=>{
    return call(new Function(node.modifiers,'operation@'+node.index,new Map(),new Map(),node.command.ret,node.command.body))
}
const D_Cast:slang_desugar_visitor=(node:Cast,call)=>{
    return call(new Function(node.modifiers,'cast@'+node.id,new Map(),new Map(),node.command.ret,node.command.body))
}
const D_Enum:slang_desugar_visitor=(node:Enum,call)=>{
    return new Module(node.modifiers,node.name,
        node.children.map(((i,index)=>{
            return new Variable(new Modifier(false,false,false),
                i,new NumberType(),new NumberLiteral(''+index))
        }))
    )
}
export default new Map<any,slang_desugar_visitor>([
    [File,D_File],
    [Module,D_Module],
    [Class,D_Class_Interface],
    [Interface,D_Class_Interface],
    [Function,D_Function],
    [Value,D_Value],
    [Operation,D_Operation],
    [Cast,D_Cast],
    [Enum,D_Enum]
])