import {
    ast_data,
    ast_generate,
    BooleanType,
    ClassType, FixType,
    LambdaType,
    NumberType, PointFix,
    StringType,
    Type, TypeFix,
    VoidType, ArrayFix, MapFix, GenericType
} from '../../utils'
const G_NumberType:ast_generate=(data,tree)=>new NumberType()
const G_StringType:ast_generate=(data,tree)=>new StringType()
const G_BooleanType:ast_generate=(data,tree)=>new BooleanType()
const G_VoidType:ast_generate=(data,tree)=>new VoidType()
const G_LambdaType:ast_generate=(data,tree)=>{
    let params=new Map<string,Type>()
    let ParamIdentifier=data.children.get('child_0') as ast_data
    let ret=tree(data.children.get('child_2') as ast_data)
    for(let [k,v] of ParamIdentifier.children)
        if(typeof v=='object')
            params.set(v.children.get('child_0') as string,
                       tree(v.children.get('child_2') as ast_data))
    return new LambdaType(params,ret,false)
}
const G_GenericType:ast_generate=(data,tree)=>new GenericType(data.children.get('child_0') as string)
const G_ClassType:ast_generate=(data,tree)=>{
    let local=new Array<string>()
    let _data=data.children.get('child_0') as ast_data
    for(let [k,v] of _data.children)
        local.push(v as string)
    let generic=[]
    if(data.children.has('child_1'))
        for(let [k,v] of (data.children.get('child_1') as ast_data).children)
            if(typeof v=='object')
                generic.push(tree(v))
    return new ClassType(local,generic)
}
const G_FixType:ast_generate=(data,tree)=>{
    let basic=tree(data.children.get('child_0') as ast_data)
    let fix:TypeFix[]=[]
    let FixList=data.children.get('child_1') as ast_data
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
export default {
    'NumberType':G_NumberType,
    'StringType':G_StringType,
    'BooleanType':G_BooleanType,
    'VoidType':G_VoidType,
    'LambdaType':G_LambdaType,
    'ClassType':G_ClassType,
    'Type':G_FixType,
    'GenericType':G_GenericType
}