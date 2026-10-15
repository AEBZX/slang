import {
    ast_data,
    slang_ast_generate,
    BooleanType,
    ClassType, FixType, KeyMap,
    LambdaType,
    NumberType,
    StringType,
    Type,
    VoidType, GenericType, ArrayType, MapType, PointType
} from '../../utils'
import {parseGeneric, to_ast_data, to_string, tree_ast} from "./tool";
const G_NumberType:slang_ast_generate=(data,tree)=>new NumberType()
const G_StringType:slang_ast_generate=(data,tree)=>new StringType()
const G_BooleanType:slang_ast_generate=(data,tree)=>new BooleanType()
const G_VoidType:slang_ast_generate=(data,tree)=>new VoidType()
const G_LambdaType:slang_ast_generate=(data,tree)=>{
    let params=new KeyMap<string,Type>()
    const generic=parseGeneric(data,tree)
    const off=generic.is?1:0
    const ParamIdentifier=to_ast_data(data,off)
    const ret=tree_ast<Type>(data,off+1,tree)
    for(const v of ParamIdentifier.children.values())
        if(typeof v=='object')
            params.set(to_string(v,0),
                       tree_ast(v,1,tree))
    return new LambdaType(generic.data,params,ret,false)
}
const G_GenericType:slang_ast_generate=(data,tree)=>new GenericType(to_string(data,0))
const G_ClassType:slang_ast_generate=(data,tree)=>{
    let local:string[]=[]
    local.push(to_string(data,0))
    const rest=to_ast_data(data,1)
    for(const v of rest.children.values())
        if(typeof v=='object')
            local.push(to_string(v,0))
    let generic:Type[]=[]
    if(data.children.has(2))
        for(const v of to_ast_data(data,2).children.values())
            if(typeof v=='object')
                generic.push(tree(v))
    return new ClassType(local,generic)
}
const G_FixType:slang_ast_generate=(data,tree)=>{
    let basic=tree_ast<Type>(data,0,tree)
    const FixList=to_ast_data(data,1)
    for(const v of FixList.children.values())
        if(typeof v=='object')
            switch (v.type){
                case 'ArrayPostfix':
                    basic=new ArrayType(basic)
                    break
                case 'MapPostfix':
                    basic=new MapType(basic)
                    break
                case 'PointPostfix':
                    basic=new PointType(basic)
                    break
            }
    return basic
}
export default new Map([
    ['NumberType',G_NumberType],
    ['StringType',G_StringType],
    ['BooleanType',G_BooleanType],
    ['VoidType',G_VoidType],
    ['LambdaType',G_LambdaType],
    ['ClassType',G_ClassType],
    ['Type',G_FixType],
    ['GenericType',G_GenericType]
])