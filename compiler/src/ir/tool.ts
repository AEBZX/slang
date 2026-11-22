import {
    BINARY,
    BIT_NOT,
    CALL,
    CZ, DELETE, GC, HExpr,
    HIRTree, IN,
    IRArgs, IRTree,
    JMP,
    JZ,
    MOV,
    NOT, OFFSET_GET, OFFSET_SET, OUT,
    PARAM_LOAD, PARAM_SET,
    POP,
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
    ['^','xor'],
    ['==','eq'],
    ['>','grt'],
    ['<','smr']
])
export const VMMap=new Map<string,(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>IRTree>([
    //mov 目标槽,源取槽里的值
    ['mov',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new MOV(p1,to_v(p2))],
    //二元运算 目标槽=左 op 右,两个操作数都取槽里的值
    ['add',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('add',p1,to_v(p2),to_v(p3))],
    ['sub',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('sub',p1,to_v(p2),to_v(p3))],
    ['mul',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('mul',p1,to_v(p2),to_v(p3))],
    ['div',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('div',p1,to_v(p2),to_v(p3))],
    ['mod',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('mod',p1,to_v(p2),to_v(p3))],
    ['shr',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('shr',p1,to_v(p2),to_v(p3))],
    ['shl',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('shl',p1,to_v(p2),to_v(p3))],
    ['and',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('and',p1,to_v(p2),to_v(p3))],
    ['or',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('or',p1,to_v(p2),to_v(p3))],
    ['xor',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BINARY('xor',p1,to_v(p2),to_v(p3))],
    ['not',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new NOT(p1,to_v(p2))],
    ['bit_not',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new BIT_NOT(p1,to_v(p2))],
    ['jmp',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new JMP(to_v(p1),to_v(p2))],
    ['call',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new CALL(to_v(p1),to_v(p2))],
    ['thread',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new THREAD(to_v(p1),to_v(p2))],
    ['jz',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new JZ(to_v(p1),to_v(p2),to_v(p3))],
    ['cz',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new CZ(to_v(p1),to_v(p2),to_v(p3))],
    ['tz',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new TZ(to_v(p1),to_v(p2),to_v(p3))],
    ['ret',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new RET(p1)],
    //push/pop/delete 操作的是槽本身
    ['push',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new PUSH(p1)],
    ['pop',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new POP()],
    ['param_load',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new PARAM_LOAD(p1,to_v(p2))],
    ['param_set',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new PARAM_SET(to_v(p1),to_v(p2))],
    //offset_* 目标槽用 reg,对象与键取槽里的值
    ['offset_set',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OFFSET_SET(to_v(p1),to_v(p2),to_v(p3))],
    ['offset_get',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OFFSET_GET(p1,to_v(p2),to_v(p3))],
    ['delete',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new DELETE(p1)],
    ['gc',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new GC()],
    ['in',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new IN(to_v(p1),to_v(p2))],
    ['out',(p1:IRArgs,p2:IRArgs,p3:IRArgs)=>new OUT(to_v(p1),to_v(p2))]
])
export class IRTool extends PeepholeScope{
    code:Map<number,IRTree[]>=new Map()
    block_id:number=0
    set_arg:IRArgs
    entry_id:number
    const_pool:Set<number>=new Set()
    params:number[]
    replace(id:number){
        this.block_id=id
    }
    push(ir:IRTree){
        this.code.get(this.block_id).push(ir)
    }
    create(id:number=-1){
        const _id=id==-1?this.id():id
        if(!this.code.has(_id))this.code.set(_id,[])
        return _id
    }
    id(){
        return this._id++
    }
    constructor(public _id:number=0) {
        super(null,null)
        this.create(0)
    }
}
export function expr_set(arg:IRArgs,data:HExpr,tool:IRTool,call:(data:HIRTree)=>void){
    tool.set_arg=arg
    call(data)
}
export function to_v(arg:IRArgs){
    arg.type='value'
    return arg
}