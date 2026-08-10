import {asm_args, asm_command, asm_pool} from '../data'
import {
    BINARY,
    BIT_NOT,
    CMP,
    CZ,
    GC,
    IN,
    IR,
    JZ,
    LOAD,
    MOV,
    NOT, OFFSET_GET,
    OFFSET_SET,
    OUT,
    POP,
    PUSH,
    RET,
    TZ
} from '../model/ir'
export const t:{[name:string]:(data:asm_command)=>IR}={
    'mov':(data:asm_command)=>new MOV(data[1],data[2]),
    'add':(data:asm_command)=>new BINARY('add',data[1],data[2],data[3]),
    'sub':(data:asm_command)=>new BINARY('sub',data[1],data[2],data[3]),
    'mul':(data:asm_command)=>new BINARY('mul',data[1],data[2],data[3]),
    'div':(data:asm_command)=>new BINARY('div',data[1],data[2],data[3]),
    'mod':(data:asm_command)=>new BINARY('mod',data[1],data[2],data[3]),
    'shr':(data:asm_command)=>new BINARY('shr',data[1],data[2],data[3]),
    'shl':(data:asm_command)=>new BINARY('shl',data[1],data[2],data[3]),
    'and':(data:asm_command)=>new BINARY('and',data[1],data[2],data[3]),
    'or':(data:asm_command)=>new BINARY('or',data[1],data[2],data[3]),
    'xor':(data:asm_command)=>new BINARY('xor',data[1],data[2],data[3]),
    'load':(data:asm_command)=>new LOAD(data[1],data[2]),
    'call':(data:asm_command)=>new CZ(data[1],data[2]),
    'thread':(data:asm_command)=>new TZ(data[1],data[2]),
    'jmp':(data:asm_command)=>new JZ(data[1],data[2]),
    'in':(data:asm_command)=>new IN(data[1],data[2]),
    'out':(data:asm_command)=>new OUT(data[1],data[2]),
    'not':(data:asm_command)=>new NOT(data[1]),
    'bit_not':(data:asm_command)=>new BIT_NOT(data[1]),
    'cmp':(data:asm_command)=>new CMP(data[1],data[2],data[3]),
    'push':(data:asm_command)=>new PUSH(data[1]),
    'pop':(data:asm_command)=>new POP(data[1]),
    'ret':(data:asm_command)=>new RET(),
    'gc':(data:asm_command)=>new GC(),
    'offset_set':(data:asm_command)=>new OFFSET_SET(data[1],data[2],data[3]),
    'offset_get':(data:asm_command)=>new OFFSET_GET(data[1],data[2],data[3])
}
//准备工作
export function to(data:Map<number,asm_command[]>){
    let ret=new Map<number,IR[]>()
    for(let [k,v] of data)
        ret.set(k,v.map(data=>t[data[0]](data)))
    return ret
}
export class IRTool{
    command:Map<number,IR[]>
    pool:Map<number,number|string>
    mark:[number,number][]
    changed:boolean
    state:Map<number,number|string|null>
    mem_state:Map<[number,number|string],number|string|null>
    param_state:Map<number, number | string | null>
    id:number
    private _replace:[number,number,IR][]
    $={
        p:(data:asm_args)=>this.pool.get(data[1]),
        v:(data:asm_args)=>data[1],
        s:(data:asm_args)=>this.state.get(data[1])||null,
        ps:(id:asm_args)=>this.param_state.get(id[1])||null,
        ms:(data:asm_args,index:asm_args)=>this.mem_state.get([data[1],index[1]])||null,
        set:(key:asm_args,value:asm_args,p:boolean=false)=>{
            let left:number
            let c=true
            if(IR.isNumber(key))
                left=key[1]
            else if(typeof this.state.get(key[1])=='number')
                left=this.state.get(key[1]) as number
            else c=false
            if(!c)return
            if(IR.isNumber(value))
                this.state.set(left,p?this.$.p(value):value[1])
            else if(p&&typeof this.state.get(value[1])=='number')
                this.state.set(left,this.pool.get(this.state.get(value[1]) as number))
            else if(!p&&this.state.get(value[1])!=null)
                this.state.set(left,this.state.get(value[1]))
        },
        mset:(target:asm_args,offset:asm_args,value:asm_args)=>{
            let t:number=null,o:number|string=null,v:number|string=null
            if(IR.isNumber(target))
                t=target[1]
            else if(typeof this.state.get(target[1])=='number')
                t=this.state.get(target[1]) as number
            if(IR.isNumber(offset))
                o=offset[1]
            else if(this.state.get(offset[1])!=null)
                o=this.state.get(offset[1])
            if(IR.isNumber(value))
                v=value[1]
            else if(this.state.get(value[1])!=null)
                v=this.state.get(value[1])
            if(t==null||o==null||v==null)return
            this.mem_state.set([t,o],v)
        },
        pset:(id:asm_args,value:asm_args)=>{
            let left:number
            let c=true
            if(IR.isNumber(id))
                left=id[1]
            else if(typeof this.state.get(id[1])=='number')
                left=this.state.get(id[1]) as number
            else c=false
            if(!c)return
            if(IR.isNumber(value))
                this.state.set(left,value[1])
            else if(this.state.get(value[1])!=null)
                this.state.set(left,this.state.get(value[1]))
        },
        value:(data:asm_args)=>IR.isNumber(data)?data[1]:this.state.get(data[1])||null,
        mvalue:(target:asm_args,offset:asm_args)=>this.mem_state.get([this.$.value(target) as number,this.$.value(offset)])||null,
        pvalue:(id:asm_args)=>this.state.get(this.$.value(id) as number)||null,
        z:(data:asm_args):asm_args=>this.$.value(data)&&typeof this.$.value(data)=='number'?['reg',this.$.value(data) as number]:data
    }
    constructor(id:number,command:Map<number,IR[]>,pool:Map<number,number|string>) {
        this.id=id
        this.command=command
        this.pool=pool
        this.mark=[]
        this.changed=false
        this._replace=[]
        this.state=new Map<number, number | string | null>()
        this.param_state=new Map<number, number | string | null>()
        this.mem_state=new Map<[number, number | string], number | string | null>()
    }
    dead(bid:number,index:number){
        return this.mark.includes([bid,index])
    }
    _id(){
        return this.id++
    }
    //原地替换
    replace(bid:number,index:number,ir:IR){
        this.changed=true
        this._replace.push([bid,index,ir])
    }
    _mark(bid:number,index:number){
        this.changed=true
        this.mark.push([bid,index])
    }
    //集体删除和替换
    sweep(){
        this.changed=false
        //替换
        for(let [bid,index,IR] of this._replace)
            this.command.get(bid)[index]=IR
        //删除
        let groups=new Map<number,number[]>()
        for(let [bid,idx] of groups)
            for(let i of idx.sort((a,b)=>b-a))
                this.command.get(bid).splice(i,1)
        this.mark=[]
        this._replace=[]
    }
}