import {expr_set, slang_ir_factory} from './tool'
import {HModule, HVariable, IRArgs, JMP, MOV} from '../utils'

const G_Variable:slang_ir_factory=(data:HVariable,tool,call)=>{
    const value_id=tool.id()
    if(data.entry)tool.entry_id=value_id
    expr_set(IRArgs.reg(value_id),data.value,tool,call)
    tool.code.get(0).push(new MOV(IRArgs.reg(data.name),IRArgs.value(value_id)))
}
const G_Module:slang_ir_factory=(data:HModule,tool,call)=>{
    data.children.forEach(call)
    tool.block_id=0
    const last_ins=tool.code.get(0)[tool.code.get(0).length-1]
    if(last_ins instanceof JMP&&last_ins.target.type=='value'&&last_ins.target.data==tool.entry_id)
        return
    tool.code.get(0).push(new JMP(IRArgs.value(tool.entry_id),IRArgs.reg(0)))
}
export default new Map<any,slang_ir_factory>([
    [HModule,G_Module],
    [HVariable,G_Variable]
])