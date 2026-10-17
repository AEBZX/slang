import {slang_ir_factory} from './tool'
import {HModule, HVariable, HVM, IRArgs, MOV, OFFSET_SET} from '../utils'
const I_Module:slang_ir_factory=(data:HModule,tool,call)=>{
    //文件级模块(name=null)没有容器槽,子模块不登记
    const high=tool.high
    const ls_arg=high?null:IRArgs.reg(data.name)
    if(high)tool.high=false
    const arg=IRArgs.reg(tool.id())
    for(const i of data.children){
        tool.ls_arg=arg
        call(i)
        if(ls_arg!=null)tool.push(new OFFSET_SET(ls_arg,tool._pool(i['name']),arg))
    }
    if(high)tool.high=true
    //找entry加入块0:只有真有 entry 才动块 0,免得把别的文件写好的 main 清掉
    const get_entry=(module:HModule)=>{
        for(const i of module.children){
            if(i instanceof HVariable&&i.entry)return i
            if(i instanceof HModule&&get_entry(i))return get_entry(i)
        }
    }
    const entry=get_entry(data)
    if(entry!=null){
        tool.entry=true
        tool.block_id=tool.create(0)
        call(entry)
        //entry 只对这一个函数有效,否则下一个文件里所有 lambda 都会挤进块 0
        tool.entry=false
    }
}
const I_Variable:slang_ir_factory=(data:HVariable,tool,call)=>{
    call(data.value)
}
export default new Map<any,slang_ir_factory>([
    [HModule,I_Module],
    [HVariable,I_Variable]
])
