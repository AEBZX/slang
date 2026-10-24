import {BinaryDict, CmpDict, container_element, container_of, fast_call, inc_place_target, inc_slot, is_place_target, read, slang_ir_factory} from './tool'
import {
    BINARY, BIT_NOT, CALL, CMP, CZ, HAddressExpr, HArgumentsExpr,
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
    //offset index elements
    for (const [index, element] of data.elements.entries())
        tool.push(new OFFSET_SET(array,tool._pool(index),container_element(element,tool,call)))
}
const I_MapExpr:slang_ir_factory=(data:HMapExpr,tool,call)=>{
    const map=tool.ls_arg
    for(const [key,value] of data.elements)
        tool.push(new OFFSET_SET(map,tool._pool(key),container_element(value,tool,call)))
}
const I_LambdaExpr:slang_ir_factory=(data:HLambdaExpr,tool,call)=>{
    const reg=tool.ls_arg
    const block_id=tool.block_id
    const param=tool.current_param
    const lambda_id=tool.entry?0:tool.create()
    tool.block_id=lambda_id
    tool.set_param(data.params)
    //param_load依次取所有东西
    //0预留给return
    for(const [index,id] of data.params.entries())
        tool.push(new PARAM_LOAD(IRArgs.reg(id),IRArgs.reg(index+1)))
    call(data.commands)
    tool.block_id=block_id
    tool.current_param=param
    //lambda变量就是存储block_id
    tool.ls_arg=reg
    call(new HNumberLiteral(lambda_id))
}
const I_IndexExpr:slang_ir_factory=(data:HIndexExpr,tool,call)=>{
    const mov_data=tool.ls_arg
    //容器用槽号本身:和 offset_set 的 a 同一身份
    const data_id=container_of(data.target,tool,call)
    const offset_id=fast_call(IRArgs.reg(tool.id()),data.index,tool,call)
    if(tool.index_address){
        tool.push(data.is_string?new OFFSET_STR_ADDR(mov_data,data_id,offset_id):new OFFSET_ADDR(mov_data,data_id,offset_id))
        tool.index_address=false
        return
    }
    tool.push(data.is_string?new OFFSET_STR_GET(mov_data,data_id,offset_id):new OFFSET_GET(mov_data,data_id,offset_id))
}
const I_MemberExpr:slang_ir_factory=(data:HMemberExpr,tool,call)=>{
    const mov_data=tool.ls_arg
    //成员是静态的,键直接用池 id 原样;对象要取槽里的值
    const data_id=container_of(data.target,tool,call)
    //成员名是字符串常量,走 _pool:搬进槽后以读槽形式引用
    const offset_id=tool._pool(data.member)
    if(tool.index_address){
        tool.push(new OFFSET_ADDR(mov_data,data_id,offset_id))
        tool.index_address=false
        return
    }
    tool.push(new OFFSET_GET(mov_data,data_id,offset_id))
}
const I_PostfixIncrementOrDecrement:slang_ir_factory=(data:HPostIncrementExpr|HPostDecrementExpr,tool,call)=>{
    const result=tool.ls_arg
    const op=data instanceof HPostIncrementExpr?'add':'sub'
    if(is_place_target(data.target)){
        tool.push(new MOV(result,inc_place_target(data,tool,call,op,false)))
        return
    }
    const slot=inc_slot(data)
    if(slot==null){
        //复杂目标:先求值再自增
        const target_data=fast_call(IRArgs.reg(tool.id()),data.target,tool,call)
        tool.push(new BINARY(op,IRArgs.reg(tool.id()),target_data,IRArgs.reg(1)))
        return
    }
    //后缀:表达式的结果是旧值,然后槽里的值自增
    tool.push(new MOV(result,IRArgs.value(slot)))
    tool.push(new BINARY(data instanceof HPostIncrementExpr?'add':'sub',IRArgs.reg(slot),IRArgs.value(slot),IRArgs.reg(1)))
}
const I_PrefixIncrementOrDecrement:slang_ir_factory=(data:HPreIncrementExpr|HPreDecrementExpr,tool,call)=>{
    const result=tool.ls_arg
    const op=data instanceof HPreIncrementExpr?'add':'sub'
    if(is_place_target(data.target)){
        tool.push(new MOV(result,inc_place_target(data,tool,call,op,true)))
        return
    }
    const slot=inc_slot(data)
    if(slot==null){
        const target_data=fast_call(IRArgs.reg(tool.id()),data.target,tool,call)
        tool.push(new BINARY(op,result,target_data,IRArgs.reg(1)))
        return
    }
    //前缀:先自增,表达式的结果是新值
    tool.push(new BINARY(data instanceof HPreIncrementExpr?'add':'sub',IRArgs.reg(slot),IRArgs.value(slot),IRArgs.reg(1)))
    tool.push(new MOV(result,IRArgs.value(slot)))
}
const I_ArgumentsExpr:slang_ir_factory=(data:HArgumentsExpr,tool,call)=>{
    const ls_arg=tool.ls_arg
    //push所有param
    for(const arg of tool.get_param())
        tool.push(new PUSH(IRArgs.reg(arg)))
    //装参数:每个实参各占一个槽
    for(const [index,arg] of data.args.entries())
        tool.push(new PARAM_SET(IRArgs.reg(index+1),fast_call(IRArgs.reg(tool.id()),arg,tool,call)))
    //被调用者:它的值(块号)要读出来当跳转目标
    const arg_id=fast_call(IRArgs.reg(tool.id()),data.target,tool,call)
    tool.push(new CALL(arg_id,IRArgs.reg(1)))
    //拿到返回值
    tool.push(new PARAM_LOAD(ls_arg,IRArgs.reg(0)))
    for(const i of tool.get_param())
        tool.push(new POP())
}
const I_NotOrBitNotExpr:slang_ir_factory=(data:HBitNotExpr|HNotExpr,tool,call)=>{
    const ls_arg=tool.ls_arg
    call(data.target)
    //取反
    tool.push(data instanceof HNotExpr?new NOT(ls_arg,read(ls_arg)):new BIT_NOT(ls_arg,read(ls_arg)))
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
    if(data.target instanceof HMemberExpr||data.target instanceof HIndexExpr){
        tool.index_address=true
        call(data.target)
    }
    if(data.target instanceof HIdentifierExpr)
        tool.push(new MOV(ls_arg,IRArgs.value(data.target.name)))
}
const I_BinaryExpr:slang_ir_factory=(data:HBinaryExpr,tool,call)=>{
    const arg=tool.ls_arg
    const left_arg=IRArgs.reg(tool.id())
    const right_arg=IRArgs.reg(tool.id())
    const left=fast_call(left_arg,data.left,tool,call)
    const right=fast_call(right_arg,data.right,tool,call)
    //二元运算:结果写进 arg,两个操作数取槽里的值
    if(Array.from(BinaryDict.keys()).includes(data.op))
        tool.push(new BINARY(BinaryDict.get(data.op),arg,left,right))
    if(Array.from(CmpDict.keys()).includes(data.op)){
        //cmp 的第一个操作数既当目标又当左值(就地),所以给槽号;右值与运算符编号取值
        tool.push(new CMP(left_arg,right,IRArgs.reg(CmpDict.get(data.op))))
        tool.push(new MOV(arg,left))
    }
}
const I_TernaryExpr:slang_ir_factory=(data:HTernaryExpr,tool,call)=>{
    const arg=tool.ls_arg
    const block_id=tool.block_id
    const true_id=tool.create()
    const false_id=tool.create()
    //条件要留在槽里:后面既要比值又要就地取反
    const condition_reg=IRArgs.reg(tool.id())
    const condition=fast_call(condition_reg,data.condition,tool,call)
    const true_arg=fast_call(IRArgs.reg(tool.id()),data.trueExpr,tool,call)
    const false_arg=fast_call(IRArgs.reg(tool.id()),data.falseExpr,tool,call)
    //建立块
    tool.block_id=true_id
    tool.push(new MOV(arg,true_arg))
    tool.block_id=false_id
    tool.push(new MOV(arg,false_arg))
    tool.block_id=block_id
    //判真和 if 一致用非零:条件留在槽里,判真跳 true,就地取非再判 false
    tool.push(new CZ(IRArgs.reg(true_id),IRArgs.reg(0),condition))
    tool.push(new NOT(condition_reg,read(condition_reg)))
    tool.push(new CZ(IRArgs.reg(false_id),IRArgs.reg(0),condition))
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