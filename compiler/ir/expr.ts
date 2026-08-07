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
    let id=tool.id()
    let name=tool.cache.pop()
    tool.pool.set(data.value,id)
    tool.code.push(['load',['value',name],['value',id],['value',0]])
}
const I_StringLiteral:asm_factory=(data:HStringLiteral,tool)=>{
    let id=tool.id()
    let name=tool.cache.pop()

    tool.pool.set(data.value,id)
    tool.code.push(['load',['value',name],['value',id],['value',0]])
}
const I_BooleanLiteral:asm_factory=(data:HBooleanLiteral,tool)=>{
    let id=tool.id()
    let name=tool.cache.pop()
    tool.pool.set(data.value?1:0,id)
    tool.code.push(['load',['value',name],['value',id],['value',0]])
}
const I_NullLiteral:asm_factory=(data:HNullLiteral,tool)=>{
    let id=tool.id()
    let name=tool.cache.pop()
    tool.pool.set(0,id)
    tool.code.push(['load',['value',name],['value',id],['value',0]])
}
const I_IdentifierExpr:asm_factory=(data:HIdentifierExpr,tool)=>{
    tool.code.push(['mov',['value',tool.cache.pop()],['value',data.name],['value',0]])
}
const I_ArrayExpr:asm_factory=(data:HArrayExpr,tool)=>{
    let id=tool.cache.pop()
    let index=0
    let ls=tool.id()
    for(let i of data.elements){
        tool.cache.push(ls)
        tool.gen(i)
        tool.code.push(['offset',['value',id],['reg',index++],['value',ls]])
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
        tool.code.push(['offset',['value',id],['value',key_id],['value',value_id]])
    }
}
const I_LambdaExpr:asm_factory=(data:HLambdaExpr,tool)=>{
    let block_id=tool.id()
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
    for(let i=1;i<tool.param.length+1;i++){
        tool.code.push(['param_load',['value',tool.param[i-1]],['value',i],['value',0]])
    }
    tool.gen(data.commands)
    tool.pop()
}
const I_IndexExpr:asm_factory=(data:HIndexExpr,tool)=>{
    let id=tool.cache.pop()
    let index_id=tool.id()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.cache.push(index_id)
    tool.gen(data.index)
    tool.code.push(['offset',['value',id],['value',index_id],['value',0]])
}
const I_MemberExpr:asm_factory=(data:HMemberExpr,tool)=>{
    let id=tool.cache.pop()
    let index_id=tool.id()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.cache.push(index_id)
    tool.gen(data.member)
    tool.code.push(['offset',['value',id],['value',index_id],['value',0]])
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
    //拿到返回值
    tool.code.push(['call',['reg',id],['reg',1],['value',0]])
    tool.code.push(['param_load',['value',id],['reg',0],['value',0]])
}
const I_NotExpr:asm_factory=(data:HNotExpr,tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.code.push(['not',['value',id],['value',0],['value',0]])
}
const I_BitNotExpr:asm_factory=(data:HBitNotExpr, tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.code.push(['bit_not',['value',id],['value',0],['value',0]])
}
const I_MinusExpr:asm_factory=(data:HMinusExpr,tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.code.push(['sub',['value',id],['reg',0],['value',id]])
}
const I_ReferenceExpr:asm_factory=(data:HReferenceExpr,tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.code.push(['mov',['reg',id],['value',id],['value',0]])
}
const I_AddressExpr:asm_factory=(data:HAddressExpr,tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.code.push(['mov',['value',id],['reg',id],['value',0]])
}
const BinaryDict=new Map([
    ['+','add'],
    ['-','sub'],
    ['*','mul'],
    ['/','div'],
    ['%','mod'],
    ['>>','shr'],
    ['<<','shl'],
    ['&','and'],
    ['|','or'],
    ['^','xor']
])
const CmpDict=new Map([
    ['==',0],
    ['!=',1],
    ['>',2],
    ['<',3],
    ['>=',4],
    ['<=',5]
])
const I_BinaryExpr:asm_factory=(data:HBinaryExpr,tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.left)
    let right_id=tool.id()
    tool.cache.push(right_id)
    tool.gen(data.right)
    if(BinaryDict.has(data.op))
        tool.code.push([BinaryDict.get(data.op),['value',id],['value',right_id],['value',0]])
    //==,!=,>=,<=,>,<
    if(CmpDict.has(data.op))
        tool.code.push(['cmp',['value',id],['value',right_id],['reg',CmpDict.get(data.op)]])
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