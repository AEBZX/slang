import {asm_command, asm_pool, HIRTree} from '../data'

export class ASMTool{
    constructor(public index:number,public g:(data:HIRTree)=>void) {
        this.pool=new Map()
        this.cache=[]
        this.asm=new Map()
        this.list=[]
        this.entry=false
        //根块:入口块,id为0
        this.name=0
        this.code=[]
        this.param=[]
        this.asm.set(0,[[],[]])
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
    entry:boolean
    id(){
        return this.index++
    }
    gen(data:HIRTree){
        this.g(data)
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
export type asm_factory=(data:HIRTree,tool:ASMTool)=>void
export class ASMFactory{
    tool:ASMTool
    constructor(index:number,public data:Map<any,asm_factory>) {
        let self=this
        this.tool=new ASMTool(index,(data:HIRTree)=>{
            for(let [k,v] of self.data)
                if(data instanceof k)
                    v(data,self.tool)
        })
    }
    run(entry:HIRTree[]){
        for(let i of entry)
            this.tool.gen(i)
        return {
            pool:this.tool.pool,
            code:this.tool.asm
        }
    }
}