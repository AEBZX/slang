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
    //非零即真:pvalue==1?1:0 把 2/9 等非零值误当 0 → !9 折叠成 1(应 0)
    //(9>7 未折叠时 state 残留 load 的 9,not(9) 被折成 1,|| cond 恒真)
    let res=!($.pvalue(data.data)?1:0)
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
    //res 是任意整数(~0=-1):此前 res?1:0 把非零真值归一化成 1,
    //state 记录 1 而实际 -1 → 后续 cmp/运算按 1 折叠,~0==-1 被折成 1==-1=假
    $.set(data.data,['reg',res])
    tool.replace(bid,index,new LOAD(data.data,['reg',id]))
}
const C_CMP:opt_visitor=(data:CMP, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.left,data.right,data.oper)
    let o=$.value(data.oper),r=$.value(data.right),l=$.rvalue(data.left)
    if(o==null||r==null||l==null){
        //cmp 结果是运行期值:left 槽 state 必须清空,否则残留左操作数(如 7),
        //下一轮 cmp 7==1 误折叠成 0(switch/if 的 cond==1 布尔化错乱,case 分支丢失)
        let ls=$.value(data.left)
        if(typeof ls=='number')tool.state.set(ls,null)
        return
    }
    //跨块写保守:left 槽被其他块写入(如 while 循环体改 i)则值不确定,不可折叠
    //否则块内 state 残留初始化值(0),if(i==5) 被折叠成恒假,控制流断裂
    let lslot=$.value(data.left)
    if(typeof lslot=='number'){
        let blocks=tool.cross.get(lslot)
        if(blocks&&blocks.size>0&&!(blocks.size==1&&blocks.has(bid))){
            //残留 state(load 的原始值)与运行时槽值(cmp 结果)不一致,
            //后续 C_NOT 等折叠会用它 → 错(如 4>6 未折叠时 state=4,not 折成 0 而运行时 not(0)=1)
            tool.state.set(lslot,null)
            return
        }
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
    if(v==null){
        //运行时读(跨块写/mem_state 失效):target 槽编译期值未知
        //必须清空 state,否则残留此前指令写入的值(如对象句柄),后续 cmp/运算误折叠
        let t=$.value(data.target)
        if(typeof t=='number')tool.state.set(t,null)
        return
    }
    let id=tool._id()
    tool.pool.set(id,v)
    tool.state.set($.value(data.target) as number,v)
    tool.replace(bid,index,new LOAD(data.target,['reg',id]))
}
//函数/线程调用会修改任意容器(数组/映射/对象按引用传参):offset 折叠状态必须作废
const C_CALL:opt_visitor=(data:CALL, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.target)
    tool.mem_state.clear()
}
const C_TZ:opt_visitor=(data:TZ, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.cond,data.target)
    tool.mem_state.clear()
}
//取地址不是常量(依赖运行期容器位置),只记录依赖不折叠
//且 offset_addr 后经 mov 解引用写,写目标无法静态回溯到对象槽,mem_state 会过期
//(例:arr[1]=arr[1]+5 写回后,后续 offset_get arr[1] 仍按 mem_state 旧值 20 折叠 → 结果错)
//保守清空内存状态,避免跨写误折叠
const C_OFFSET_ADDR:opt_visitor=(data:OFFSET_ADDR, tool, bid, index)=>{
    const $=tool.$
    $.Z(data.data,data.offset,data.target)
    tool.mem_state.clear()
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
    [TZ,C_TZ],
    [CALL,C_CALL],
    [OFFSET_GET,C_OFFSET_GET],
    [OFFSET_ADDR,C_OFFSET_ADDR],
    [IN,C_IN],
    [OUT,C_OUT],
    [PARAM_LOAD,C_PARAM_LOAD]
])