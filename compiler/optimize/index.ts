import {DCE,slots,build as d_build,global_use} from './dce'
import {build,kill as cfg_kill} from './cfg'
import {kill} from './kill'
import CP from './cp'
import CONSTANT from './constant'
import PEEPHOLE from './peephole'
import {asm_command, BINARY, bin, BIT_NOT, BLOCK_END, BLOCK_START, CMP, IRTree, IRTool, LOAD, MOV, NOT, OFFSET_ADDR, OFFSET_GET, opt_visitor, PARAM_LOAD, POP, to} from '../utils'
const round=10
const build_cross=(tool:IRTool)=>{
    let cross=new Map<number,Set<number>>()
    const mark=(slot:number|undefined,bid:number)=>{
        if(typeof slot!='number')return
        if(!cross.has(slot))cross.set(slot,new Set())
        cross.get(slot)!.add(bid)
    }
    for(let [bid,data] of tool.command){
        let st=new Map<number,number|null>()
        for(let i of data){
            if(i instanceof MOV){
                let l=i.left[0]=='reg'?i.left[1]:st.get(i.left[1])
                mark(l,bid)
                let r=i.right[0]=='reg'?i.right[1]:st.get(i.right[1])
                if(i.left[0]=='reg')st.set(i.left[1],typeof r=='number'?r:null)
                else if(typeof l=='number')st.set(l,typeof r=='number'?r:null)
            }
            else if(i instanceof LOAD){
                let r=i.reg[0]=='reg'?i.reg[1]:st.get(i.reg[1])
                mark(i.reg[0]=='reg'?i.reg[1]:r,bid)
                if(i.reg[0]=='reg')st.set(i.reg[1],null)
            }
            else if(i instanceof PARAM_LOAD){
                mark(i.data[1],bid)
                st.set(i.data[1],null)
            }
            else if(i instanceof POP){
                mark(i.target[1],bid)
                st.set(i.target[1],null)
            }
            else if(i instanceof CMP){
                mark(i.left[1],bid)
                st.set(i.left[1],null)
            }
            else if(i instanceof BINARY){
                mark(i.result[1],bid)
                st.set(i.result[1],null)
            }
            else if(i instanceof NOT||i instanceof BIT_NOT){
                mark(i.data[1],bid)
                st.set(i.data[1],null)
            }
            else if(i instanceof OFFSET_GET||i instanceof OFFSET_ADDR){
                mark(i.target[1],bid)
                st.set(i.target[1],null)
            }
        }
    }
    tool.cross=cross
}
const o1=(tool:IRTool)=>{
    build_cross(tool)
    //按指令真实下标分派规则
    let each=(c:Map<any,opt_visitor>,bid:number,data:IRTree[])=>{
        for(let i=0;i<data.length;i++){
            let rule=c.get(data[i].constructor)
            if(rule)rule(data[i],tool,bid,i)
        }
    }
    for(let [bid,data] of tool.command) {
        //常量折叠+窥孔
        each(CONSTANT,bid,data)
        //PEEPHOLE 跳过已被 CONSTANT 折叠(待 sweep)的指令:CONSTANT 更新 state 后,
        //PEEPHOLE 读 state 会把折叠结果误当操作数(如 sub 的 l==r)生成错误指令
        for(let i=0;i<data.length;i++){
            let rule=PEEPHOLE.get(data[i].constructor)
            if(rule&&!tool.replaced(bid,i))rule(data[i],tool,bid,i)
        }
        tool.sweep()
        d_build(data,slots,tool)
        each(CP,bid,data)
        tool.sweep()
        d_build(data,slots,tool)
        tool.guse=global_use(tool)
        each(DCE,bid,data)
        tool.sweep()
    }
}
const o2=(tool:IRTool)=>{
    o1(tool)
    build(tool.command,tool)
    cfg_kill(tool)
    kill(tool)
}
const optimize=[o1,o2]
//o0=不优化;o1=常量折叠/传播/窥孔/DCE(多轮收敛);o2=再循环 cfg 可达剪枝+变量 kill
export function opt_ir(data:{pool:Map<number|string,number>,code:Map<number,asm_command[]>,id:number},level:number):IRTool{
    let pool=new Map<number,number|string>
    for(let [k,v] of data.pool)pool.set(v,k)
    let tool=new IRTool(data.id,to(data.code),pool)
    if(level>=1)for(let i=0;i<round;i++)o1(tool)
    if(level>=2)for(let i=0;i<round;i++)o2(tool)
    return tool
}
export default function (data:{pool:Map<number|string,number>,code:Map<number,asm_command[]>,id:number},level:number){
    let tool=opt_ir(data,level)
    let ret:bin[]=[]
    for(let [k,v] of tool.command){
        ret.push(new BLOCK_START(['reg',k]).generate())
        for(let command of v)
            ret.push(command.generate())
        ret.push(new BLOCK_END().generate())
    }
    return {bin:ret,pool:tool.pool}
}