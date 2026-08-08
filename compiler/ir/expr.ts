import {
    asm_factory, HAddressExpr, HArgumentsExpr,
    HArrayExpr, HAssign, HBinaryExpr, HBitNotExpr,
    HBooleanLiteral,
    HIdentifierExpr, HIfStatement, HIndexExpr, HLambdaExpr, HMapExpr, HMemberExpr, HMinusExpr, HNotExpr,
    HNullLiteral,
    HNumberLiteral, HPostDecrementExpr, HPostIncrementExpr, HPreDecrementExpr, HPreIncrementExpr, HReferenceExpr,
    HStringLiteral, HTernaryExpr
} from '../utils'
const I_NumberLiteral:asm_factory=(data:HNumberLiteral,tool)=>{
    let name=tool.cache.pop()
    let id:number
    if(tool.pool.has(data.value))
        id=tool.pool.get(data.value)
    else {
        id=tool.id()
        tool.pool.set(data.value,id)
    }
    tool.code.push(['load',['reg',name],['value',id],['value',0]])
}
const I_StringLiteral:asm_factory=(data:HStringLiteral,tool)=>{
    let name=tool.cache.pop()
    let id:number
    if(tool.pool.has(data.value))
        id=tool.pool.get(data.value)
    else {
        id=tool.id()
        tool.pool.set(data.value,id)
    }
    tool.code.push(['load',['reg',name],['value',id],['value',0]])
}
const I_BooleanLiteral:asm_factory=(data:HBooleanLiteral,tool)=>{
    let name=tool.cache.pop()
    let id:number
    if(tool.pool.has(data.value?1:0))
        id=tool.pool.get(data.value?1:0)
    else {
        id=tool.id()
        tool.pool.set(data.value?1:0,id)
    }
    tool.code.push(['load',['reg',name],['value',id],['value',0]])
}
const I_NullLiteral:asm_factory=(data:HNullLiteral,tool)=>{
    let id:number
    let name=tool.cache.pop()
    if(tool.pool.has(0))
        id=tool.pool.get(0)
    else {
        id=tool.id()
        tool.pool.set(0,id)
    }
    tool.code.push(['load',['reg',name],['value',id],['value',0]])
}
const I_IdentifierExpr:asm_factory=(data:HIdentifierExpr,tool)=>{
    tool.code.push(['mov',['value',tool.cache.pop()],['value',data.name],['value',0]])
}
//offset [array/map] [index] [value]=>array/map[index]=value
const I_ArrayExpr:asm_factory=(data:HArrayExpr,tool)=>{
    let id=tool.cache.pop()
    let index=0
    let ls=tool.id()
    for(let i of data.elements){
        tool.cache.push(ls)
        tool.gen(i)
        tool.code.push(['offset_set',['reg',id],['reg',index++],['value',ls]])
    }
}
const I_MapExpr:asm_factory=(data:HMapExpr,tool)=>{
    let id=tool.cache.pop()
    let key_id=tool.id()
    let value_id=tool.id()
    for(let [k,v] of data.elements){
        tool.cache.push(key_id)
        tool.gen(new HStringLiteral(k))
        tool.cache.push(value_id)
        tool.gen(v)
        tool.code.push(['offset_set',['value',id],['value',key_id],['value',value_id]])
    }
}
const I_LambdaExpr:asm_factory=(data:HLambdaExpr,tool)=>{
    let id=tool.id()
    let block_id=tool.id()
    tool.code.push(['mov',['reg',id],['value',block_id],['value',0]])
    tool.gen(new HNumberLiteral(block_id))
    //代码生成
    tool.asm.set(block_id,[[],data.params])
    tool.push(block_id)
    /**
     * 等价于:
     * param_load 参数1 固定参数注入区第一个元素
     * param_load 参数2 固定参数注入区第二个元素
     * ...
     * 0预留给return
     */
    for(let i=1;i<tool.param.length+1;i++)
        tool.code.push(['param_load',['reg',tool.param[i-1]],['reg',i],['value',0]])
    tool.gen(data.commands)
    tool.pop()
}
//offset value [array/map] [index] =>value=array/map[index]
const I_IndexExpr:asm_factory=(data:HIndexExpr,tool)=>{
    let id=tool.cache.pop()
    let index_id=tool.id()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.cache.push(index_id)
    tool.gen(data.index)
    tool.code.push(['offset_get',['reg',id],['value',id],['value',index_id]])
}
const I_MemberExpr:asm_factory=(data:HMemberExpr,tool)=>{
    let id=tool.cache.pop()
    let index_id=tool.id()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.cache.push(index_id)
    tool.gen(data.member)
    tool.code.push(['offset_get',['reg',id],['value',id],['value',index_id]])
}
const I_PostfixIncrementExpr:asm_factory=(data:HPostIncrementExpr,tool)=>{
    tool.gen(data.target)
    tool.gen(new HAssign(data.target,new HBinaryExpr(data.target,'+',new HNumberLiteral(1))))
}
const I_PrefixIncrementExpr:asm_factory=(data:HPreIncrementExpr,tool)=>{
    tool.gen(new HAssign(data.target,new HBinaryExpr(data.target,'+',new HNumberLiteral(1))))
    tool.gen(data.target)
}
const I_PostfixDecrementExpr:asm_factory=(data:HPostDecrementExpr,tool)=>{
    tool.gen(data.target)
    tool.gen(new HAssign(data.target,new HBinaryExpr(data.target,'-',new HNumberLiteral(1))))
}
const I_PrefixDecrementExpr:asm_factory=(data:HPreDecrementExpr,tool)=>{
    tool.gen(new HAssign(data.target,new HBinaryExpr(data.target,'-',new HNumberLiteral(1))))
    tool.gen(data.target)
}
const I_ArgumentsExpr:asm_factory=(data:HArgumentsExpr, tool)=>{
    //要call的区域的指针
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.target)
    //用于参数设置
    let ls_id=tool.id()
    let index=1
    for(let i of data.args){
        tool.cache.push(ls_id)
        tool.gen(i)
        tool.code.push(['param_set',['reg',index++],['value',ls_id],['value',0]])
    }
    //将param全部压入栈
    for(let i=0;i<tool.param.length;i++)
        tool.code.push(['push',['reg',tool.param[i]],['value',0],['value',0]])
    //拿到返回值
    tool.code.push(['call',['value',id],['reg',1],['value',0]])
    //出栈
    for(let i=tool.param.length-1;i>=0;i--)
        tool.code.push(['pop',['reg',tool.param[i]],['value',0],['value',0]])
    tool.code.push(['param_load',['value',id],['reg',0],['value',0]])
}
const I_NotExpr:asm_factory=(data:HNotExpr,tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.code.push(['not',['reg',id],['value',0],['value',0]])
}
const I_BitNotExpr:asm_factory=(data:HBitNotExpr, tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.code.push(['bit_not',['reg',id],['value',0],['value',0]])
}
const I_MinusExpr:asm_factory=(data:HMinusExpr,tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.code.push(['sub',['reg',id],['reg',0],['value',id]])
}
const I_ReferenceExpr:asm_factory=(data:HReferenceExpr,tool)=>{
    let id=tool.cache.pop()
    let ls=tool.id()
    tool.cache.push(ls)
    tool.gen(data.target)
    //读出id的内存地址赋值
    tool.code.push(['mov',['value',id],['value',ls],['value',0]])
}
const I_AddressExpr:asm_factory=(data:HAddressExpr,tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.code.push(['mov',['reg',id],['reg',id],['value',0]])
}
const I_BinaryExpr:asm_factory=(data:HBinaryExpr,tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.left)
    let right_id=tool.id()
    tool.cache.push(right_id)
    tool.gen(data.right)
    if(tool.BinaryDict.has(data.op))
        tool.code.push([tool.BinaryDict.get(data.op),['reg',id],['value',right_id],['value',0]])
    //==,!=,>=,<=,>,<
    if(tool.CmpDict.has(data.op))
        tool.code.push(['cmp',['reg',id],['value',right_id],['reg',tool.CmpDict.get(data.op)]])
    //&&,||
    if(data.op=='&&')
        tool.gen(new HIfStatement(
            new HBinaryExpr(id,'==',new HBooleanLiteral(false)),
            new HAssign(id,new HBooleanLiteral(false)),
            new HAssign(id,new HBinaryExpr(id,'&',right_id))
        ))
    if(data.op=='||')
        tool.gen(new HIfStatement(
            new HBinaryExpr(id,'==',new HBooleanLiteral(true)),
            new HAssign(id,new HBooleanLiteral(true)),
            new HAssign(id,new HBinaryExpr(id,'|',right_id))
        ))
}
const I_TernaryExpr:asm_factory=(data:HTernaryExpr,tool)=> {
    let id = tool.cache.pop()
    let cond = tool.id()
    let te = tool.id()
    let fe = tool.id()
    tool.cache.push(cond)
    tool.gen(data.condition)
    tool.cache.push(te)
    tool.gen(data.trueExpr)
    tool.cache.push(fe)
    tool.gen(data.falseExpr)
    tool.gen(new HIfStatement(
        new HBinaryExpr(id,'==',new HBooleanLiteral(true)),
        new HAssign(id,te),
        new HAssign(id,fe)
    ))
}
export default new Map<any,asm_factory>([
    [HNumberLiteral,I_NumberLiteral],
    [HStringLiteral,I_StringLiteral],
    [HBooleanLiteral,I_BooleanLiteral],
    [HNullLiteral,I_NullLiteral],
    [HIdentifierExpr,I_IdentifierExpr],
    [HArrayExpr,I_ArrayExpr],
    [HMapExpr,I_MapExpr],
    [HLambdaExpr,I_LambdaExpr],
    [HIndexExpr,I_IndexExpr],
    [HMemberExpr,I_MemberExpr],
    [HPostDecrementExpr,I_PostfixDecrementExpr],
    [HPostIncrementExpr,I_PostfixIncrementExpr],
    [HPreDecrementExpr,I_PrefixDecrementExpr],
    [HPreIncrementExpr,I_PrefixIncrementExpr],
    [HArgumentsExpr,I_ArgumentsExpr],
    [HNotExpr,I_NotExpr],
    [HBitNotExpr,I_BitNotExpr],
    [HMinusExpr,I_MinusExpr],
    [HReferenceExpr,I_ReferenceExpr],
    [HAddressExpr,I_AddressExpr],
    [HBinaryExpr,I_BinaryExpr],
    [HTernaryExpr,I_TernaryExpr]
])