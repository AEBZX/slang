import {DCE,slots,build as d_build,global_use} from './dce'
import {build,kill,merge} from './cfg'
import CP from './cp'
import CONSTANT from './constant'
import PEEPHOLE from './peephole'
import {asm_command, bin, BLOCK_END, BLOCK_START, IR, IRTool, opt_visitor, to} from '../utils'
const round=10
const o1=(tool:IRTool)=>{
    //按指令真实下标分派规则
    let each=(c:Map<any,opt_visitor>,bid:number,data:IR[])=>{
        for(let i=0;i<data.length;i++){
            let rule=c.get(data[i].constructor)
            if(rule)rule(data[i],tool,bid,i)
        }
    }
    for(let [bid,data] of tool.command) {
        //常量折叠+窥孔
        each(CONSTANT,bid,data)
        each(PEEPHOLE,bid,data)
        tool.sweep()
        //赋值传播+死代码消除,依赖ud表,须先重建
        d_build(data,slots,tool)
        each(CP,bid,data)
        tool.sweep()
        d_build(data,slots,tool)
        //DCE前收集全局use,保护跨块定值(如根块的函数槽初始化)
        tool.guse=global_use(tool)
        each(DCE,bid,data)
        tool.sweep()
    }
}
const o2=(tool:IRTool)=>{
    o1(tool)
    build(tool.command,tool)
    kill(tool)
}
const optimize=[o1,o2]
export default function (data:{pool:Map<number|string,number>,code:Map<number,asm_command[]>,id:number},level:number){
    let pool=new Map<number,number|string>
    for(let [k,v] of data.pool)pool.set(v,k)
    let code=to(data.code)
    let tool=new IRTool(data.id,code,pool)
    //o1可多轮收敛;o2的kill不可逆,多轮会误删被调用块(第二轮调用者已删,call计数归零),只kill一次
    for(let i=0;i<round;i++)o1(tool)
    if(level>=1){
        build(tool.command,tool)
        kill(tool)
    }
    code=tool.command
    let ret:bin[]=[]
    for(let [k,v] of code){
        ret.push(new BLOCK_START(['reg',k]).generate())
        for(let command of v)
            ret.push(command.generate())
        ret.push(new BLOCK_END().generate())
    }
    return ret
}