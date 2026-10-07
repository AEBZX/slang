import {
    Break,
    CALL, Continue, CZ,
    HAssign, HAwait,
    HExprCommand,
    HIdentifierExpr, HIfStatement,
    HIndexExpr, HListCommand,
    HMemberExpr,
    HReferenceExpr, HReturn, HVM, HWhileStatement,
    IRArgs, JMP, JZ, ListCommand,
    MOV, NOT,
    OFFSET_SET,
    OFFSET_STR_SET, PARAM_SET, RET, THREAD, TZ, VM
} from '../utils'
import {fast_call, read, slang_ir_factory, VMMap} from './tool'
const I_Assign:slang_ir_factory=(data:HAssign,tool,call)=>{
    const value_arg=fast_call(IRArgs.reg(tool.id()),data.value,tool,call)
    if(data.data instanceof HIdentifierExpr)
        tool.push(new MOV(IRArgs.reg(data.data.name),value_arg))
    if(data.data instanceof HMemberExpr||data.data instanceof HIndexExpr){
        //对象取槽里的值;成员键是静态的,直接用池 id;下标要取值
        const data_arg=fast_call(IRArgs.reg(tool.id()),data.data.target,tool,call)
        let offset_arg=IRArgs.reg(tool.id())
        if(data.data instanceof HMemberExpr)
            offset_arg=tool._pool(data.data.member)
        if(data.data instanceof HIndexExpr)
            offset_arg=fast_call(offset_arg,data.data.index,tool,call)
        if(data.data instanceof HMemberExpr||!data.data.is_string)
            tool.push(new OFFSET_SET(data_arg,offset_arg,value_arg))
        else tool.push(new OFFSET_STR_SET(data_arg,offset_arg,value_arg))
    }
    if(data.data instanceof HReferenceExpr){
        //解引用写:目标本身是槽里的地址,所以用值形式
        const data_arg=fast_call(IRArgs.reg(tool.id()),data.data.target,tool,call)
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
//表达式语句:把表达式自己的指令发出来就行(结果没人用)
const I_ExprCommand:slang_ir_factory=(data:HExprCommand,tool,call)=>{
    call(data.data)
}
const I_Return:slang_ir_factory=(data:HReturn,tool,call)=>{
    const ret=fast_call(IRArgs.reg(tool.id()),data.data,tool,call)
    tool.push(new PARAM_SET(tool._pool(0),ret))
    tool.push(new RET(tool._pool(1)))
}
const I_If:slang_ir_factory=(data:HIfStatement,tool,call)=>{
    const id=tool.block_id
    //条件要留在槽里:一次判真跳,一次就地取反再判
    const condition=IRArgs.reg(tool.id())
    const condition_value=fast_call(condition,data.condition,tool,call)
    const true_id=tool.create()
    const false_id=tool.create()
    tool.block_id=true_id
    call(data.commands)
    tool.block_id=false_id
    call(data.else_)
    tool.block_id=id
    tool.push(new CZ(tool._pool(true_id),tool._pool(0),condition_value))
    tool.push(new NOT(condition))
    tool.push(new CZ(tool._pool(false_id),tool._pool(0),read(condition)))
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
    //内联指令的操作数先各自求值到一个槽,VMMap 再按该指令的语义决定哪个操作数取值、哪个取槽
    let param_list:IRArgs[]=[]
    for(const [index,param] of data.param.entries()){
        const arg=IRArgs.reg(tool.id())
        tool.ls_arg=arg
        call(param)
        param_list[index]=arg
    }
    tool.push(VMMap.get(data.data)(...param_list))
}
export default new Map<any,slang_ir_factory>([
    [HAssign,I_Assign],
    [HAwait,I_Await],
    [HListCommand,I_ListCommand],
    [HExprCommand,I_ExprCommand],
    [HReturn,I_Return],
    [HIfStatement,I_If],
    [HWhileStatement,I_While],
    [Break,I_Break],
    [Continue,I_Continue],
    [HVM,I_VM],
])