import {cfg, CZ, IR, IRTool, JMP, JZ, TZ} from '../utils'
export function build(code:Map<number,IR[]>,tool:IRTool){
    let CFG:cfg={}
    for(let [id,] of code)
        CFG[id]={last:[],next:[],call:0}
    let index
    for(let [id,data] of code){
        index=0
        for(let i of data){
            if(i instanceof JZ||i instanceof TZ||i instanceof CZ&&tool.$.value(i.target)!=null){
                CFG[id].next.push([tool.$.value(i.target) as number,true,i instanceof JZ,index])
                CFG[tool.$.value(i.target) as number].next.push([id,true, i instanceof JZ,index])
                CFG[tool.$.value(i.target) as number].call++
            }
            if(i instanceof CZ&&tool.$.value(i.target)==null){
                CFG[id].next.push([tool.$.value(i.target) as number,false,i instanceof JMP,index])
                CFG[tool.$.value(i.target) as number].last.push([id,false,i instanceof JMP,index])
                CFG[tool.$.value(i.target) as number].call++
            }
            index++
        }
    }
    tool.cfg=CFG
}
export function kill(tool:IRTool){
    for(let [k] of tool.command)
        if(tool.cfg[k].call==0)tool.command.delete(k)
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