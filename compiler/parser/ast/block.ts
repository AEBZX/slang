import {
    ast_data,
    ast_generate, ASTTree,
    Block,
    Class, ClassType,
    Enum, File,
    Function,
    Interface,
    Link, Modifier,
    Module,
    Type,
    Variable
} from '../../utils'
const G_Link:ast_generate=(data,tree)=>{
    let local:string[]=[]
    let name=data.children.get('child_0') as ast_data
    for(let [k,v] of name.children)
        local.push(v as string)
    return new Link(local,data.children.get('child_1') as string)
}
const G_Module:ast_generate=(data,tree)=>{
    let children=[]
    for(let [k,v] of (data.children.get('child_0') as ast_data).children)
        if(typeof v=='object')children.push(tree(v))
    return new Module(null,null,children)
}
function parseImplement(data:ast_data,tree:(data:ast_data)=>ASTTree,key:string){
    let first=data.children.get(key) as ast_data
    if(first.type=='ModuleName')
        return {is:true,data:tree(first.children.get('child_0') as ast_data)}
    return {is:false,data:new ClassType(['std','ObjectInterface'],[])}
}
export function parseGeneric(data:ast_data,tree:(data:ast_data)=>ASTTree){
    let generic=data.children.get('child_0') as ast_data
    if(generic.type!='GenericList')return {
        is:false,data:new Map<string,Type>()
    }
    let ret=new Map<string,Type>()
    for(let [k,v] of (generic.children.get('child0') as ast_data).children)
        if(typeof v=='object')
            ret.set(v.children.get('child_0') as string,parseImplement(v.children.get('child_1') as ast_data,tree,'child_0').data)
    return {is:true,data:ret}
}
const G_Class:ast_generate=(data,tree)=>{
    let generic=parseGeneric(data,tree)
    let implement=generic.is?parseImplement(data,tree,'child_1'):parseImplement(data,tree,'child_0')
    let children=[]
    for(let [k,v] of
        (data.children.get(generic.is&&implement.is?'child_2':generic.is||implement.is?'child_1':'child_0') as ast_data).children)
        if(typeof v=='object')children.push(tree(v))
    return new Class(null,null,generic.data,implement.data,children)
}
const G_Interface:ast_generate=(data,tree)=>{
    let generic=parseGeneric(data,tree)
    let implement=generic.is?parseImplement(data,tree,'child_1'):parseImplement(data,tree,'child_0')
    let children=[]
    for(let [k,v] of
        (data.children.get(generic.is&&implement.is?'child_2':generic.is||implement.is?'child_1':'child_0') as ast_data).children)
        if(typeof v=='object')children.push(tree(v))
    return new Interface(null,null,generic.data,implement.data,children)
}
const G_Enum:ast_generate=(data,tree)=>{
    let children=[]
    for(let [k,v] of (data.children.get('child_0') as ast_data).children)
        children.push(v as string)
    return new Enum(null,null,children)
}
const G_Function:ast_generate=(data,tree)=>{
    let params=new Map<string,Type>()
    let generic=parseGeneric(data,tree)
    let ParamIdentifier=data.children.get(generic.is?'child_1':'child_0') as ast_data
    for(let [k,v] of ParamIdentifier.children)
        if(typeof v=='object')
            params.set(v.children.get('child_0') as string,
                       tree(v.children.get('child_2') as ast_data))
    return new Function(null,null,generic.data,params,tree(data.children.get('child_0') as ast_data),
                       tree(data.children.get('child_2') as ast_data))
}
const G_Variable:ast_generate=(data,tree)=>{
    let value=data.children.get('child_2')
    return new Variable(null,null,tree(data.children.get('child_1') as ast_data),
                       value&&typeof value=='object'?tree(value as ast_data):null)
}
const G_Block:ast_generate=(data,tree)=>{
    let modifier=data.children.get('child_0') as ast_data
    let _Modifier=[]
    for(let [k,v] of modifier.children)
        _Modifier.push(v as string)
    let ret=tree(data.children.get('child_3') as ast_data) as Block
    ret.modifiers=new Modifier(!_Modifier.includes('static'),_Modifier.includes('async'),_Modifier.includes('private'))
    ret.name=data.children.get('child_1') as string
    //ObjectInterface 接口/类本身不实现自己(否则 collect 递归 implement 死循环栈溢出)
    if((ret instanceof Class||ret instanceof Interface)&&ret.name=='ObjectInterface')ret.implement=null
    return ret
}
const G_File:ast_generate=(data,tree)=>{
    let links=[]
    for(let [k,v] of (data.children.get('child_0') as ast_data).children)
        if(typeof v=='object')
            links.push(tree(v))
    let blocks=[]
    for(let [k,v] of (data.children.get('child_1') as ast_data).children)
        if(typeof v=='object')
            blocks.push(tree(v))
    return new File(links,blocks)
}
export default {
    'link':G_Link,
    'Module':G_Module,
    'Class':G_Class,
    'Interface':G_Interface,
    'Enum':G_Enum,
    'Function':G_Function,
    'Variable':G_Variable,
    'Block':G_Block,
    'File':G_File
}