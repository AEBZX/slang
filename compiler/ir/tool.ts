import {PeepholeScope} from '../utils/lib/tool'
import {asm_command, asm_pool, HIRTree} from '../utils'
export type slang_asm_factory=(data:HIRTree,tool:ASMTool)=>void
export class ASMTool extends PeepholeScope{
    constructor() {
        super(null,null)
        this.pool=new Map()
        this.cache=[]
        this.asm=new Map()
        this.list=[]
        this.entry=false
        //根块:入口块,id为0
        this.name=0
        this.asm.set(0,[[],[]])
        //code/param 必须引用块0的数组,否则顶层初始化指令push到独立数组,pop后丢失
        this.code=this.asm.get(0)[0]
        this.param=this.asm.get(0)[1]
    }
    BinaryDict=new Map([
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
    CmpDict=new Map([
        ['==',0],
        ['!=',1],
        ['>',2],
        ['<',3],
        ['>=',4],
        ['<=',5]
    ])
    pool:asm_pool
    code:asm_command[]
    name:number
    param:number[]
    list:[number,[asm_command[],number[]]][]
    asm:Map<number,[asm_command[],number[]]>
    cache:number[]
    continue_stack:number[]=[]
    entry:boolean
    id(){
        return this.index++
    }
    push(id:number){
        this.list.push([this.name,[this.code,this.param]])
        this.name=id
        //id不存在则自动建空块
        if(!this.asm.has(id))
            this.asm.set(id,[[],[]])
        this.code=this.asm.get(id)[0]
        this.param=this.asm.get(id)[1]
    }
    pop(){
        this.asm.set(this.name,[this.code,this.param])
        let data=this.list.pop()
        this.name=data[0]
        this.code=data[1][0]
        this.param=data[1][1]
    }
}