import {
    ast_data,
    slang_ast_generate, ASTTree,
    Block, Cast,
    Class, ClassType,
    Enum, File,
    Function,
    Interface, KeyMap, LambdaExpression,
    Link, Modifier,
    Module, Operation,
    Type, Value,
    Variable
} from '../../utils'
import {parseGeneric, parseImplement, to_ast_data, to_string, tree_ast} from "./tool";
const G_Link:slang_ast_generate=(data,tree)=>{
    let local:string[]=[]
    let name=data.children.get(0) as ast_data
    //须递归收集而非只取直接 child
    let collect=(n:ast_data)=>{
        for(const v of n.children.values())
            if(typeof v=='string')local.push(v)
            else if(typeof v=='object')collect(v)
    }
    collect(name)
    return new Link(local,to_string(data,1))
}
const G_Module:slang_ast_generate=(data,tree)=>{
    let children=[]
    for(const v of to_ast_data(data,0).children.values())
        if(typeof v=='object')children.push(tree(v))
    return new Module(null,null,children)
}
const G_Value:slang_ast_generate=(data,tree)=>{
    return new Value(tree(data.children.get(0) as ast_data),
        Array.from((to_ast_data(data,1).children.values()))
            .map(i=>tree(i as ast_data)) as Block[])
}
const G_Class:slang_ast_generate=(data,tree)=>{
    let generic=parseGeneric(data,tree)
    let implement=generic.is?parseImplement(data,tree,1):parseImplement(data,tree,0)
    let children=[]
    for(const v of to_ast_data(data,generic.is&&implement.is?2:generic.is||implement.is?1:0).children.values())
        if(typeof v=='object')children.push(tree(v))
    return new Class(null,null,generic.data,implement.data,children)
}
const G_Interface:slang_ast_generate=(data,tree)=>{
    const generic=parseGeneric(data,tree)
    const implement=generic.is?parseImplement(data,tree,1):parseImplement(data,tree,0)
    let children=[]
    for(const v of to_ast_data(data,generic.is&&implement.is?2:generic.is||implement.is?1:0).children.values())
        if(typeof v=='object')children.push(tree(v))
    return new Interface(null,null,generic.data,implement.data,children)
}
const G_Enum:slang_ast_generate=(data,tree)=>{
    let children=[]
    for(const v of to_ast_data(data,0).children.values())
        children.push(v as string)
    return new Enum(null,null,children)
}
const G_Function:slang_ast_generate=(data,tree)=>{
    let params=new KeyMap<string,Type>()
    const generic=parseGeneric(data,tree)
    const off=generic.is?1:0
    const ParamIdentifier=to_ast_data(data,1+off)
    for(const v of ParamIdentifier.children.values())
        if(typeof v=='object')
            //ParamData 的槽位:0=名称,1=':' 字面量占槽,2=类型
            params.set(to_string(v,0),
                       tree_ast(v,2,tree))
    const _implement=typeof data.children.get(2+off)=='object'
    return new Function(null,null,generic.data,params,tree_ast(data,off,tree),
                       _implement?tree_ast(data,2+off,tree):null)
}
const G_Variable:slang_ast_generate=(data,tree)=>{
    //child 1:有初值时是表达式节点,无初值时是 CST 里裸字符串 ';' 的节点,不能当表达式转换
    const init=to_ast_data(data,1)
    return new Variable(null,null,tree_ast(data,0,tree),typeof init=='object'?tree_ast(init,0,tree):null)
}
const G_Block:slang_ast_generate=(data,tree)=>{
    let modifier=data.children.get(0) as ast_data
    let _Modifier=[]
    for(const v of modifier.children.values())
        _Modifier.push(v as string)
    let ret=tree_ast<Block>(data,3,tree)
    ret.modifiers=new Modifier(
        _Modifier.includes('unstatic')?true:_Modifier.includes('static')?false:null,
        _Modifier.includes('async')?true:_Modifier.includes('sync')?false:null,
        _Modifier.includes('private')?true:(_Modifier.includes('public')||_Modifier.includes('unprivate'))?false:null
    )
    ret.name=to_string(data,1)
    if((ret instanceof Class||ret instanceof Interface)&&ret.name=='ObjectInterface')ret.implement=null
    return ret
}
const G_File:slang_ast_generate=(data,tree)=>{
    let links=[]
    for(const v of to_ast_data(data,0).children.values())
        if(typeof v=='object')
            links.push(tree(v))
    let blocks=[]
    for(const v of to_ast_data(data,1).children.values())
        if(typeof v=='object')
            blocks.push(tree(v))
    return new File(links,blocks)
}
const G_Operation:slang_ast_generate=(data,tree)=>{
    let sym=to_ast_data(data,0)
    let oper=typeof sym=='string'?sym:(sym.type=='BIDX'?'[]':'()')
    return new Operation(oper,
        tree_ast(data,1,tree))
}
const G_Cast:slang_ast_generate=(data,tree)=>
    new Cast(tree_ast(data,0,tree),
        tree_ast(data,1,tree))
export default new Map([
    ['link',G_Link],
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