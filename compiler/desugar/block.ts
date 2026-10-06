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
    IdentifierExpr, VoidType, Interface
} from '../utils'
import {slang_desugar_visitor} from './tool'
const D_File:slang_desugar_visitor=(node:File,call)=>{
    node.children=node.children.map(call) as Block[]
    return node
}
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
    node.name=node.name+(node.index==null?'':'@'+node.index)
    //对于static等啥用没有,只有对实例方法有用,所以都加不影响
    node.params.set('',new ClassType(null,null))
    if(node.return_type instanceof VoidType)
        node.commands=new ListCommand([node.commands,new Return(new IdentifierExpr('this'))])
    return new Variable(node.modifiers,node.name,new LambdaType(null,null,null),new LambdaExpression(
        node.generic,node.params,node.return_type,node.commands
    ))
}
const D_Class:slang_desugar_visitor=(node:Class,call)=>{
    node.children=node.children.map(call) as Block[]
    node.children=node.children.map(i=>{
        if(!i.modifiers.unstatic)return i
        if(i instanceof Variable&&i.value instanceof LambdaExpression)
            i.value.params.set('this',new ClassType(null,null))
        if(i instanceof Function)
            i.params.set('this',new ClassType(null,null))
        return i
    })
    return node
}
//脱糖成正常Class
const D_Interface:slang_desugar_visitor=(node:Interface,call)=>{
    node.children=node.children.map(call) as Block[]
    return new Class(node.modifiers,node.name,node.generic,null,node.children)
}
const D_Enum:slang_desugar_visitor=(node:Enum,call)=>
    new Class(node.modifiers,node.name,new Map(),null,node.children.map(i=>
        new Variable(new Modifier(false,false,false),i,new VoidType(),new NullLiteral(''))
    ))
export default new Map<any,desugar_visitor>([
    [File,D_File],
    [Module,D_Module],
    [Value,D_Value],
    [Operation,D_Operation],
    [Cast,D_Cast],
    [Function,D_Function],
    [Class,D_Class],
    [Interface,D_Interface],
    [Enum,D_Enum]
])