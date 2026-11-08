import {read, slang_ir_factory} from './tool'
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
        if(ls_arg!=null)tool.push(new OFFSET_SET(ls_arg,tool._pool(i['name']),read(arg)))
    }
    if(high)tool.high=true
    //找entry加入块0:只认直属子节点。递归找会把嵌套模块里的 entry 在每一层
    const entry=data.children.find(i=>i instanceof HVariable&&i.entry)
    if(entry!=null){
        tool.entry=true
        tool.block_id=tool.create(0)
        //entry 会编译第二遍:标签重新分块,避免 I_Label 复用旧块把第一遍清空
        tool.label.clear()
        call(entry)
        //entry 只对这一个函数有效,否则下一个文件里所有 lambda 都会挤进块 0
        tool.entry=false
    }
    //入口
    if(high&&tool.ir.has(0)){
        const head=tool.ir.get(tool.reg_block)
        tool.ir.set(tool.reg_block,[])
        tool.ir.set(0,[...head,...tool.ir.get(0)])
    }
}
const I_Variable:slang_ir_factory=(data:HVariable,tool,call)=>{
    call(data.value)
}
export default new Map<any,slang_ir_factory>([
    [HModule,I_Module],
    [HVariable,I_Variable]
])
