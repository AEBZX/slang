import {ast_data, Check as $, Scope} from '../utils'
const NumberLiteral=(data:ast_data,scope:Scope)=>{
    data.comment={
        type:'number',
        children:null
    }
    return data
}
const StringLiteral=(data:ast_data,scope:Scope)=>{
    data.comment={
        type:'string',
        children:null
    }
    return data
}
const BooleanLiteral=(data:ast_data,scope:Scope)=>{
    data.comment={
        type:'boolean',
        children:null
    }
    return data
}
const NullLiteral=(data:ast_data,scope:Scope)=>{
    data.comment={
        type:'null',
        children:null
    }
    return data
}
const Identifier=(data:ast_data,scope:Scope)=>{
    let type=scope.get(data.children.get('token_0') as string)
    if(type)data.comment=type
    else scope.thr(`${data.children.get('token_0')}不在定义域内`)
    return data
}
const ArrayExpression=(data:ast_data,scope:Scope)=>{
    let a=null
    for(let [name,value] of data.children){
        if(!scope.type(a,value['comment'])){
            scope.thr(`${name}类型错误`)
            data.comment={
                type:'array',
                children:null
            }
            return data
        }
        a=value['comment']
    }
    a=null
}