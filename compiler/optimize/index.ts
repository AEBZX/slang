import {DCE,slots,build as d_build} from './dce'
import {build,kill,merge} from './cfg'
import CP from './cp'
import CONSTANT from './constant'
import PEEPHOLE from './peephole'
import {asm_command, bin, BLOCK_END, BLOCK_START, IR, IRTool, opt_visitor, to} from '../utils'
const round=10
const o1=(tool:IRTool)=>{
    let index
    let each=(c:Map<any,opt_visitor>,bid:number,data:IR[])=>{
        index=0
        for(let [k,v] of c){
            for (let command of data) {
                if (command instanceof k)
                    v(command, tool, bid, index)
                index++
            }
        }
    }
    for(let [bid,data] of tool.command) {
        index = 0
        each(CONSTANT,bid,data)
        each(PEEPHOLE,bid,data)
        each(CP,bid,data)
        d_build(data,slots,tool)
        each(DCE,bid,data)
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
    optimize[level](tool)
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