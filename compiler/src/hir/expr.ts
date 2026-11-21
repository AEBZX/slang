import {member_visit, slang_hir_visitor} from './tool'
import {
    AddressPrefix,
    ArgumentsPostfix,
    ArrayExpression,
    BinaryExpression, BitNotPrefix, ClassType, DecrementPostfix, DecrementPrefix, HAddressExpr, HArgumentsExpr,
    HArrayExpr, HBinaryExpr, HBitNotExpr, HExpr, HIdentifierExpr, HIndexExpr,
    HLambdaExpr, HNotExpr,
    HNumberLiteral, HPostDecrementExpr,
    HPostIncrementExpr, HPreDecrementExpr, HPreIncrementExpr,
    HReferenceExpr, HTernaryExpr, IncrementPostfix, IncrementPrefix, IndexPostfix,
    LambdaExpression, MemberPostfix, NewPrefix, NotPrefix,
    NumberLiteral, ReferencePrefix, TernaryExpression
} from '../utils'

const H_Number:slang_hir_visitor=(node:NumberLiteral,scope,call)=>{
    return new HNumberLiteral(parseInt(node.value))
}
const H_Array:slang_hir_visitor=(node:ArrayExpression,scope,call)=>{
    return new HArrayExpr(node.elements.map(call))
}
const H_Lambda:slang_hir_visitor=(node:LambdaExpression,scope,call)=>{
    scope=scope.enter()
    const params=Array.from(node.params.keys()).map(i=>scope.global_id())
    let index=0
    for(const i of node.params.keys())
        scope.symbol_set(i,params[index++])
    scope=scope.leave()
    return null
}
const H_PostInc:slang_hir_visitor=(node:IncrementPostfix,scope,call)=>{
    return new HPostIncrementExpr(call(node.expr))
}
const H_PostDec:slang_hir_visitor=(node:DecrementPostfix,scope,call)=>{
    return new HPostDecrementExpr(call(node.expr))
}
const H_Index:slang_hir_visitor=(node:IndexPostfix,scope,call)=>{
    return new HIndexExpr(call(node.expr),call(node.index))
}
const H_Member:slang_hir_visitor=(node:MemberPostfix,scope,call)=>{
    const chain=member_visit(node)
    const index=(expr:HExpr,id:number)=>{
        return new HIndexExpr(expr,new HNumberLiteral(id))
    }
    const chain_index=(start:HIdentifierExpr,name:string,chain:string[])=>{
        let ret:HExpr=start
        for(const i of chain){
            name=name+'.'+chain[i]
            ret=index(ret,scope.symbol_get(name))
        }
        return ret
    }
    //node.expr一定是class/interface类型的,顺着类型查成员id
    if(chain==null){
        const type=node.expr.type as ClassType
        const id=scope.symbol_get(type.local.join('.')+'.'+node.name)
        return index(call(node.expr),id)
    }
    //这种情况得研究一下,就是成员链,先把最前面的看一下是不是link
    if(scope.link_get(chain[0])!=null)chain[0]=scope.link_get(chain[0])
    //第一个如果是block就继续,否则处理成index链
    if(scope.get_mark(scope.symbol_get(chain[0])))
        return chain_index(new HIdentifierExpr(scope.symbol_get(chain[0])),chain[0],chain.slice(1))
    //不是block,那么收集尽量长的block,处理成index链
    let end_index=0
    let global_name:string=''
    for(const i of chain){
        const name=global_name==''?i:global_name+'.'+i
        if(!scope.get_mark(scope.symbol_get(name)))
            global_name=name
        else break
        end_index++
    }
    return chain_index(new HIdentifierExpr(scope.symbol_get(global_name)),global_name,chain.slice(end_index))
}
const H_Arguments:slang_hir_visitor=(node:ArgumentsPostfix,scope,call)=>{
    return new HArgumentsExpr(node.expr,node.args.map(call))
}
const H_PreInc:slang_hir_visitor=(node:IncrementPrefix,scope,call)=>{
    return new HPreIncrementExpr(call(node.expr))
}
const H_PreDec:slang_hir_visitor=(node:DecrementPrefix,scope,call)=>{
    return new HPreDecrementExpr(call(node.expr))
}
const H_Not:slang_hir_visitor=(node:NotPrefix,scope,call)=>{
    return new HNotExpr(call(node.expr))
}
const H_BitNot:slang_hir_visitor=(node:BitNotPrefix,scope,call)=>{
    return new HBitNotExpr(call(node.expr))
}
const H_Address:slang_hir_visitor=(node:AddressPrefix,scope,call)=>{
    return new HAddressExpr(call(node.expr))
}
const H_Reference:slang_hir_visitor=(node:ReferencePrefix,scope,call)=>{
    return new HReferenceExpr(call(node.expr))
}
const H_Binary:slang_hir_visitor=(node:BinaryExpression,scope,call)=>{
    return new HBinaryExpr(call(node.left),node.op,call(node.right))
}
const H_Ternary:slang_hir_visitor=(node:TernaryExpression,scope,call)=>{
    return new HTernaryExpr(call(node.condition),call(node.trueExpr),call(node.falseExpr))
}