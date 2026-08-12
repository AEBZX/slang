import {
    asm_command,
    asm_pool,
    BINARY,
    BIT_NOT, CALL, CMP, opt_visitor, CZ, IN,
    IR,
    IRTool, JMP, JZ,
    LOAD,
    MOV,
    NOT, OFFSET_GET,
    OFFSET_SET, OUT,
    PARAM_LOAD,
    PARAM_SET, PUSH, THREAD, TZ
} from '../utils'
export const _BINARY=new Map<string,(a:number,b:number)=>number>([
    ['add',(a:number,b:number)=>a+b],
    ['sub',(a:number,b:number)=>a-b],
    ['mul',(a:number,b:number)=>a*b],
    ['div',(a:number,b:number)=>a/b],
    ['mod',(a:number,b:number)=>a%b],
    ['shr',(a:number,b:number)=>a>>b],
    ['shl',(a:number,b:number)=>a<<b],
    ['and',(a:number,b:number)=>a&b],
    ['or',(a:number,b:number)=>a|b],
    ['xor',(a:number,b:number)=>a^b]
])
export const _CMP=new Map<number,(a:number,b:number)=>number>([
    [0,(a:number,b:number)=>a==b?1:0],
    [1,(a:number,b:number)=>a!=b?1:0],
    [2,(a:number,b:number)=>a>b?1:0],
    [3,(a:number,b:number)=>a<b?1:0],
    [4,(a:number,b:number)=>a>=b?1:0],
    [5,(a:number,b:number)=>a<=b?1:0]
])
const C_MOV:opt_visitor=(data:MOV, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.left,data.right)
    $.set(data.left, data.right)
}
const C_LOAD:opt_visitor=(data:LOAD, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.data,data.reg)
    $.pset(data.reg, data.data)
}
const C_OFFSET_SET:opt_visitor=(data:OFFSET_SET, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.target,data.offset,data.value)
    $.mset(data.target, data.offset, data.value)
}
const C_PARAM_SET:opt_visitor=(data:PARAM_SET, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.param,data.value)
    $.set(data.param, data.value)
}
const C_BINARY:opt_visitor=(data:BINARY, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.result,data.right,data.left)
    let res=_BINARY.get(data.id)($.value(data.left) as number,$.value(data.right) as number)
    let id=tool._id()
    $.set(data.result,['reg',res])
    tool.pool.set(id,res)
    tool.replace(bid,index,new LOAD(data.result,['reg',id]))
}
const C_NOT:opt_visitor=(data:NOT, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.data)
    if($.pvalue(data.data)==null)return
    let res=!($.pvalue(data.data)==1?1:0)
    let id=tool._id()
    tool.pool.set(id,res?1:0)
    $.set(data.data,['reg',res?1:0])
    tool.replace(bid,index,new LOAD(data.data,['reg',id]))
}
const C_BIT_NOT:opt_visitor=(data:BIT_NOT, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.data)
    if($.pvalue(data.data)==null)return
    let res=~$.pvalue(data.data)
    let id=tool._id()
    tool.pool.set(id,res)
    $.set(data.data,['reg',res?1:0])
    tool.replace(bid,index,new LOAD(data.data,['reg',id]))
}
const C_CMP:opt_visitor=(data:CMP, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.left,data.right,data.oper)
    let o=$.value(data.oper),r=$.value(data.right),l=$.rvalue(data.left)
    if(o==null||r==null||l==null)return
    let res=_CMP.get(o as number)(l as number,r as number)
    let id=tool._id()
    tool.pool.set(id,res)
    $.set(data.left,['reg',res])
    tool.replace(bid,index,new LOAD(data.left,['reg',id]))
}
const C_JZ_CZ_TZ:opt_visitor=(data:JZ|TZ|CZ, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.cond,data.target)
}
const C_OFFSET_GET:opt_visitor=(data:OFFSET_GET, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.data,data.offset,data.target)
    let v=$.mvalue(data.data, data.offset)
    if(v==null)return
    let id=tool._id()
    tool.pool.set(id,v)
    tool.state.set($.value(data.target) as number,v)
    tool.replace(bid,index,new LOAD(data.target,['reg',id]))
}
const C_IN:opt_visitor=(data:IN, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.oper,data.data)
}
const C_OUT:opt_visitor=(data:OUT, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.oper,data.target)
}
const C_PARAM_LOAD:opt_visitor=(data:PARAM_LOAD, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.data,data.param)
    let value=$.value(data.param)
    if(value==null)return
    let id=tool._id()
    tool.pool.set(id,value)
    tool.state.set($.value(data.data) as number,value)
    tool.replace(bid,index,new LOAD(data.data,['reg',id]))
}