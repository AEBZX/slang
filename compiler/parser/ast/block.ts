import {
    ast_data,
    slang_ast_generate, ASTTree,
    Block, Cast,
    Class, ClassType,
    Enum, File,
    Function,
    Interface, LambdaExpression,
    Link, Modifier,
    Module, Operation,
    Type, Value,
    Variable
} from '../../utils'
const G_Link:slang_ast_generate=(data,tree)=>{
    let local:string[]=[]
    let name=data.children.get(0) as ast_data
    //须递归收集而非只取直接 child
    let collect=(n:ast_data)=>{
        for(let v of n.children.values())
            if(typeof v=='string')local.push(v)
            else if(typeof v=='object')collect(v)
    }
    collect(name)
    return new Link(local,data.children.get(1) as string)
}
const G_Module:slang_ast_generate=(data,tree)=>{
    let children=[]
    for(let [k,v] of (data.children.get(0) as ast_data).children)
        if(typeof v=='object')children.push(tree(v))
    return new Module(null,null,children)
}
const G_Value:slang_ast_generate=(data,tree)=>{
    return new Value(tree(data.children.get(0) as ast_data),
        Array.from((data.children.get(1) as ast_data).children.values())
            .map(i=>tree(i as ast_data)) as Block[])
}
export function parseImplement(data:ast_data,tree:(data:ast_data)=>ASTTree,key:number){
    let first=data.children.get(key) as ast_data
    if(first.type=='ImplementsName')
        return {is:true,data:tree(first.children.get(0) as ast_data)}
    if(first.type=='ModuleName')
        return {is:true,data:tree(first.children.get(0) as ast_data)}
    return {is:false,data:new ClassType(['std','ObjectInterface'],[])}
}
export function parseGeneric(data:ast_data,tree:(data:ast_data)=>ASTTree){
    let generic=data.children.get(0) as ast_data
    if(generic.type!='GenericList')return {
        is:false,data:new Map<string,Type>()
    }
    let ret=new Map<string,Type>()
    for(let [k,v] of (generic.children.get(0) as ast_data).children)
        if(typeof v=='object')
            ret.set(v.children.get(0) as string,parseImplement(v.children.get(1) as ast_data,tree,0).data)
    return {is:true,data:ret}
}
const G_Class:slang_ast_generate=(data,tree)=>{
    let generic=parseGeneric(data,tree)
    let implement=generic.is?parseImplement(data,tree,1):parseImplement(data,tree,0)
    let children=[]
    for(let [k,v] of
        (data.children.get(generic.is&&implement.is?2:generic.is||implement.is?1:0) as ast_data).children)
        if(typeof v=='object')children.push(tree(v))
    return new Class(null,null,generic.data,implement.data,children)
}
const G_Interface:slang_ast_generate=(data,tree)=>{
    let generic=parseGeneric(data,tree)
    let implement=generic.is?parseImplement(data,tree,1):parseImplement(data,tree,0)
    let children=[]
    for(let [k,v] of
        (data.children.get(generic.is&&implement.is?2:generic.is||implement.is?1:0) as ast_data).children)
        if(typeof v=='object')children.push(tree(v))
    return new Interface(null,null,generic.data,implement.data,children)
}
const G_Enum:slang_ast_generate=(data,tree)=>{
    let children=[]
    for(let [k,v] of (data.children.get(0) as ast_data).children)
        children.push(v as string)
    return new Enum(null,null,children)
}
const G_Function:slang_ast_generate=(data,tree)=>{
    let params=new Map<string,Type>()
    let generic=parseGeneric(data,tree)
    let off=generic.is?1:0
    let ParamIdentifier=data.children.get(1+off) as ast_data
    for(let [k,v] of ParamIdentifier.children)
        if(typeof v=='object')
            params.set(v.children.get(0) as string,
                       tree(v.children.get(2) as ast_data))
    let _implement=typeof data.children.get(2+off)=='object'
    return new Function(null,null,generic.data,params,tree(data.children.get(off) as ast_data),
                       _implement?tree(data.children.get(2+off) as ast_data):null)
}
const G_Variable:slang_ast_generate=(data,tree)=>{
    let value=data.children.get(2)
    return new Variable(null,null,tree(data.children.get(1) as ast_data),
                       value&&typeof value=='object'?tree(value as ast_data):null)
}
const G_Block:slang_ast_generate=(data,tree)=>{
    let modifier=data.children.get(0) as ast_data
    let _Modifier=[]
    for(let [k,v] of modifier.children)
        _Modifier.push(v as string)
    let ret=tree(data.children.get(3) as ast_data) as Block
    ret.modifiers=new Modifier(
        _Modifier.includes('unstatic')?true:_Modifier.includes('static')?false:null,
        _Modifier.includes('async')?true:_Modifier.includes('sync')?false:null,
        _Modifier.includes('unprivate')?true:_Modifier.includes('private')?false:null
    )
    ret.name=data.children.get(1) as string
    //ObjectInterface 接口本身不实现自己(否则 collect 递归 implement 死循环栈溢出)
    if((ret instanceof Class||ret instanceof Interface)&&ret.name=='ObjectInterface')ret.implement=null
    return ret
}
const G_File:slang_ast_generate=(data,tree)=>{
    let links=[]
    for(let [k,v] of (data.children.get(0) as ast_data).children)
        if(typeof v=='object')
            links.push(tree(v))
    let blocks=[]
    for(let [k,v] of (data.children.get(1) as ast_data).children)
        if(typeof v=='object')
            blocks.push(tree(v))
    return new File(links,blocks)
}
//组合符号(节点型)映射回操作符字符串;单字符符号直接是字符串
const G_Operation:slang_ast_generate=(data,tree)=>{
    let sym=data.children.get(0)
    let oper=(sym as ast_data).type
    return new Operation(oper,
        tree(data.children.get(1) as ast_data) as LambdaExpression)
}
const G_Cast:slang_ast_generate=(data,tree)=>{
    return new Cast(tree(data.children.get(0) as ast_data),
        tree((data.children.get(1) as ast_data)) as LambdaExpression)
}
export default new Map([
    ['Link',G_Link],
    ['Module',G_Module],
    ['Value',G_Value],
    ['Class',G_Class],
    ['Interface',G_Interface],
    ['Enum',G_Enum],
    ['Function',G_Function],
    ['Variable',G_Variable],
    ['Block',G_Block],
    ['File',G_File],
    ['Operation',G_Operation],
    ['Cast',G_Cast]
])