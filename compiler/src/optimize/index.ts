//本地只提供基本优化,由插件机制实现其他高级优化
import {kill, OPTTool, writes_of} from './tool'
import Optimize from '../utils/lib/optimize'
import fold from './contant/fold'
import prop from './contant/prop'
import copy from './copy'
import peephole from './peephole'
import last from './last'
import {IRTool} from '../ir/tool'
import {ControlStream, RET} from '../utils'
//每轮都对整条指令流扫一遍,任何一轮有改写就再来一遍,最多10轮
const rounds=['copy','constant_prop','constant_fold','peephole']
export default new Optimize().use(fold).use(prop).use(copy).use(peephole).use(last).use((tool:IRTool,call)=>{
    const opt=new OPTTool(tool.index,tool.ir,tool.pool)
    const run_round=(round:string)=>{
        for(const [bid,list] of opt.command){
            //传播表是块内的:块之间没有前驱关系,不清掉会把别的块/函数写的值泄漏过来
            opt.clear()
            for(let index=0;index<list.length;index++){
                //先把这个位置重新定义的槽的旧推导作废,再由本轮 visitor 记录新值
                kill(opt,writes_of(list[index]))
                const visitor=call(round,list[index])
                if(visitor!=null)visitor(list[index],opt,bid,index)
                //控制流之后可能是另一个块在写槽,任何推导都不能再用
                if(list[index] instanceof ControlStream||list[index] instanceof RET)opt.clear()
            }
        }
    }
    for(let i=0;i<10;i++){
        for(const round of rounds)run_round(round)
        if(!opt.changed)break
        opt.flush()
    }
    //收尾:把不规范的 reg 数字换成 load
    run_round('last')
    opt.flush()
    return opt
})
