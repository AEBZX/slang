//本地只提供基本优化,由插件机制实现其他高级优化
import {BINARYMap, CMPMap, is_constant, OPTTool, slang_opt_visitor, to_v} from './tool'
import Optimize from '../utils/lib/optimize'
import fold from './contant/fold'
import prop from './contant/prop'
import copy from './copy'
import peephole from './peephole'
import last from './last'
import {IRTool} from '../ir/tool'
export default new Optimize().use(fold).use(prop).use(copy).use(peephole).use(last).use((tool:IRTool,call)=>{
    let _tool=new OPTTool(tool.index+1,tool.ir,tool.pool)
    for(let i=0;i<10;i++){
        for(const [bid,v] of _tool.command)
            for(const [index,ir] of v.entries()){
                call('copy',ir)(ir,_tool,bid,index)
                call('constant_prop',ir)(ir,_tool,bid,index)
                call('constant_fold',ir)(ir,_tool,bid,index)
                call('peephole',ir)(ir,_tool,bid,index)
                if(!_tool.changed)return
                _tool.flush()
            }
    }
    call('last',_tool)
    return _tool
})