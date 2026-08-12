import {asm_args, CALL, cfg, CZ, IR, IRTool, JMP, JZ, LOAD, MOV, TZ} from '../utils'
export function build(code:Map<number,IR[]>,tool:IRTool){
    let CFG:cfg={}
    for(let [id,] of code)
        CFG[id]={last:[],next:[],call:0}
    //跨块槽值表:根块的函数槽初始化(load 槽=块id)传播到其他块,call value{槽}据此解析目标
    let slots=new Map<number,number|string>()
    let resolve=(a:asm_args)=>a[0]=='reg'?a[1]:slots.get(a[1])
    let index
    for(let [id,data] of code){
        index=0
        for(let i of data){
            //槽值跟踪:mov reg=reg/value、load reg=数字常量
            if(i instanceof MOV&&i.left[0]=='reg'){
                let v=i.right[0]=='reg'?i.right[1]:slots.get(i.right[1])
                if(v!=null)slots.set(i.left[1],v)
            }
            if(i instanceof LOAD&&i.reg[0]=='reg'&&typeof tool.pool.get(i.data[1])=='number')
                slots.set(i.reg[1],tool.pool.get(i.data[1]) as number)
            //条件跳转/条件调用:目标可解析时建条件边
            if(i instanceof JZ||i instanceof TZ||i instanceof CZ&&resolve(i.target)!=null){
                let t=resolve(i.target) as number
                CFG[id].next.push([t,true,i instanceof JZ,index])
                CFG[t].last.push([id,true,i instanceof JZ,index])
                CFG[t].call++
            }
            //无条件跳转/调用:call/jmp目标解析(reg立即数或槽值)
            if(i instanceof JMP||i instanceof CALL){
                let t=resolve(i.target)
                if(t==null)continue
                CFG[id].next.push([t as number,true,true,index])
                CFG[t as number].last.push([id,false,true,index])
                CFG[t as number].call++
            }
            index++
        }
    }
    tool.cfg=CFG
}
export function kill(tool:IRTool){
    for(let [k] of tool.command)
        //保留入口根块(0),其余未被调用/跳转的块删除
        if(k!=0&&tool.cfg[k].call==0)tool.command.delete(k)
}
export function merge(tool:IRTool){
    for(let [k] of tool.command) {
        let cfg = tool.cfg[k]
        if (!(cfg.last.length == 1 && cfg.last[0][2] == true && cfg.last[0][1] == false)) continue
        //合并
        let index = cfg.last[0][3]
        let block = tool.command.get(cfg.last[0][0])
        //去除index后所有元素
        block.splice(index, block.length - index)
        //合并block到k
        tool.command.get(cfg.last[0][0]).push(...tool.command.get(k))
    }
}