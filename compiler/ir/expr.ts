import {fast_call, slang_ir_factory} from './tool'
import {
    AddressPrefix,
    BINARY, HAddressExpr,
    HArrayExpr,
    HBooleanLiteral,
    HIdentifierExpr, HIndexExpr, HLambdaExpr, HMapExpr, HMemberExpr,
    HNullLiteral,
    HNumberLiteral, HPostDecrementExpr, HPostIncrementExpr, HPreDecrementExpr, HPreIncrementExpr,
    HStringLiteral, HVariable,
    IRArgs,
    LOAD,
    MOV, OFFSET_ADDR, OFFSET_GET, OFFSET_SET, OFFSET_STR_ADDR, OFFSET_STR_GET, PARAM_LOAD
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
    tool.ls_arg = IRArgs.reg(ls_id)
    //offset index elements
    for (const [index, element] of data.elements.entries()) {
        call(element)
        tool.push(new OFFSET_SET(array, IRArgs.reg(tool.add(index)), tool.ls_arg))
    }
}
const I_MapExpr:slang_ir_factory=(data:HMapExpr,tool,call)=>{
    const map=tool.ls_arg
    const ls_id=tool.id()
    tool.ls_arg=IRArgs.reg(ls_id)
    for(const [key,value] of data.elements){
        call(value)
        tool.push(new OFFSET_SET(map,IRArgs.reg(tool.add(key)),tool.ls_arg))
    }
}
const I_LambdaExpr:slang_ir_factory=(data:HLambdaExpr,tool,call)=>{
    const reg=tool.ls_arg
    const block_id=tool.block_id
    const lambda_id=tool.create()
    tool.block_id=lambda_id
    //param_load依次取所有东西
    for(const [index,id] of data.params.entries())
        tool.push(new PARAM_LOAD(IRArgs.reg(id),IRArgs.reg(tool.add(index))))
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
    const one=fast_call(IRArgs.reg(tool.id()),new HNumberLiteral(1),tool,call)
    tool.push(new BINARY(data instanceof HPostIncrementExpr?'+':'-',target_address,target_data,one))
}
const I_PrefixIncrementOrDecrement:slang_ir_factory=(data:HPreIncrementExpr|HPreDecrementExpr,tool,call)=>{
    const target=tool.ls_arg
    call(data.target)
    //++i等价于先+在赋值,或者说a=i,a++
    const one=fast_call(IRArgs.reg(tool.id()),new HNumberLiteral(1),tool,call)
    tool.push(new BINARY(data instanceof HPreIncrementExpr?'+':'-',target,target,one))
}