import {ast_data, Check as $, Scope,check_visitor} from '../utils'
const NumberLiteral:check_visitor=(data:ast_data,scope:Scope,call:(ast:ast_data)=>ast_data)=>{
    data.comment={
        type:'number',
        children:null
    }
    return data
}
const StringLiteral:check_visitor=(data:ast_data,scope:Scope,call:(ast:ast_data)=>ast_data)=>{
    data.comment={
        type:'string',
        children:null
    }
    return data
}
const BooleanLiteral:check_visitor=(data:ast_data,scope:Scope,call:(ast:ast_data)=>ast_data)=>{
    data.comment={
        type:'boolean',
        children:null
    }
    return data
}
const NullLiteral:check_visitor=(data:ast_data,scope:Scope,call:(ast:ast_data)=>ast_data)=>{
    data.comment={
        type:'null',
        children:null
    }
    return data
}
const Identifier:check_visitor=(data:ast_data,scope:Scope,call:(ast:ast_data)=>ast_data)=>{
    let type=scope.get(data.children.get('token_0') as string)
    if(type)data.comment=type
    else scope.thr(`${data.children.get('token_0')}不在定义域内`)
    return data
}
function _type(a:any,b:any){
    if('comment' in a)
        return a==b
    let c={type:null,children:[]}
    if(a['type']!=b['type']){
        if(a['type']==null)c['type']=b['type']
        else c['type']=b['type']
    }
    if(a['children']==null)c['children']=b['children']
    if(b['children']==null)c['children']=a['children']
    if(a['children']!=null&&b['children']!=null)
        for(let i=0;i<a['children']['length'];i++)
            c['children'][i]=_type(a['children'][i],b['children'][i])
    return c
}
const ArrayExpression:check_visitor=(data:ast_data,scope:Scope,call:(ast:ast_data)=>ast_data)=>{
    let a=null
    for(let [n,i] of data.children)
        if(typeof i=='object')i=call(i)
    for(let [name,value] of data.children){
        if(!scope.type(a,value['comment'])){
            scope.thr(`${name}类型错误 as line ${data.line.join('\n')}`)
            data.comment={
                type:'array',
                children:null
            }
            return data
        }
        a=value['comment']
    }
    //优先最深度类型
    a=null
    for(let [name,value] of data.children)
        a=_type(a,value['comment'])
    data.comment={
        type:'array',
        children:[a]
    }
    return data
}
const MapExpression:check_visitor=(data:ast_data,scope:Scope,call:(ast:ast_data)=>ast_data)=>{
    let a=null
    for(let [n,i] of data.children)
        if(typeof i=='object')i=call(i)
    for(let [name,value] of data.children){
        if(!scope.type(a,value['children']['Expression']['comment'])){
            scope.thr(`${name}类型错误 as line ${data.line.join('\n')}`)
            data.comment={
                type:'map',
                children:null
            }
            return data
        }
        a=value['comment']
    }
    //优先最深度类型
    a=null
    for(let [name,value] of data.children)
        a=_type(a,value['children']['Expression']['comment'])
    data.comment={
        type:'map',
        children:[a]
    }
    return data
}
const LambdaExpression:check_visitor=(data:ast_data,scope:Scope,call:(ast:ast_data)=>ast_data)=>{
    let ls=data.children.get('ParamIdentifier') as ast_data
    data.children.set('ParamIdentifier',call(ls))
    let type={
        type:'lambda',
        children:[ls.comment,data.children.get('Type')]
    }
    let k:string[]=[],v:ast_data[]=[]
    for(let [a,b] of ls.children){
        v.push((b as ast_data).children.get('Type') as ast_data)
        k.push((b as ast_data).children.get('token_0') as string)
    }
    scope=scope.enter()
    for(let i=0;i<k.length;i++)
        scope.set(k[i],v[i]['comment'])
    data.children.set('Commands',call(data.children.get('Commands') as ast_data))
    scope=scope.leave()
    data.comment=type
    return data
}
const PostfixExpression:check_visitor=(data:ast_data,scope:Scope,call:(ast:ast_data)=>ast_data)=>{
    let fix:ast_data[]=[]
    for(let [k,v] of (data.children.get('PostfixData') as ast_data).children)
        fix.push(v as ast_data)
    let primary:ast_data
    for(let [k,v] of data.children)
        if(k.includes('Expression')||k.includes('Literal'))
            primary=call(v as ast_data)
    for(let i of fix){
        switch (i.type) {
            case 'IncrementPostfix':
            case 'DecrementPostfix':{
                if(primary.comment['type']!='number')
                    scope.thr(`${primary.children.get('token_0')}类型错误 as line ${primary.line.join('\n')}`)
                break
            }
            case 'MemberPostfix':{
                let member=i.children.get('token_0') as string
                if(primary.comment['type']!='class')
                    scope.thr(`${primary.children.get('token_0')}类型错误 as line ${primary.line.join('\n')}`)
                let _class=scope.get(primary.comment['children'][0])
                break
            }
        }
    }
    return null
}