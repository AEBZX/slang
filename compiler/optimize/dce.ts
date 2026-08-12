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
                for(let j of ls[0])
                    ud.def.has(index)?ud.def.get(index).push(j):ud.def.set(index,[j])
                for(let j of ls[1])
                    ud.def.has(index)?ud.def.get(index).push(j):ud.def.set(index,[j])
            }
        index++
    }
    tool.ud=ud
}
const S_MOV:slot=(data:MOV, tool)=>tool.$._s([data.left],[data.right])
const S_LOAD:slot=(data:LOAD, tool)=>tool.$._s([data.reg],[data.data])
const S_BINARY:slot=(data:BINARY,tool)=>tool.$._s([data.result],[data.left,data.right])
const S_NOT_BIT_NOT:slot=(data:NOT|BIT_NOT,tool)=>tool.$._s([data.data],[data.data])
const S_CMP:slot=(data:CMP,tool)=>tool.$._s([data.left],[data.left,data.right,data.oper])
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
const D_MOV:opt_visitor=(data:MOV, tool, bid, index)=>tool.$.dce(data.left,bid,index)
const D_LOAD:opt_visitor=(data:LOAD, tool, bid, index)=>tool.$.dce(data.reg,bid,index)
const D_BINARY:opt_visitor=(data:BINARY, tool, bid, index)=>tool.$.dce(data.result,bid,index)
const D_PARAM_LOAD:opt_visitor=(data:PARAM_LOAD, tool, bid, index)=>tool.$.dce(data.data,bid,index)
const D_NOT_BIT_NOT:opt_visitor=(data:NOT|BIT_NOT, tool, bid, index)=>tool.$.dce(data.data,bid,index)
const D_CMP:opt_visitor=(data:CMP, tool, bid, index)=>tool.$.dce(data.left,bid,index)
const D_POP:opt_visitor=(data:POP, tool, bid, index)=>tool.$.dce(data.target,bid,index)
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
    [OFFSET_ADDR,D_OFFSET_ADDR],
    [POP,D_POP]
])