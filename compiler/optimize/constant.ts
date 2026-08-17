import {
    asm_command,
    asm_pool,
    BINARY,
    BIT_NOT, CALL, CMP, opt_visitor, CZ, IN,
    IR,
    IRTool, JMP, JZ,
    LOAD,
    MOV,
    NOT, OFFSET_ADDR, OFFSET_GET,
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
    //右值 value 形式读槽:若该槽被其他块写入(while 循环体改 i),值不确定,不传播
    //否则 state 残留初始化值,后续 cmp/运算把 if(i==5) 折叠成恒假
    if(data.right[0]=='value'&&typeof data.right[1]=='number'){
        let blocks=tool.cross.get(data.right[1])
        if(blocks&&blocks.size>0&&!(blocks.size==1&&blocks.has(bid))){
            let ls=$.value(data.left)
            if(typeof ls=='number')tool.state.set(ls,null)
            return
        }
    }
    $.set(data.left, data.right)
}
const C_LOAD:opt_visitor=(data:LOAD, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.data,data.reg)
    $.pset(data.reg, data.data)
    //数字常量同步到state,供后续二元运算/比较折叠
    let pid=$.value(data.data)
    if(typeof pid=='number'){
        let v=tool.pool.get(pid)
        if(typeof v=='number')
            $.set(data.reg,['reg',v])
    }
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
    //操作数未知(参数/未初始化)不可折叠,否则 undefined 参与运算得到 NaN
    let l=$.value(data.left),r=$.value(data.right)
    if(l==null||r==null)return
    let res=_BINARY.get(data.id)(l as number,r as number)
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
    //跨块写保守:left 槽被其他块写入(如 while 循环体改 i)则值不确定,不可折叠
    //否则块内 state 残留初始化值(0),if(i==5) 被折叠成恒假,控制流断裂
    let lslot=$.value(data.left)
    if(typeof lslot=='number'){
        let blocks=tool.cross.get(lslot)
        if(blocks&&blocks.size>0&&!(blocks.size==1&&blocks.has(bid)))return
    }
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
//取地址不是常量(依赖运行期容器位置),只记录依赖不折叠
const C_OFFSET_ADDR:opt_visitor=(data:OFFSET_ADDR, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.data,data.offset,data.target)
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
    //param_load 从运行期参数表取值,值在编译期未知,不可折叠成常量
    //data.param 是参数索引(['reg',i]),并非常量池id,误折叠会把参数值错算成索引
    //必须把目标槽置 null:否则 state 残留 param_load 前 load 的旧值,后续 cmp/运算误折叠
    //(例:var f2=fib(4) 的槽此前 load 过 fib 块id=10,残留使 f2==3 被折叠成 10==3=假)
    let t=$.value(data.data)
    if(typeof t=='number')tool.state.set(t,null)
}
export default new Map<any,opt_visitor>([
    [MOV,C_MOV],
    [LOAD,C_LOAD],
    [OFFSET_SET,C_OFFSET_SET],
    [PARAM_SET,C_PARAM_SET],
    [BINARY,C_BINARY],
    [NOT,C_NOT],
    [BIT_NOT,C_BIT_NOT],
    [CMP,C_CMP],
    [JZ,C_JZ_CZ_TZ],
    [CZ,C_JZ_CZ_TZ],
    [TZ,C_JZ_CZ_TZ],
    [OFFSET_GET,C_OFFSET_GET],
    [OFFSET_ADDR,C_OFFSET_ADDR],
    [IN,C_IN],
    [OUT,C_OUT],
    [PARAM_LOAD,C_PARAM_LOAD]
])