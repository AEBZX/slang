import {DCE,slots,build as d_build,global_use} from './dce'
import {build,kill as cfg_kill} from './cfg'
import {kill} from './kill'
import CP from './cp'
import CONSTANT from './constant'
import PEEPHOLE from './peephole'
import {asm_command, BINARY, bin, BIT_NOT, BLOCK_END, BLOCK_START, CMP, IR, IRTool, LOAD, MOV, NOT, OFFSET_ADDR, OFFSET_GET, opt_visitor, PARAM_LOAD, POP, to} from '../utils'
const round=10
//跨块写扫描:模拟各块局部 state 解析 value 左值写目标,收集 槽→写入块集合
//while 循环体在独立块修改变量后,块0内 if(变量==常量) 仍按初始化值折叠会错,折叠需保守
const build_cross=(tool:IRTool)=>{
    let cross=new Map<number,Set<number>>()
    for(let [bid,data] of tool.command){
        let st=new Map<number,number|null>()
        for(let i of data){
            if(i instanceof MOV){
                let l=i.left[0]=='reg'?i.left[1]:st.get(i.left[1])
                if(i.left[0]=='value'&&typeof l=='number'){
                    if(!cross.has(l))cross.set(l,new Set())
                    cross.get(l).add(bid)
                }
                let r=i.right[0]=='reg'?i.right[1]:st.get(i.right[1])
                if(i.left[0]=='reg')st.set(i.left[1],typeof r=='number'?r:null)
                else if(typeof l=='number')st.set(l,typeof r=='number'?r:null)
            }
            else if(i instanceof LOAD){
                let r=i.reg[0]=='reg'?i.reg[1]:st.get(i.reg[1])
                if(i.reg[0]=='value'&&typeof r=='number'){
                    if(!cross.has(r))cross.set(r,new Set())
                    cross.get(r).add(bid)
                }
                if(i.reg[0]=='reg')st.set(i.reg[1],null)
            }
            else if(i instanceof PARAM_LOAD)
                st.set(i.data[1],null)
            else if(i instanceof POP)
                st.set(i.target[1],null)
            else if(i instanceof CMP)
                st.set(i.left[1],null)
            else if(i instanceof BINARY)
                st.set(i.result[1],null)
            else if(i instanceof NOT||i instanceof BIT_NOT)
                st.set(i.data[1],null)
            else if(i instanceof OFFSET_GET||i instanceof OFFSET_ADDR)
                st.set(i.target[1],null)
            //call/cz/jz/out/offset_set 等不改槽值或目标未知,不处理
        }
    }
    tool.cross=cross
}
const o1=(tool:IRTool)=>{
    build_cross(tool)
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
export default function (data:{pool:Map<number|string,number>,code:Map<number,asm_command[]>,id:number},level:number){
    let pool=new Map<number,number|string>
    for(let [k,v] of data.pool)pool.set(v,k)
    let code=to(data.code)
    let tool=new IRTool(data.id,code,pool)
    //o1多轮收敛;o2再循环:cfg可达剪枝(块0不可删)+变量delete(kill.ts经deleted去重,重复执行无副作用)
    for(let i=0;i<round;i++)o1(tool)
    if(level>=1)for(let i=0;i<round;i++){
        build(tool.command,tool)
        cfg_kill(tool)
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
    return {bin:ret,pool:tool.pool}
}