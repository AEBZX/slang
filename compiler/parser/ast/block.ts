import {
    ast_data,
    ast_generate,
    Block,
    Class,
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
        if(typeof v=='object')children.push(tree(v,tree))
    return new Module(null,null,children)
}
const G_Class:ast_generate=(data,tree)=>{
    let local:string[]=[]
    let children=[]
    let first=data.children.get('child_0') as ast_data
    if(first.type=='ModuleName'){
        for(let [k,v] of first.children)
            local.push(v as string)
        for(let [k,v] of (data.children.get('child_1') as ast_data).children)
            if(typeof v=='object')children.push(tree(v,tree))
    }else
        for(let [k,v] of first.children)
            if(typeof v=='object')children.push(tree(v,tree))
    //无 implements 的类默认实现 std.ObjectInterface(作为父路径,见 symbol chain)
    if(local.length==0)local=['std','ObjectInterface']
    return new Class(null,null,local,children)
}
const G_Interface:ast_generate=(data,tree)=>{
    let local:string[]=[]
    let children=[]
    let first=data.children.get('child_0') as ast_data
    if(first.type=='ModuleName'){
        for(let [k,v] of first.children)
            local.push(v as string)
        for(let [k,v] of (data.children.get('child_1') as ast_data).children)
            if(typeof v=='object')children.push(tree(v,tree))
    }else{
        for(let [k,v] of first.children)
            if(typeof v=='object')children.push(tree(v,tree))
    }
    if(local.length==0)local=['std','ObjectInterface']
    return new Interface(null,null,local,children)
}
const G_Enum:ast_generate=(data,tree)=>{
    let children=[]
    for(let [k,v] of (data.children.get('child_0') as ast_data).children)
        children.push(v as string)
    return new Enum(null,null,children)
}
const G_Function:ast_generate=(data,tree)=>{
    let params=new Map<string,Type>()
    let ParamIdentifier=data.children.get('child_1') as ast_data
    for(let [k,v] of ParamIdentifier.children)
        if(typeof v=='object')
            params.set(v.children.get('child_0') as string,
                       tree(v.children.get('child_2') as ast_data,tree))
    return new Function(null,null,params,tree(data.children.get('child_0') as ast_data,tree),
                       tree(data.children.get('child_2') as ast_data,tree))
}
const G_Variable:ast_generate=(data,tree)=>{
    let value=data.children.get('child_2')
    return new Variable(null,null,tree(data.children.get('child_1') as ast_data,tree),
                       value&&typeof value=='object'?tree(value as ast_data,tree):null)
}
const G_Block:ast_generate=(data,tree)=>{
    let modifier=data.children.get('child_0') as ast_data
    let _Modifier=[]
    for(let [k,v] of modifier.children)
        _Modifier.push(v as string)
    let ret=tree(data.children.get('child_3') as ast_data,tree) as Block
    ret.modifiers=new Modifier(!_Modifier.includes('static'),_Modifier.includes('async'),_Modifier.includes('private'))
    ret.name=data.children.get('child_1') as string
    //ObjectInterface 接口/类本身不实现自己(否则 collect 递归 implement 死循环栈溢出)
    if((ret instanceof Class||ret instanceof Interface)&&ret.name=='ObjectInterface')ret.implement=[]
    return ret
}
const G_File:ast_generate=(data,tree)=>{
    let links=[]
    for(let [k,v] of (data.children.get('child_0') as ast_data).children)
        if(typeof v=='object')
            links.push(tree(v,tree))
    let blocks=[]
    for(let [k,v] of (data.children.get('child_1') as ast_data).children)
        if(typeof v=='object')
            blocks.push(tree(v,tree))
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