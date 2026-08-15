//逃逸分析(O2):块内变量(槽)若仅用于块内操作、地址不外泄,在块尾ret/retn前插delete供VM回收
//向外禁止:param_set 0 收到地址(return &VAR)、&VAR 写入块外槽/内存、thread 传地址、跨块value读
//向内允许:call/cz 传地址(进入子作用域/调用函数,生命周期仍在块内)
import {
    asm_args, BINARY, BIT_NOT, CALL, CMP, CZ, DELETE, IN, IR, IRTool, JMP, JZ, LOAD, MOV, NOT,
    OFFSET_ADDR, OFFSET_GET, OFFSET_SET, OUT, PARAM_LOAD, PARAM_SET, POP, PUSH, RET, RETN, TZ
} from '../utils'
//读取槽:value形式操作数 + 就地操作的reg槽(NOT/BIT_NOT)
function reads(i:IR):number[]{
    let ret:number[]=[]
    let v=(a:asm_args)=>{if(a&&a[0]=='value')ret.push(a[1])}
    if(i instanceof MOV){v(i.left);v(i.right)}
    else if(i instanceof LOAD)v(i.data)
    else if(i instanceof BINARY){v(i.left);v(i.right)}
    else if(i instanceof NOT||i instanceof BIT_NOT){if(i.data[0]=='reg')ret.push(i.data[1])}
    else if(i instanceof CMP){v(i.left);v(i.right)}
    else if(i instanceof JZ||i instanceof TZ||i instanceof CZ){v(i.target);v(i.cond)}
    else if(i instanceof JMP||i instanceof CALL||i instanceof TZ)v(i.target)
    else if(i instanceof PUSH)v(i.target)
    else if(i instanceof OFFSET_SET){v(i.data);v(i.value)}
    else if(i instanceof OFFSET_GET||i instanceof OFFSET_ADDR){v(i.data);v(i.offset)}
    else if(i instanceof IN)v(i.data)
    else if(i instanceof OUT)v(i.target)
    else if(i instanceof PARAM_SET)v(i.value)
    else if(i instanceof PARAM_LOAD)v(i.param)
    return ret
}
export function kill(tool:IRTool){
    //跨块读:槽→读取它的块集合
    let block_read=new Map<number,Set<number>>()
    for(let [bid,data] of tool.command)
        for(let i of data)
            for(let s of reads(i)){
                if(!block_read.has(s))block_read.set(s,new Set())
                block_read.get(s).add(bid)
            }
    for(let [bid,data] of tool.command){
        //候选:块内 def 的槽(排除槽0返回值约定槽;param_set的param槽属调用方,不算块内)
        let defs=new Set<number>()
        let def=(a:asm_args)=>{if(a&&a[0]=='reg'&&a[1]!=0)defs.add(a[1])}
        for(let i of data){
            if(i instanceof MOV)def(i.left)
            else if(i instanceof LOAD)def(i.reg)
            else if(i instanceof BINARY)def(i.result)
            else if(i instanceof CMP)def(i.result)
            else if(i instanceof NOT||i instanceof BIT_NOT)def(i.data)
            else if(i instanceof IN||i instanceof OUT)def(i.oper)
            else if(i instanceof POP)def(i.target)
            else if(i instanceof OFFSET_SET||i instanceof OFFSET_GET||i instanceof OFFSET_ADDR)def(i.target)
            else if(i instanceof PARAM_LOAD)def(i.data)
        }
        //地址流与逃逸:addr[槽]=其持有的变量槽地址;leak=地址外泄的槽
        let addr=new Map<number,number>()
        let leak=new Set<number>()
        //param_set(N>0)的参数,等待后续call(向内安全)/thread(逃逸)判定
        let pending:asm_args[]=[]
        for(let i of data){
            if(i instanceof MOV){
                if(i.left[0]=='reg'){
                    let a=i.left[1]
                    if(i.right[0]=='reg'){
                        if(defs.has(a))addr.set(a,i.right[1])
                        else leak.add(i.right[1])
                    }else if(i.right[0]=='value'&&addr.has(i.right[1])){
                        if(defs.has(a))addr.set(a,addr.get(i.right[1]))
                        else leak.add(addr.get(i.right[1]))
                    }
                }else if(i.left[0]=='value'){
                    //解引用写:mov value A ... → 地址写入内存
                    if(i.right[0]=='reg')leak.add(i.right[1])
                    else if(i.right[0]=='value'&&addr.has(i.right[1]))leak.add(addr.get(i.right[1]))
                }
            }
            else if(i instanceof PARAM_SET){
                if(i.param[1]==0){
                    //return &VAR
                    if(i.value[0]=='reg')leak.add(i.value[1])
                    else if(i.value[0]=='value'&&addr.has(i.value[1]))leak.add(addr.get(i.value[1]))
                }
                else pending.push(i.value)
            }
            else if(i instanceof CALL){
                //call/cz 传地址=向内,安全
                pending=[]
            }
            else if(i instanceof TZ){
                //thread 传地址=逃逸(异步)
                for(let p of pending){
                    if(p[0]=='reg')leak.add(p[1])
                    else if(p[0]=='value'&&addr.has(p[1]))leak.add(addr.get(p[1]))
                }
                pending=[]
            }
            else if(i instanceof JZ||i instanceof CZ||i instanceof JMP||i instanceof RET||i instanceof RETN)
                pending=[]
        }
        //地址外泄传播:addr[Y]=X 且 Y 泄漏/跨块读 → X 的地址也暴露;X 持有 &v 且 X 暴露 → v 泄漏
        let cross=(s:number)=>block_read.has(s)&&(block_read.get(s).size>1||!block_read.get(s).has(bid))
        let changed=true
        while(changed){
            changed=false
            for(let [Y,X] of addr)
                if(leak.has(Y)&&!leak.has(X)){leak.add(X);changed=true}
            for(let [X,v] of addr)
                if((leak.has(X)||cross(X))&&!leak.has(v)){leak.add(v);changed=true}
        }
        //候选判定+去重
        let victims:number[]=[]
        for(let v of defs)
            if(!tool.deleted.has(v)&&!leak.has(v)&&!cross(v))
                victims.push(v)
        if(victims.length==0)continue
        let ends:number[]=[]
        for(let i=0;i<data.length;i++)
            if(data[i] instanceof RET||data[i] instanceof RETN)
                ends.push(i)
        if(ends.length==0)continue
        victims.sort((a,b)=>a-b)
        for(let e of ends.sort((a,b)=>b-a)){
            for(let v of victims)tool.deleted.add(v)
            data.splice(e,0,...victims.map(v=>new DELETE(['reg',v])))
        }
    }
}
