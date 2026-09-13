import {
    ast_data,
    slang_ast_generate,
    BooleanType,
    ClassType, FixType,
    LambdaType,
    NumberType, PointFix,
    StringType,
    Type, TypeFix,
    VoidType, ArrayFix, MapFix, GenericType
} from '../../utils'
const G_NumberType:slang_ast_generate=(data,tree)=>new NumberType()
const G_StringType:slang_ast_generate=(data,tree)=>new StringType()
const G_BooleanType:slang_ast_generate=(data,tree)=>new BooleanType()
const G_VoidType:slang_ast_generate=(data,tree)=>new VoidType()
const G_LambdaType:slang_ast_generate=(data,tree)=>{
    let params=new Map<string,Type>()
    let ParamIdentifier=data.children.get(0) as ast_data
    let ret=tree(data.children.get(2) as ast_data)
    for(let [k,v] of ParamIdentifier.children)
        if(typeof v=='object')
            params.set(v.children.get(0) as string,
                       tree(v.children.get(2) as ast_data))
    //模型槽位 (generic,params,returnType,_await):此前 3 参调用把 params 塞 generic、ret 塞 params
    return new LambdaType(new Map(),params,ret,false)
}
const G_GenericType:slang_ast_generate=(data,tree)=>new GenericType(data.children.get(0) as string)
const G_ClassType:slang_ast_generate=(data,tree)=>{
    let local=new Array<string>()
    let _data=data.children.get(0) as ast_data
    for(let [k,v] of _data.children)
        local.push(v as string)
    let generic=[]
    if(data.children.has(1))
        for(let [k,v] of (data.children.get(1) as ast_data).children)
            if(typeof v=='object')
                generic.push(tree(v))
    return new ClassType(local,generic)
}
const G_FixType:slang_ast_generate=(data,tree)=>{
    let basic=tree(data.children.get(0) as ast_data)
    let fix:TypeFix[]=[]
    let FixList=data.children.get(1) as ast_data
    for(let [k,v] of FixList.children)
        if(typeof v=='object')
            switch (v.type){
                case 'ArrayPostfix':
                    fix.push(new ArrayFix())
                    break
                case 'MapPostfix':
                    fix.push(new MapFix())
                    break
                case 'PointPostfix':
                    fix.push(new PointFix())
                    break
            }
    if(fix.length==0)
        return basic
    return new FixType(basic,fix)
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