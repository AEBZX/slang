import {
    HArrayExpr, HMapExpr,
    BINARY, BIT_NOT,
    CALL,
    CMP,
    CZ, DELETE, GC,
    HArgumentsExpr, HExpr, HIdentifierExpr, HIndexExpr, HMemberExpr,
    HIRTree, IN,
    IRArgs,
    IRTree,
    JMP,
    JZ,
    LOAD,
    MOV,
    NOT, OFFSET_ADDR, OFFSET_GET, OFFSET_SET, OFFSET_STR_ADDR,
    OFFSET_STR_GET, OFFSET_STR_SET, OUT, PARAM_LOAD, PARAM_SET, POP,
    PUSH,
    RET,
    THREAD,
    TZ
} from '../utils'
import {PeepholeScope} from '../utils/lib/tool'
export type slang_ir_factory=(data:HIRTree,tool:IRTool,call:(data:HIRTree)=>void)=>void
export const BinaryDict=new Map([
    ['+','add'],
    ['-','sub'],
    ['*','mul'],
    ['/','div'],
    ['%','mod'],
    ['>>','shr'],
    ['<<','shl'],
    ['&','and'],
    ['|','or'],
    ['^','xor']
])
export const CmpDict=new Map([
    ['==',0],
    ['>',1],
    ['>=',2],
    ['!=',3],
    ['<',4],
    ['<=',5]
])
//操作数形式只有两种(见 vm/runtime/runtime.h):
//reg=原样值(槽号/池id/字面量);value=槽里的值 var[x]
//所以:目标槽用 reg,读一个槽的内容用 value;写穿地址也用 value(见 postfix ++)
export function read(arg:IRArgs){
    return IRArgs.value(arg.data)
}
export const VMMap=new Map<string,any>([
    //mov 目标槽,源取槽里的值
    ['mov',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new MOV(p1,read(p2))],
    //二元运算 目标槽=左 op 右,两个操作数都取槽里的值
    ['add',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('add',p1,read(p2),read(p3))],
    ['sub',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('sub',p1,read(p2),read(p3))],
    ['mul',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('mul',p1,read(p2),read(p3))],
    ['div',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('div',p1,read(p2),read(p3))],
    ['mod',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('mod',p1,read(p2),read(p3))],
    ['shr',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('shr',p1,read(p2),read(p3))],
    ['shl',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('shl',p1,read(p2),read(p3))],
    ['and',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('and',p1,read(p2),read(p3))],
    ['or',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('or',p1,read(p2),read(p3))],
    ['xor',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('xor',p1,read(p2),read(p3))],
    //load 的源就是池 id 本身,不能取槽值
    ['load',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new LOAD(p1,p2)],
    //not a b 就是 a=!b:第二个操作数是源,要取槽里的值
    ['not',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new NOT(p1,read(p2))],
    ['bit_not',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BIT_NOT(p1,read(p2))],
    //cmp 第一个操作数既当目标又当左值(就地),右值与运算符编号取槽里的值
    ['cmp',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new CMP(p1,read(p2),read(p3))],
    ['jmp',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new JMP(read(p1),read(p2))],
    ['call',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new CALL(read(p1),read(p2))],
    ['thread',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new THREAD(read(p1),read(p2))],
    ['jz',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new JZ(read(p1),read(p2),read(p3))],
    ['cz',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new CZ(read(p1),read(p2),read(p3))],
    ['tz',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new TZ(read(p1),read(p2),read(p3))],
    ['ret',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new RET(p1)],
    //push/pop/delete 操作的是槽本身
    ['push',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new PUSH(p1)],
    ['pop',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new POP()],
    ['param_load',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new PARAM_LOAD(p1,read(p2))],
    ['param_set',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new PARAM_SET(read(p1),read(p2))],
    //offset_* 目标槽用 reg,对象与键取槽里的值
    ['offset_set',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OFFSET_SET(read(p1),read(p2),read(p3))],
    ['offset_get',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OFFSET_GET(p1,read(p2),read(p3))],
    ['offset_addr',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OFFSET_ADDR(p1,read(p2),read(p3))],
    ['str_offset_set',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OFFSET_STR_SET(read(p1),read(p2),read(p3))],
    ['str_offset_get',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OFFSET_STR_GET(p1,read(p2),read(p3))],
    ['str_offset_addr',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OFFSET_STR_ADDR(p1,read(p2),read(p3))],
    ['delete',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new DELETE(p1)],
    ['gc',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new GC()],
    //in 的 target 是原始槽号(写目标变量),out 的 data 取槽里的对象句柄
    ['in',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new IN(read(p1),p2)],
    ['out',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OUT(read(p1),read(p2))]
])
export class IRTool extends PeepholeScope{
    index:number=0
    ir:Map<number,IRTree[]>
    param:Map<number,number[]>
    pool:Map<number|string,number>
    arg_pool:Map<number|string,IRArgs>
    block_id:number
    ls_arg:IRArgs=null
    entry:boolean=false
    loop_id:number[]
    //HIR 标签 id -> IR 块号:标签号是 HIR 自己分的,不能直接当块号用
    label:Map<number,number>
    //当前所在函数的参数表(子块继承用)
    current_param:number[]=[]
    //是直接调用还取地址
    index_address:boolean=false
    high:boolean=true
    //登记块:模块容器
    reg_block:number=-1
    loop(){
        return this.loop_id[this.loop_id.length-1]
    }
    _pool(value:number|string){
        const key=this.block_id+':'+value
        if(this.arg_pool.has(key))return this.arg_pool.get(key)
        const slot=IRArgs.reg(this.id())
        this.push(new LOAD(slot,IRArgs.reg(this.add(value))))
        const ret=IRArgs.value(slot.data)
        this.arg_pool.set(key,ret)
        return ret
    }
    add(data:number|string){
        if(this.pool.has(data))return this.pool.get(data)
        const id=this.id()
        this.pool.set(data,id)
        return id
    }
    set_param(param:number[]){
        this.param.set(this.block_id,param)
        this.current_param=param
    }
    get_param():number[]{
        //分支/循环/await 这些子块没有自己登记参数表,继承外层函数的
        return this.param.get(this.block_id)??this.current_param
    }
    push(ir:IRTree){
        this.ir.get(this.block_id).push(ir)
    }
    create(num:number=null){
        //0 是合法块号(main),不能用 || 兜底
        const id=num==null?this.id():num
        this.ir.set(id,[])
        return id
    }
    constructor(id:number=0) {
        super(null,null)
        this.index=id
        this.ir=new Map()
        this.pool=new Map()
        this.arg_pool=new Map()
        this.param=new Map()
        this.loop_id=[]
        this.label=new Map()
        //先开一个块
        this.block_id=this.create()
        this.reg_block=this.block_id
    }
    id(){
        return this.index++
    }
    label_id(id:number){
        if(!this.label.has(id))this.label.set(id,this.id())
        return this.label.get(id)
    }
}
export function container_of(expr:any,tool:IRTool,call:(data:any)=>void){
    if(expr!=null&&expr.constructor!=null&&expr.constructor.name=='HIdentifierExpr')return IRArgs.reg(expr.name)
    if(expr instanceof HArrayExpr||expr instanceof HMapExpr){
        const literal=IRArgs.reg(tool.id())
        fast_call(literal,expr,tool,call)
        return IRArgs.reg(literal.data)
    }
    const slot=IRArgs.reg(tool.id())
    fast_call(slot,expr,tool,call)
    return IRArgs.value(slot.data)
}
export function inc_slot(data:any){
    const target:any=data.target
    return target instanceof HIdentifierExpr?target.name:null
}
//表达式里有没有函数调用:被调函数体会覆写同名槽,跨调用存活的槽要先压栈
export function has_call(expr:any):boolean{
    if(expr==null||typeof expr!='object')return false
    if(expr instanceof HArgumentsExpr)return true
    return Object.values(expr).some(v=>Array.isArray(v)?v.some(has_call):v instanceof Object&&has_call(v))
}
export function is_place_target(target:any){
    return target instanceof HIndexExpr||target instanceof HMemberExpr
}
export function inc_place_target(data:any,tool:IRTool,call:any,op:string,is_prefix:boolean){
    const target:any=data.target
    const container=container_of(target.target,tool,call)
    const offset=target instanceof HMemberExpr?tool._pool(target.member)
        :fast_call(IRArgs.reg(tool.id()),target.index,tool,call)
    const old=IRArgs.reg(tool.id())
    tool.push(new OFFSET_GET(old,container,offset))
    const next=IRArgs.reg(tool.id())
    tool.push(new BINARY(op,next,IRArgs.value(old.data),IRArgs.reg(1)))
    tool.push(new OFFSET_SET(container,offset,IRArgs.value(next.data)))
    return is_prefix?IRArgs.value(next.data):IRArgs.value(old.data)
}
export function container_element(element:any,tool:IRTool,call:(data:any)=>void){
    if(!(element instanceof HArrayExpr||element instanceof HMapExpr))
        return fast_call(IRArgs.reg(tool.id()),element,tool,call)
    const slot=IRArgs.reg(tool.id())
    const saved=tool.ls_arg
    tool.ls_arg=slot
    call(element)
    tool.ls_arg=saved
    return IRArgs.reg(slot.data)
}
export function fast_call(arg:IRArgs,value:HExpr,tool:IRTool,call:(data:HIRTree)=>void){
    tool.ls_arg=arg
    call(value)
    return read(arg)
}