import {asm_command, asm_pool, HIRTree} from '../data'

export class ASMTool{
    constructor(public index:number,public g:(data:HIRTree)=>asm_command) {
        this.pool=new Map()
        this.cache=[]
        this.asm=new Map()
        this.list=[]
    }
    pool:asm_pool
    code:asm_command[]
    name:number
    param:number[]
    list:[number,[asm_command[],number[]]][]
    asm:Map<number,[asm_command[],number[]]>
    cache:number[]
    id(){
        return this.index++
    }
    gen(data:HIRTree){
        return this.g(data)
    }
    push(id:number){
        this.list.push([this.name,[this.code,this.param]])
        this.name=id
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
export type asm_factory=(data:HIRTree,tool:ASMTool)=>void
export class ASMFactory{
}