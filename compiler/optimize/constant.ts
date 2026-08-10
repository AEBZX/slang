import {
    asm_command,
    asm_pool,
    BINARY,
    BIT_NOT, CALL, CMP, CZ, IN,
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
//常量折叠和传播,提前计算
export default (tool: IRTool) => {
    let index = 0
    let $ = tool.$
    for (let [k, v] of tool.command) {
        for (let now of v) {
            //提供
            if (now instanceof LOAD) {
                if($.value(now.data)&&$.value(now.reg)&&$.value(now.reg)==$.p(now.data))
                    tool._mark(k,index)
                $.set(now.reg, now.data, true)
            }
            if (now instanceof MOV) {
                if($.value(now.left)&&$.value(now.right)&&$.value(now.left)==$.v(now.right))
                    tool._mark(k,index)
                $.set(now.left, now.right)
            }
            if (now instanceof OFFSET_SET){
                if($.value(now.offset)&&$.value(now.target)&&$.value(now.value)&&
                   $.mvalue(now.target,now.offset)&&$.mvalue(now.target,now.offset)==$.value(now.value))
                    tool._mark(k,index)
                $.mset(now.target,now.offset,now.value)
            }
            if(now instanceof PARAM_SET) {
                if($.value(now.value)&&$.value(now.param)&&$.pvalue(now.value)&&$.value(now.param)==$.pvalue(now.value))
                    tool._mark(k,index)
                $.pset(now.param, now.value)
            }
            //消费
            if (now instanceof BIT_NOT)
                if($.s(now.data)!=null) {
                    let id=tool._id()
                    tool.state.set(now.data[1], ~$.s(now.data))
                    tool.pool.set(id,~$.s(now.data))
                    tool.replace(k,index,new LOAD(now.data,['reg',id]))
                }
            if(now instanceof NOT)
                if($.value(now.data)) {
                    let id=tool._id()
                    tool.state.set(now.data[1],!($.value(now.data))?1:0)
                    tool.pool.set(id,!($.value(now.data))?1:0)
                    tool.replace(k,index,new LOAD(now.data,['reg',id]))
                }
            if (now instanceof BINARY){
                now.left = $.z(now.left)
                now.right = $.z(now.right)
                if($.value(now.left)&&$.value(now.right)) {
                    let id = tool._id()
                    $.set(now.result, ['reg', _BINARY.get(now.id)($.value(now.left) as number, $.value(now.right) as number)])
                    tool.pool.set(id, _BINARY.get(now.id)($.value(now.left) as number, $.value(now.right) as number))
                    tool.replace(k, index, new LOAD(now.result, ['reg', id]))
                }
            }
            if (now instanceof PARAM_LOAD) {
                now.param = $.z(now.param)
                now.data = $.z(now.data)
                if ($.pvalue(now.param) != null) {
                    let id = tool._id()
                    tool.state.set(now.data[1], $.pvalue(now.param))
                    tool.pool.set(id, $.pvalue(now.param))
                    tool.replace(k, index, new LOAD(now.data, ['reg', id]))
                }
            }
            if (now instanceof IN){
                now.data=$.z(now.data)
                now.oper=$.z(now.oper)
            }
            if(now instanceof OUT){
                now.target=$.z(now.target)
                now.oper=$.z(now.oper)
            }
            if(now instanceof JZ) {
                now.target=$.z(now.target)
                now.cond=$.z(now.cond)
                if(now.cond[1]==1&&now.cond[0]=='reg')tool.replace(k, index, new JMP(now.target))
            }
            if(now instanceof CZ&&$.value(now.cond)==1){
                now.target=$.z(now.target)
                now.cond=$.z(now.cond)
                if(now.cond[1]==1&&now.cond[0]=='reg')tool.replace(k, index, new CALL(now.target))
            }
            if(now instanceof TZ&&$.value(now.cond)==1){
                now.target=$.z(now.target)
                now.cond=$.z(now.cond)
                if(now.cond[1]==1&&now.cond[0]=='reg')tool.replace(k, index, new THREAD(now.target))
            }
            if(now instanceof CMP) {
                now.oper=$.z(now.oper)
                now.right=$.z(now.right)
                now.left=$.z(now.left)
                if ($.value(now.oper) && typeof $.value(now.oper) == 'number' && $.value(now.right) && $.value(now.left))
                    tool.replace(k, index, new MOV(now.oper, ['reg', _CMP.get($.value(now.oper) as number)
                    ($.value(now.right) as number, $.value(now.left) as number)]))
            }
            if(now instanceof PUSH)
                now.target=$.z(now.target)
            if(now instanceof OFFSET_GET){
                now.data=$.z(now.data)
                now.offset=$.z(now.offset)
                now.target=$.z(now.target)
                if ($.mvalue(now.data, now.offset) != null) {
                    let id = tool._id()
                    tool.state.set(now.target[1], $.mvalue(now.data, now.offset))
                    tool.pool.set(id, $.mvalue(now.data, now.offset))
                    tool.replace(k, index, new LOAD(now.target, ['reg', id]))
                }
            }
            index++
        }
        index = 0
    }
}