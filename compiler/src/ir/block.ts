import {expr_set, slang_ir_factory} from './tool'
import {HModule, HVariable, IRArgs, JMP, MOV} from '../utils'

const G_Variable:slang_ir_factory=(data:HVariable,tool,call)=>{
    const value_id=tool.id()
    if(data.entry)tool.entry_id=value_id
    expr_set(IRArgs.reg(value_id),data.value,tool,call)
    tool.code.get(0).push(new MOV(IRArgs.reg(data.name),IRArgs.reg(value_id)))
}
const G_Module:slang_ir_factory=(data:HModule,tool,call)=>{
    data.children.forEach(call)
    tool.block_id=0
    tool.push(new JMP(IRArgs.reg(tool.entry_id),IRArgs.reg(1)))
}
export default new Map<any,slang_ir_factory>([
    [HModule,G_Module],
    [HVariable,G_Variable]
])