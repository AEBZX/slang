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
    //栈帧:把当前函数已分配的所有槽压入操作数栈,返回帧大小(调用返回后frame_pop恢复)
    //槽id全局递增,[1,index)覆盖HIR变量槽与IR临时槽;保存全部而非精确活跃集,冗余但正确
    //跳过槽0:param[0]是返回值约定槽,callee写param_set 0、调用方param_load 0读,不能被帧恢复冲掉
    //push必须用value形式(压槽的值);push reg i在模拟器/VM里压入的是槽号i而非slots[i]的值
    frame_push():number{
        for(let i=1;i<this.index;i++)
            this.code.push(['push',['value',i],['value',0],['value',0]])
        return this.index
    }
    frame_pop(n:number){
        for(let i=n-1;i>=1;i--)
            this.code.push(['pop',['reg',i],['value',0],['value',0]])
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