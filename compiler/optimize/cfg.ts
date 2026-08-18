import {asm_args, CALL, cfg, CZ, IR, IRTool, JMP, JZ, LOAD, MOV, OFFSET_SET, PARAM_LOAD, RET, RETN, TZ} from '../utils'
export function build(code:Map<number,IR[]>,tool:IRTool){
    let CFG:cfg={}
    for(let [id,] of code)
        CFG[id]={last:[],next:[],call:0}
    //成员方法块:类构造块 offset_set 把成员槽初始化为方法块 id
    //方法经运行期对象调用(offset_get),cfg 无法静态建边,可达剪枝需保留
    let methods=new Set<number>()
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
            //offset_set 的 value 槽 → 成员方法块 id(构造块初始化成员槽)
            if(i instanceof OFFSET_SET&&i.value[0]=='value'){
                let m=slots.get(i.value[1])
                if(typeof m=='number')methods.add(m)
            }
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
    tool.methods=methods
}
export function kill(tool:IRTool){
    //可达剪枝:块0不可删,从块0沿调用/跳转边BFS,保留可达块,删除其余
    //替代原call计数方案——计数依赖调用者存活,删调用者后计数失真、不可逆;可达集重复执行稳定
    let alive=new Set<number>()
    let queue=[0]
    alive.add(0)
    while(queue.length){
        let k=queue.pop() as number
        let cfg=tool.cfg[k]
        if(!cfg)continue
        for(let edge of cfg.next){
            let t=edge[0]
            if(t==null)continue
            if(!alive.has(t)){
                alive.add(t)
                queue.push(t)
            }
        }
    }
    for(let [k] of tool.command){
        if(alive.has(k))continue
        //成员方法块:运行期经对象调用(offset_get),编译期无法静态解析调用目标,保守保留
        //顶层函数不可达(根块无调用)仍可删,保持可达剪枝能力
        if(tool.methods.has(k))continue
        tool.command.delete(k)
    }
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