import {
    HArrayExpr, HMapExpr,
    CALL, CZ,
    HAssign, HAwait,
    HExprCommand,
    HIdentifierExpr, HIfStatement,
    HIndexExpr, HListCommand,
    HMemberExpr,
    HReferenceExpr, HReturn, HVM,
    IRArgs, JMP, JZ, ListCommand,
    MOV, NOT,
    OFFSET_SET,
    OFFSET_STR_SET, PARAM_SET, RET, THREAD, TZ, VM, HTryStatement, INT_GET, HThrow, INT, LabelCommand, HLabel,
    GotoCommand, HGoto
} from '../utils'
import {container_of, fast_call, read, slang_ir_factory, VMMap} from './tool'
import {slang_check_visitor} from "../check/tool";
const I_Assign:slang_ir_factory=(data:HAssign,tool,call)=>{
    if(data.data instanceof HIdentifierExpr&&(data.value instanceof HArrayExpr||data.value instanceof HMapExpr)){
        tool.ls_arg=IRArgs.reg(data.data.name)
        call(data.value)
        return
    }
    const value_arg=fast_call(IRArgs.reg(tool.id()),data.value,tool,call)
    if(data.data instanceof HIdentifierExpr)
        tool.push(new MOV(IRArgs.reg(data.data.name),value_arg))
    if(data.data instanceof HMemberExpr||data.data instanceof HIndexExpr){
        //对象取槽里的值;成员键是静态的,直接用池 id;下标要取值
        //容器用槽号本身(和 offset_set 的 a 同一身份)
        const data_arg=container_of(data.data.target,tool,call)
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
    tool.push(new THREAD(IRArgs.reg(id),IRArgs.reg(0)))
}
const I_ListCommand:slang_ir_factory=(data:HListCommand,tool,call)=>{
    data.commands.forEach(call)
}
const I_ExprCommand:slang_ir_factory=(data:HExprCommand,tool,call)=>{
    call(data.data)
}
const I_Return:slang_ir_factory=(data:HReturn,tool,call)=>{
    const ret=fast_call(IRArgs.reg(tool.id()),data.data,tool,call)
    tool.push(new PARAM_SET(IRArgs.reg(0),ret))
    tool.push(new RET(IRArgs.reg(1)))
}
const I_If:slang_ir_factory=(data:HIfStatement,tool,call)=>{
    const id=tool.block_id
    const condition=IRArgs.reg(tool.id())
    const condition_value=fast_call(condition,data.condition,tool,call)
    const true_id=tool.create()
    const false_id=tool.create()
    tool.block_id=true_id
    call(data.commands)
    tool.block_id=false_id
    call(data.else_)
    tool.block_id=id
    tool.push(new CZ(IRArgs.reg(true_id),IRArgs.reg(0),condition_value))
    tool.push(new NOT(condition,read(condition)))
    tool.push(new CZ(IRArgs.reg(false_id),IRArgs.reg(0),read(condition)))
}
const I_VM:slang_ir_factory=(data:HVM,tool,call)=>{
    let param_list:IRArgs[]=[]
    for(const [index,param] of data.param.entries()){
        const arg=IRArgs.reg(tool.id())
        tool.ls_arg=arg
        call(param)
        param_list[index]=arg
    }
    tool.push(VMMap.get(data.data)(...param_list))
}
const I_Try:slang_ir_factory=(data:HTryStatement,tool,call)=>{
    const now=tool.block_id
    const try_block_id=tool.create()
    const catch_block_id=tool.create()
    const finally_block_id=tool.create()
    tool.push(new CALL(IRArgs.reg(try_block_id),IRArgs.reg(0)))
    tool.block_id=try_block_id
    call(data.try_)
    tool.push(new CALL(IRArgs.reg(finally_block_id),IRArgs.reg(0)))
    tool.block_id=catch_block_id
    tool.push(new INT_GET(IRArgs.reg(data.iden)))
    call(data.catch_)
    tool.push(new CALL(IRArgs.reg(finally_block_id),IRArgs.reg(0)))
    tool.block_id=finally_block_id
    call(data.finally_)
    tool.block_id=now
}
const I_Throw:slang_ir_factory=(data:HThrow,tool,call)=>{
    const arg=IRArgs.reg(tool.id())
    tool.ls_arg=arg
    call(data.data)
    tool.push(new INT(arg))
}
const I_LabelCommand:slang_ir_factory=(data:HLabel,tool,call)=>{
    //最后标签要jmp,且后续生成代码所在的块
    const label=tool.create(tool.label_id(data.name))
    tool.push(new JMP(IRArgs.reg(label),IRArgs.reg(0)))
    //之后代码全会生成在label里
    tool.block_id=label
}
const I_GotoCommand:slang_ir_factory=(data:HGoto,tool,call)=>{
    tool.push(new JMP(IRArgs.reg(tool.label_id(data.label)),IRArgs.reg(0)))
}
export default new Map<any,slang_ir_factory>([
    [HAssign,I_Assign],
    [HAwait,I_Await],
    [HListCommand,I_ListCommand],
    [HExprCommand,I_ExprCommand],
    [HReturn,I_Return],
    [HIfStatement,I_If],
    [HVM,I_VM],
    [HTryStatement,I_Try],
    [HThrow,I_Throw],
    [HLabel,I_LabelCommand],
    [HGoto,I_GotoCommand]
])