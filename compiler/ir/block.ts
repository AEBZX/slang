import {slang_ir_factory} from './tool'
import {HModule, HVariable, HVM, IRArgs, MOV, OFFSET_SET} from '../utils'
const I_Module:slang_ir_factory=(data:HModule,tool,call)=>{
    const ls_arg=tool.high?tool.ls_arg:IRArgs.reg(data.name)
    const high=tool.high
    if(high)tool.high=false
    const arg=IRArgs.reg(tool.id())
    for(const i of data.children){
        tool.ls_arg=arg
        call(i)
        tool.push(new OFFSET_SET(ls_arg,tool._pool(i['name']),arg))
    }
    if(high)tool.high=true
    //在main(0)顶部加
    if(tool.high){
        tool.block_id=tool.create(0)
        tool.push(new MOV(IRArgs.reg(data.name),ls_arg))
    }
    //找entry加入块0
    const get_entry=(module:HModule)=>{
        for(const i of module.children){
            if(i instanceof HVariable&&i.entry)return i
            if(i instanceof HModule&&get_entry(i))return get_entry(i)
        }
    }
    tool.entry=true
    tool.block_id=tool.create(0)
    call(get_entry(data))
}
const I_Variable:slang_ir_factory=(data:HVariable,tool,call)=>{
    call(data.value)
}
export default new Map<any,slang_ir_factory>([
    [HModule,I_Module],
    [HVariable,I_Variable]
])