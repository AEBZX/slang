import {
    Break,
    CALL, Continue, CZ,
    HAssign, HAwait,
    HIdentifierExpr, HIfStatement,
    HIndexExpr, HListCommand,
    HMemberExpr,
    HReferenceExpr, HReturn, HVM, HWhileStatement,
    IRArgs, JMP, JZ, ListCommand,
    MOV, NOT,
    OFFSET_SET,
    OFFSET_STR_SET, PARAM_SET, RET, THREAD, TZ, VM
} from '../utils'
import {fast_call, slang_ir_factory, VMMap} from './tool'
const I_Assign:slang_ir_factory=(data:HAssign,tool,call)=>{
    const value_arg=fast_call(IRArgs.reg(tool.id()),data.value,tool,call)
    if(data.data instanceof HIdentifierExpr)
        tool.push(new MOV(IRArgs.reg(data.data.name),value_arg))
    if(data.data instanceof HMemberExpr||data.data instanceof HIndexExpr){
        const data_arg=IRArgs.reg(tool.id())
        let offset_arg=IRArgs.reg(tool.id())
        fast_call(data_arg,data.data.target,tool,call)
        if(data.data instanceof HMemberExpr)
            offset_arg=tool._pool(data.data.member)
        if(data.data instanceof HIndexExpr)
            fast_call(offset_arg,data.data.index,tool,call)
        if(data.data instanceof HMemberExpr||!data.data.is_string)
            tool.push(new OFFSET_SET(data_arg,offset_arg,value_arg))
        else tool.push(new OFFSET_STR_SET(data_arg,offset_arg,value_arg))
    }
    if(data.data instanceof HReferenceExpr){
        let data_arg=fast_call(IRArgs.reg(tool.id()),data.data.target,tool,call)
        data_arg.type='value'
        tool.push(new MOV(data_arg,value_arg))
    }
}
const I_Await:slang_ir_factory=(data:HAwait,tool,call)=>{
    const block_id=tool.block_id
    const id=tool.create()
    tool.block_id=id
    call(data.command)
    tool.block_id=block_id
    tool.push(new THREAD(tool._pool(id),tool._pool(0)))
}
const I_ListCommand:slang_ir_factory=(data:HListCommand,tool,call)=>{
    data.commands.forEach(call)
}
const I_Return:slang_ir_factory=(data:HReturn,tool,call)=>{
    const ret=fast_call(IRArgs.reg(tool.id()),data.data,tool,call)
    tool.push(new PARAM_SET(tool._pool(0),ret))
    tool.push(new RET(tool._pool(1)))
}
const I_If:slang_ir_factory=(data:HIfStatement,tool,call)=>{
    const id=tool.block_id
    const condition_arg=fast_call(IRArgs.reg(tool.id()),data.condition,tool,call)
    const true_id=tool.create()
    const false_id=tool.create()
    tool.block_id=true_id
    call(data.commands)
    tool.block_id=false_id
    call(data.else_)
    tool.block_id=id
    tool.push(new CZ(condition_arg,tool._pool(true_id),tool._pool(0)))
    tool.push(new NOT(condition_arg))
    tool.push(new CZ(condition_arg,tool._pool(false_id),tool._pool(0)))
}
const I_While:slang_ir_factory=(data:HWhileStatement,tool,call)=>{
    const id=tool.block_id
    const loop_id=tool.create()
    tool.block_id=loop_id
    tool.loop_id.push(loop_id)
    const condition_arg=fast_call(IRArgs.reg(tool.id()),data.condition,tool,call)
    call(data.commands)
    tool.push(new CZ(tool._pool(loop_id),tool._pool(0),condition_arg))
    tool.loop_id.pop()
    tool.block_id=id
    tool.push(new CALL(tool._pool(loop_id),tool._pool(2)))
}
const I_Break:slang_ir_factory=(data:Break,tool,call)=>{
    tool.push(new RET(tool._pool(2)))
}
const I_Continue:slang_ir_factory=(data:Continue,tool,call)=>{
    tool.push(new JMP(tool._pool(tool.loop()),tool._pool(0)))
}
const I_VM:slang_ir_factory=(data:HVM,tool,call)=>{
    let param_list:IRArgs[]=[]
    for(const [index,param] of data.param.entries())
        param_list[index]=fast_call(IRArgs.reg(tool.id()),param,tool,call)
    tool.push(VMMap.get(data.data)(...param_list))
}
export default new Map<any,slang_ir_factory>([
    [HAssign,I_Assign],
    [HAwait,I_Await],
    [HListCommand,I_ListCommand],
    [HReturn,I_Return],
    [HIfStatement,I_If],
    [HWhileStatement,I_While],
    [Break,I_Break],
    [Continue,I_Continue],
    [HVM,I_VM],
])