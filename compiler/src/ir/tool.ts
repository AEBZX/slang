import {
    BINARY,
    CALL,
    CMP,
    CZ, DELETE, GC,
    HExpr,
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
    //not/bit_not 就地取反,操作数就是那个槽
    ['not',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new NOT(p1)],
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
    ['pop',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new POP(p1)],
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
    //是直接调用还取地址
    index_address:boolean=false
    high:boolean=true
    loop(){
        return this.loop_id[this.loop_id.length-1]
    }
    _pool(value:number|string){
        if(this.arg_pool.has(value))return this.arg_pool.get(value)
        const id=IRArgs.reg(this.add(value))
        this.push(new LOAD(id,IRArgs.reg(this.add(value))))
        return id
    }
    add(data:number|string){
        if(this.pool.has(data))return this.pool.get(data)
        const id=this.id()
        this.pool.set(data,id)
        return id
    }
    set_param(param:number[]){
        this.param.set(this.block_id,param)
    }
    get_param():number[]{
        return this.param.get(this.block_id)
    }
    push(ir:IRTree){
        this.ir.get(this.block_id).push(ir)
    }
    create(num:number=null){
        const id=num||this.id()
        this.ir.set(id,[])
        return id
    }
    constructor(id:number=0) {
        super(null,null)
        //id 是上层(HIR 作用域)已经用到的下一个槽号,IR 的槽要与它共用同一段编号
        this.index=id
        this.ir=new Map()
        this.pool=new Map()
        this.arg_pool=new Map()
        this.param=new Map()
        this.loop_id=[]
        //先开一个块,模块头部生成的指令才有地方落
        this.block_id=this.create()
    }
    id(){
        return this.index++
    }
}
//把表达式求值到 arg 槽里,返回**读**它的形式(值形式)。
//入参 arg 保持槽号形式不变,目标操作数还要用它
export function fast_call(arg:IRArgs,value:HExpr,tool:IRTool,call:(data:HIRTree)=>void){
    tool.ls_arg=arg
    call(value)
    return read(arg)
}