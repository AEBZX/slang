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
export const VMMap=new Map<string,any>([
    ['mov',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new MOV(p1,p2)],
    ['add',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('add',p1,p2,p3)],
    ['sub',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('sub',p1,p2,p3)],
    ['mul',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('mul',p1,p2,p3)],
    ['div',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('div',p1,p2,p3)],
    ['mod',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('mod',p1,p2,p3)],
    ['shr',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('shr',p1,p2,p3)],
    ['shl',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('shl',p1,p2,p3)],
    ['and',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('and',p1,p2,p3)],
    ['or',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('or',p1,p2,p3)],
    ['xor',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('xor',p1,p2,p3)],
    ['load',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new LOAD(p1,p2)],
    ['not',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new NOT(p1)],
    ['cmp',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new CMP(p1,p2,p3)],
    ['jmp',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new JMP(p1,p2)],
    ['call',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new CALL(p1,p2)],
    ['thread',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new THREAD(p1,p2)],
    ['jz',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new JZ(p1,p2,p3)],
    ['cz',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new CZ(p1,p2,p3)],
    ['tz',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new TZ(p1,p2,p3)],
    ['ret',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new RET(p1)],
    ['push',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new PUSH(p1)],
    ['pop',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new POP(p1)],
    ['param_load',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new PARAM_LOAD(p1,p2)],
    ['param_set',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new PARAM_SET(p1,p2)],
    ['offset_set',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OFFSET_SET(p1,p2,p3)],
    ['offset_get',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OFFSET_GET(p1,p2,p3)],
    ['offset_addr',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OFFSET_ADDR(p1,p2,p3)],
    ['str_offset_set',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OFFSET_STR_SET(p1,p2,p3)],
    ['str_offset_get',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OFFSET_STR_GET(p1,p2,p3)],
    ['str_offset_addr',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OFFSET_STR_ADDR(p1,p2,p3)],
    ['delete',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new DELETE(p1)],
    ['gc',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new GC()],
    ['in',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new IN(p1,p2)],
    ['out',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OUT(p1,p2)]
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
        this.ir=new Map()
        this.index=0
    }
    id(){
        return this.index++
    }
}
export function fast_call(arg:IRArgs,value:HExpr,tool:IRTool,call:(data:HIRTree)=>void){
    tool.ls_arg=arg
    call(value)
    return arg
}