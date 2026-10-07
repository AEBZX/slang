import {HExpr, HIRTree, IRArgs, IRTree} from '../utils'
import {PeepholeScope} from '../utils/lib/tool'
export type slang_ir_factory=(data:HIRTree,tool:IRTool,call:(data:HIRTree)=>void)=>void
const BinaryDict=new Map([
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
const CmpDict=new Map([
    ['==',0],
    ['>',1],
    ['>=',2],
    ['!=',3],
    ['<',4],
    ['<=',5]
])
export class IRTool extends PeepholeScope{
    index:number=0
    ir:Map<number,IRTree[]>
    pool:Map<number|string,number>
    block_id:number
    ls_arg:IRArgs=null
    //是直接调用还取地址
    index_address:boolean=false
    add(data:number|string){
        if(this.pool.has(data))return this.pool.get(data)
        const id=this.id()
        this.pool.set(data,id)
        return id
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