import {BinaryDict, CmpDict, fast_call, slang_ir_factory} from './tool'
import {
    BINARY, CALL, CMP, CZ, HAddressExpr, HArgumentsExpr,
    HArrayExpr, HBinaryExpr, HBitNotExpr,
    HBooleanLiteral,
    HIdentifierExpr, HIndexExpr, HLambdaExpr, HLiteral, HMapExpr, HMemberExpr, HNotExpr,
    HNullLiteral,
    HNumberLiteral, HPostDecrementExpr, HPostIncrementExpr, HPreDecrementExpr, HPreIncrementExpr, HReferenceExpr,
    HStringLiteral, HTernaryExpr, HVariable,
    IRArgs,
    LOAD,
    MOV, NOT, OFFSET_ADDR, OFFSET_GET, OFFSET_SET, OFFSET_STR_ADDR, OFFSET_STR_GET, PARAM_LOAD, PARAM_SET, POP, PUSH
} from '../utils'
const I_Literal:slang_ir_factory=(data:HNumberLiteral|HStringLiteral|HBooleanLiteral|HNullLiteral,tool,call)=>{
    let value:string|number=null
    if(data instanceof HNullLiteral)value='\0'
    if(data instanceof HNumberLiteral||data instanceof HStringLiteral)value=data.value
    if(data instanceof HBooleanLiteral)value=data.value?1:0
    const id=tool.add(value)
    tool.push(new LOAD(tool.ls_arg,IRArgs.reg(id)))
}
const I_IdentifierExpr:slang_ir_factory=(data:HIdentifierExpr,tool,call)=>{
    tool.push(new MOV(tool.ls_arg,IRArgs.value(data.name)))
}
const I_ArrayExpr:slang_ir_factory=(data:HArrayExpr,tool,call)=> {
    const array = tool.ls_arg
    const ls_id = tool.id()
    //offset index elements
    for (const [index, element] of data.elements.entries()) {
        tool.ls_arg = IRArgs.reg(ls_id)
        call(element)
        tool.push(new OFFSET_SET(array,tool._pool(index), tool.ls_arg))
    }
}
const I_MapExpr:slang_ir_factory=(data:HMapExpr,tool,call)=>{
    const map=tool.ls_arg
    const ls_id=tool.id()
    for(const [key,value] of data.elements){
        tool.ls_arg=IRArgs.reg(ls_id)
        call(value)
        tool.push(new OFFSET_SET(map,tool._pool(key),tool.ls_arg))
    }
}
const I_LambdaExpr:slang_ir_factory=(data:HLambdaExpr,tool,call)=>{
    const reg=tool.ls_arg
    const block_id=tool.block_id
    const lambda_id=tool.entry?0:tool.create()
    tool.block_id=lambda_id
    tool.set_param(data.params)
    //param_load依次取所有东西
    //0预留给return
    for(const [index,id] of data.params.entries())
        tool.push(new PARAM_LOAD(IRArgs.reg(id),tool._pool(index+1)))
    call(data.commands)
    tool.block_id=block_id
    //lambda变量就是存储block_id
    tool.ls_arg=reg
    call(new HNumberLiteral(lambda_id))
}
const I_IndexExpr:slang_ir_factory=(data:HIndexExpr,tool,call)=>{
    const mov_data=tool.ls_arg
    const data_id=IRArgs.reg(tool.id())
    tool.ls_arg=data_id
    call(data.target)
    const offset_id=IRArgs.reg(tool.id())
    tool.ls_arg=offset_id
    call(data.index)
    if(tool.index_address){
        tool.push(data.is_string?new OFFSET_STR_ADDR(mov_data,data_id,offset_id):new OFFSET_ADDR(mov_data,data_id,offset_id))
        tool.index_address=false
        return
    }
    tool.push(data.is_string?new OFFSET_STR_GET(mov_data,data_id,offset_id):new OFFSET_GET(mov_data,data_id,offset_id))
}
const I_MemberExpr:slang_ir_factory=(data:HMemberExpr,tool,call)=>{
    const mov_data=tool.ls_arg
    const data_id=IRArgs.reg(tool.id())
    tool.ls_arg=data_id
    call(data.target)
    const offset_id=IRArgs.reg(tool.add(data.member))
    if(tool.index_address){
        tool.push(new OFFSET_ADDR(mov_data,data_id,offset_id))
        tool.index_address=false
        return
    }
    tool.push(new OFFSET_GET(mov_data,data_id,offset_id))
}
const I_PostfixIncrementOrDecrement:slang_ir_factory=(data:HPostIncrementExpr|HPostDecrementExpr,tool,call)=>{
    //先赋值
    call(data.target)
    //拿到target的地址
    let target_address=fast_call(IRArgs.reg(tool.id()),data.target,tool,call)
    target_address.type='value'
    const target_data=fast_call(IRArgs.reg(tool.id()),data.target,tool,call)
    tool.push(new BINARY(data instanceof HPostIncrementExpr?'add':'sub',target_address,target_data,tool._pool(1)))
}
const I_PrefixIncrementOrDecrement:slang_ir_factory=(data:HPreIncrementExpr|HPreDecrementExpr,tool,call)=>{
    const target=tool.ls_arg
    call(data.target)
    //++i等价于先+在赋值,或者说a=i,a++
    tool.push(new BINARY(data instanceof HPreIncrementExpr?'add':'sub',target,target,tool._pool(1)))
}
const I_ArgumentsExpr:slang_ir_factory=(data:HArgumentsExpr,tool,call)=>{
    const ls_arg=tool.ls_arg
    //push所有param
    for(const arg of tool.get_param())
        tool.push(new PUSH(IRArgs.reg(arg)))
    //装参数
    const arg_id=IRArgs.reg(tool.id())
    for(const [index,arg] of data.args.entries()){
        tool.ls_arg=arg_id
        call(arg)
        tool.push(new PARAM_SET(IRArgs.reg(index+1),arg_id))
    }
    tool.ls_arg=arg_id
    call(data.target)
    tool.push(new CALL(arg_id,tool._pool(1)))
    //拿到返回值
    tool.push(new PARAM_LOAD(ls_arg,tool._pool(0)))
    for(const arg of tool.get_param())
        tool.push(new POP(IRArgs.reg(arg)))
}
const I_NotOrBitNotExpr:slang_ir_factory=(data:HBitNotExpr|HNotExpr,tool,call)=>{
    const ls_arg=tool.ls_arg
    call(data.target)
    //取反
    tool.push(new NOT(ls_arg))
}
const I_ReferenceExpr:slang_ir_factory=(data:HReferenceExpr,tool,call)=>{
    const ls_arg=tool.ls_arg
    const reference_arg=IRArgs.value(ls_arg.data)
    call(data.target)
    tool.push(new MOV(ls_arg,reference_arg))
}
const I_AddressExpr:slang_ir_factory=(data:HAddressExpr,tool,call)=>{
    const ls_arg=tool.ls_arg
    if(data.target instanceof HReferenceExpr)call(data.target.target)
    if(data.target instanceof HMemberExpr||data instanceof HIndexExpr){
        tool.index_address=true
        call(data.target)
    }
    if(data.target instanceof HIdentifierExpr)
        tool.push(new MOV(ls_arg,IRArgs.reg(data.target.name)))
}
const I_BinaryExpr:slang_ir_factory=(data:HBinaryExpr,tool,call)=>{
    const arg=tool.ls_arg
    const left_arg=IRArgs.reg(tool.id())
    const right_arg=IRArgs.reg(tool.id())
    fast_call(left_arg,data.left,tool,call)
    fast_call(right_arg,data.right,tool,call)
    if(Array.from(BinaryDict.keys()).includes(data.op))
        tool.push(new BINARY(BinaryDict.get(data.op),arg,left_arg,right_arg))
    if(Array.from(CmpDict.keys()).includes(data.op)){
        tool.push(new CMP(left_arg,right_arg,tool._pool(CmpDict.get(data.op))))
        tool.push(new MOV(arg,left_arg))
    }
}
const I_TernaryExpr:slang_ir_factory=(data:HTernaryExpr,tool,call)=>{
    const arg=tool.ls_arg
    const block_id=tool.block_id
    const true_id=tool.create()
    const false_id=tool.create()
    const condition_arg=IRArgs.reg(tool.id())
    const true_arg=IRArgs.reg(tool.id())
    const false_arg=IRArgs.reg(tool.id())
    fast_call(condition_arg,data.condition,tool,call)
    fast_call(true_arg,data.trueExpr,tool,call)
    fast_call(false_arg,data.falseExpr,tool,call)
    //建立块
    tool.block_id=true_id
    tool.push(new MOV(arg,true_arg))
    tool.block_id=false_id
    tool.push(new MOV(arg,false_arg))
    tool.block_id=block_id
    //data.condition是不是1
    const cmp_arg=IRArgs.reg(tool.id())
    tool.push(new CMP(cmp_arg,condition_arg,tool._pool(CmpDict.get('=='))))
    tool.push(new CZ(tool._pool(true_id),tool._pool(0),cmp_arg))
    tool.push(new NOT(cmp_arg))
    tool.push(new CZ(tool._pool(false_id),tool._pool(0),cmp_arg))
}
export default new Map<any,slang_ir_factory>([
    [HLiteral,I_Literal],
    [HIdentifierExpr,I_IdentifierExpr],
    [HArrayExpr,I_ArrayExpr],
    [HMapExpr,I_MapExpr],
    [HLambdaExpr,I_LambdaExpr],
    [HIndexExpr,I_IndexExpr],
    [HMemberExpr,I_MemberExpr],
    [HPostIncrementExpr,I_PostfixIncrementOrDecrement],
    [HPostDecrementExpr,I_PostfixIncrementOrDecrement],
    [HPreIncrementExpr,I_PrefixIncrementOrDecrement],
    [HPreDecrementExpr,I_PrefixIncrementOrDecrement],
    [HArgumentsExpr,I_ArgumentsExpr],
    [HBitNotExpr,I_NotOrBitNotExpr],
    [HNotExpr,I_NotOrBitNotExpr],
    [HReferenceExpr,I_ReferenceExpr],
    [HAddressExpr,I_AddressExpr],
    [HBinaryExpr,I_BinaryExpr],
    [HTernaryExpr,I_TernaryExpr],
])