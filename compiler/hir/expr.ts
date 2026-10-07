import {slang_hir_visitor} from './tool'
import {
    AddressPrefix,
    ArgumentsPostfix,
    ArrayExpression, BinaryExpression,
    BitNotPrefix,
    BlockType,
    BooleanLiteral,
    ClassType,
    DecrementPostfix,
    DecrementPrefix,
    HAddressExpr,
    HArgumentsExpr,
    HBinaryExpr,
    HBitNotExpr,
    HBooleanLiteral,
    HIdentifierExpr,
    HIndexExpr,
    HLambdaExpr,
    HMapExpr,
    HMemberExpr,
    HNotExpr,
    HNullLiteral,
    HNumberLiteral,
    HPostDecrementExpr,
    HPostIncrementExpr,
    HPreDecrementExpr,
    HPreIncrementExpr,
    HReferenceExpr,
    HStringLiteral, HTernaryExpr,
    IdentifierExpr,
    IncrementPostfix,
    IncrementPrefix,
    HExpr, IndexPostfix,
    LambdaExpression,
    MapExpression,
    MemberPostfix,
    NotPrefix,
    NullLiteral,
    NumberLiteral,
    ReferencePrefix,
    StringLiteral, TernaryExpression, HArrayExpr
} from '../utils'
const H_NumberLiteral:slang_hir_visitor=(node:NumberLiteral, scope, call)=>{
    //进制字面量:0x/0b/0o 按各自的进制转,其余十进制
    const v=node.value
    const num=v.startsWith('0x')||v.startsWith('0X')?parseInt(v.slice(2),16):
        v.startsWith('0b')||v.startsWith('0B')?parseInt(v.slice(2),2):
            v.startsWith('0o')||v.startsWith('0O')?parseInt(v.slice(2),8):
                parseFloat(v)
    return new HNumberLiteral(num)
}
const H_StringLiteral:slang_hir_visitor=(node:StringLiteral,scope,call)=>
    //词法器已经去掉引号,这里不能再 slice 一遍
    new HStringLiteral(node.value)
const H_BooleanLiteral:slang_hir_visitor=(node:BooleanLiteral,scope,call)=>
    new HBooleanLiteral(node.value=='true')
const H_NullLiteral:slang_hir_visitor=(node:NullLiteral,scope,call)=>
    new HNullLiteral()
const H_IdentifierExpr:slang_hir_visitor=(node:IdentifierExpr,scope,call)=>{
    let id=scope.get(node.name)
    if(scope.link_target.get(node.name))
        id=scope.get(scope.link_target.get(node.name))
    return new HIdentifierExpr(id)
}
const H_ArrayExpr:slang_hir_visitor=(node:ArrayExpression,scope,call)=>
    new HArrayExpr(node.elements.map(call))
const H_MapExpr:slang_hir_visitor=(node:MapExpression,scope,call)=>{
    let ret=new Map()
    for(const [key, value] of node.elements)
        ret.set(key, call(value))
    return new HMapExpr(ret)
}
const H_LambdaExpr:slang_hir_visitor=(node:LambdaExpression,scope,call)=>{
    //参数注册进扁平注册表;同名遮蔽用快照恢复,内层 lambda 不能污染外层
    const old=new Map<string,number|undefined>()
    for(const [k,v] of node.params)old.set(k,scope.symbol.get(k))
    let params=[]
    for(const param of node.params.keys()){
        const id=scope.id()
        scope.set(param,id)
        params.push(new HIdentifierExpr(id))
    }
    const body=call(node.body)
    for(const [k,v] of old)v==null?scope.symbol.delete(k):scope.symbol.set(k,v)
    return new HLambdaExpr(params,body)
}
const H_IndexExpr:slang_hir_visitor=(node:IndexPostfix,scope,call)=>
    new HIndexExpr(call(node.expr), call(node.index))
const H_MemberExpr:slang_hir_visitor=(node:MemberPostfix,scope,call)=>{
    let name=[]
    const is_link=(node:MemberPostfix)=>{
        if(node.expr instanceof IdentifierExpr)return true
        if(node.expr instanceof MemberPostfix)return is_link(node.expr)
        return false
    }
    const name_get=(node:MemberPostfix|IdentifierExpr)=>{
        name.push(node.name)
        if(node instanceof MemberPostfix)name_get(node.expr as MemberPostfix|IdentifierExpr)
    }
    if(is_link(node)){
        name_get(node)
        name.reverse()
        //是否有link:截掉别名前缀,剩下的段逐个解析成成员 id,重建 HIR 链
        let lnk_name=null
        let lnk_path=''
        for(let i=0;i<name.length;i++){
            const target=scope.link_target.get(name.slice(0,i).join('.'))
            if(target){
                lnk_name=scope.get(target)
                lnk_path=target
                name=name.slice(i)
                break
            }
        }
        if(lnk_name!=null){
            let _node:HExpr=new HIdentifierExpr(lnk_name)
            for(const n of name)_node=new HMemberExpr(_node,scope.get(lnk_path+'.'+n))
            return _node
        }
    }
    if(node.expr.type instanceof ClassType||node.expr.type instanceof BlockType)
        return new HMemberExpr(call(node.expr),scope.get(node.expr.type.local.join('.')+'.'+node.name))
    return new HMemberExpr(call(node.expr), scope.get(node.name))
}
const H_ArgumentsExpr:slang_hir_visitor=(node:ArgumentsPostfix,scope,call)=>
    new HArgumentsExpr(call(node.expr),node.args.map(call))
const H_PreIncrementExpr:slang_hir_visitor=(node:IncrementPrefix,scope,call)=>
    new HPreIncrementExpr(call(node.expr))
const H_PreDecrementExpr:slang_hir_visitor=(node:DecrementPrefix,scope,call)=>
    new HPreDecrementExpr(call(node.expr))
const H_PostIncrementExpr:slang_hir_visitor=(node:IncrementPostfix,scope,call)=>
    new HPostIncrementExpr(call(node.expr))
const H_PostDecrementExpr:slang_hir_visitor=(node:DecrementPostfix,scope,call)=>
    new HPostDecrementExpr(call(node.expr))
const H_NotExpr:slang_hir_visitor=(node:NotPrefix,scope,call)=>
    new HNotExpr(call(node.expr))
const H_BitNotExpr:slang_hir_visitor=(node:BitNotPrefix,scope,call)=>
    new HBitNotExpr(call(node.expr))
const H_AddressExpr:slang_hir_visitor=(node:AddressPrefix,scope,call)=>
    new HAddressExpr(call(node.expr))
const H_ReferenceExpr:slang_hir_visitor=(node:ReferencePrefix,scope,call)=>
    new HReferenceExpr(call(node.expr))
const H_BinaryExpr:slang_hir_visitor=(node:BinaryExpression,scope,call)=>
    new HBinaryExpr(call(node.left),node.op,call(node.right))
const H_TernaryExpr:slang_hir_visitor=(node:TernaryExpression,scope,call)=>
    new HTernaryExpr(call(node.condition),call(node.trueExpr),call(node.falseExpr))
export default new Map<any,slang_hir_visitor>([
    [NumberLiteral,H_NumberLiteral],
    [StringLiteral,H_StringLiteral],
    [BooleanLiteral,H_BooleanLiteral],
    [NullLiteral,H_NullLiteral],
    [IdentifierExpr,H_IdentifierExpr],
    [ArrayExpression,H_ArrayExpr],
    [MapExpression,H_MapExpr],
    [LambdaExpression,H_LambdaExpr],
    [IndexPostfix,H_IndexExpr],
    [MemberPostfix,H_MemberExpr],
    [ArgumentsPostfix,H_ArgumentsExpr],
    [IncrementPrefix,H_PreIncrementExpr],
    [DecrementPrefix,H_PreDecrementExpr],
    [IncrementPostfix,H_PostIncrementExpr],
    [DecrementPostfix,H_PostDecrementExpr],
    [NotPrefix,H_NotExpr],
    [BitNotPrefix,H_BitNotExpr],
    [AddressPrefix,H_AddressExpr],
    [ReferencePrefix,H_ReferenceExpr],
    [BinaryExpression,H_BinaryExpr],
    [TernaryExpression,H_TernaryExpr]
])