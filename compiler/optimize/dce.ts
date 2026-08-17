import {
    BINARY,
    BIT_NOT,
    CALL,
    CMP,
    CZ, IN,
    IR,
    IRTool,
    JMP,
    JZ,
    LOAD,
    MOV,
    NOT, OFFSET_ADDR, OFFSET_GET, OFFSET_SET, opt_visitor, OUT, PARAM_LOAD, PARAM_SET, POP,
    PUSH,
    slot,
    THREAD,
    TZ,
    ud_table
} from '../utils'
const barrier_list=['thread','jmp','call','tz','jz','cz','out','offset_set']
export function build(block:IR[],slots:Map<any,slot>,tool:IRTool){
    let ud:ud_table={
        def: new Map(),
        use: new Map(),
        barrier: []
    }
    let index=0
    for(let i of block){
        if(barrier_list.includes(i.id))ud.barrier.push(index)
        //间接写的MOV,LOAD,常量id未知的load
        if(i instanceof MOV&&i.left[0]=='value'&&tool.$.value(i.left)==null)ud.barrier.push(index)
        if(i instanceof LOAD&&i.reg[0]=='value'&&tool.$.value(i.reg)==null)ud.barrier.push(index)
        if(i instanceof LOAD&&i.data[0]=='value'&&tool.$.value(i.data)==null)ud.barrier.push(index)
        for(let [k,v] of slots)
            if(i instanceof k){
                let ls=v(i,tool)
                ls[0]=ls[0].filter(t=>t!=null)
                ls[1]=ls[1].filter(t=>t!=null)
                //def/use以槽为键,记录该槽在哪些指令index处被定义/使用
                for(let j of ls[0])
                    ud.def.has(j)?ud.def.get(j).push(index):ud.def.set(j,[index])
                for(let j of ls[1])
                    ud.use.has(j)?ud.use.get(j).push(index):ud.use.set(j,[index])
            }
        index++
    }
    tool.ud=ud
}
const S_MOV:slot=(data:MOV, tool)=>tool.$._s([data.left],[data.right])
const S_LOAD:slot=(data:LOAD, tool)=>tool.$._s([data.reg],[data.data])
const S_BINARY:slot=(data:BINARY,tool)=>tool.$._s([data.result],[data.left,data.right])
//NOT/BIT_NOT的data是reg,语义=读slots[data]再写,use须补记data槽
const S_NOT_BIT_NOT:slot=(data:NOT|BIT_NOT,tool)=>{
    let ls=tool.$._s([data.data],[])
    let r=tool.$.rs(data.data)
    if(r!=null)ls[1].push(r)
    return ls
}
//CMP的left是reg:先读slots[left]再写,use须补记left槽(否则前驱定值被DCE误删)
const S_CMP:slot=(data:CMP,tool)=>{
    let ls=tool.$._s([data.left],[data.right,data.oper])
    let r=tool.$.rs(data.left)
    if(r!=null)ls[1].push(r)
    return ls
}
const S_BZ:slot=(data:CZ|TZ|JZ,tool)=>tool.$._s([],[data.target,data.cond])
const S_B:slot=(data:JMP|CALL|THREAD,tool)=>tool.$._s([],[data.target])
const S_PUSH:slot=(data:PUSH,tool)=>tool.$._s([],[data.target])
const S_POP:slot=(data:POP,tool)=>tool.$._s([data.target],[])
const S_OFFSET_SET:slot=(data:OFFSET_SET,tool)=>tool.$._s([],[data.offset,data.value,data.offset])
const S_OFFSET_GET:slot=(data:OFFSET_GET,tool)=>tool.$._s([data.target],[data.offset,data.data])
const S_OFFSET_ADDR:slot=(data:OFFSET_ADDR,tool)=>tool.$._s([data.target],[data.offset,data.data])
const S_IN:slot=(data:IN,tool)=>tool.$._s([],[data.oper,data.data])
const S_OUT:slot=(data:OUT,tool)=>tool.$._s([],[data.target,data.oper])
const S_PARAM_SET:slot=(data:PARAM_SET,tool)=>tool.$._s([],[data.param,data.value])
const S_PARAM_LOAD:slot=(data:PARAM_LOAD,tool)=>tool.$._s([data.data],[data.param])
export const slots=new Map<any,slot>([
    [MOV,S_MOV],
    [LOAD,S_LOAD],
    [BINARY,S_BINARY],
    [NOT,S_NOT_BIT_NOT],
    [BIT_NOT,S_NOT_BIT_NOT],
    [CMP,S_CMP],
    [CZ,S_BZ],
    [TZ,S_BZ],
    [JZ,S_BZ],
    [JMP,S_B],
    [CALL,S_B],
    [THREAD,S_B],
    [PUSH,S_PUSH],
    [POP,S_POP],
    [OFFSET_SET,S_OFFSET_SET],
    [OFFSET_GET,S_OFFSET_GET],
    [OFFSET_ADDR,S_OFFSET_ADDR],
    [IN,S_IN],
    [OUT,S_OUT],
    [PARAM_SET,S_PARAM_SET],
    [PARAM_LOAD,S_PARAM_LOAD]
])
//收集所有块中被读取(use)的槽集合,供DCE跨块保护
//单块ud看不到其他块的use,函数槽初始化等跨块定值会被误删
export function global_use(tool:IRTool){
    let g=new Set<number>()
    for(let [,block] of tool.command){
        for(let i of block)
            for(let [k,v] of slots)
                if(i instanceof k)
                    for(let j of v(i,tool)[1])
                        if(j!=null)g.add(j)
    }
    return g
}
const D_MOV:opt_visitor=(data:MOV, tool, bid, index)=>{
    //自引用 mov(reg X ← reg X)是对象句柄初始化,优化器视为无操作会删,导致 offset 对象链断裂,永不删
    if(data.left[0]=='reg'&&data.right[0]=='reg'&&data.left[1]==data.right[1])return
    tool.$.dce(data.left,bid,index)
}
const D_LOAD:opt_visitor=(data:LOAD, tool, bid, index)=>tool.$.dce(data.reg,bid,index)
const D_BINARY:opt_visitor=(data:BINARY, tool, bid, index)=>tool.$.dce(data.result,bid,index)
const D_PARAM_LOAD:opt_visitor=(data:PARAM_LOAD, tool, bid, index)=>tool.$.dce(data.data,bid,index)
const D_NOT_BIT_NOT:opt_visitor=(data:NOT|BIT_NOT, tool, bid, index)=>tool.$.dce(data.data,bid,index)
const D_CMP:opt_visitor=(data:CMP, tool, bid, index)=>tool.$.dce(data.left,bid,index)
const D_OFFSET_GET:opt_visitor=(data:OFFSET_GET, tool, bid, index)=>tool.$.dce(data.target,bid,index)
const D_OFFSET_ADDR:opt_visitor=(data:OFFSET_ADDR, tool, bid, index)=>tool.$.dce(data.target,bid,index)
export const DCE=new Map<any,opt_visitor>([
    [MOV,D_MOV],
    [LOAD,D_LOAD],
    [BINARY,D_BINARY],
    [NOT,D_NOT_BIT_NOT],
    [BIT_NOT,D_NOT_BIT_NOT],
    [CMP,D_CMP],
    [PARAM_LOAD,D_PARAM_LOAD],
    [OFFSET_GET,D_OFFSET_GET],
    [OFFSET_ADDR,D_OFFSET_ADDR]
    //POP不参与DCE:帧恢复的pop必须保留,否则栈失衡(删除后对应push多压栈)
])