import {asm_args, asm_command, asm_pool, number_radix} from '../data'
import {
    BINARY,
    BIT_NOT,
    CALL,
    CMP,
    CZ,
    DELETE,
    GC,
    IN,
    IR,
    JZ,
    LOAD,
    MOV,
    NOT, OFFSET_ADDR, OFFSET_GET, STR_GET,
    OFFSET_SET,
    OUT,
    PARAM_LOAD,
    PARAM_SET,
    POP,
    PUSH,
    RET,
    RETN,
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
    //call=函数调用(压函数帧),cz=块调用(if/while,压块帧);两者帧类型不同,return(RETN)弹到函数帧
    //is_func_call 标识:call 固定 1,cz 固定 0
    'call':(data:asm_command)=>new CALL(data[1],data[2]),
    'cz':(data:asm_command)=>new CZ(data[1],data[2],data[3]),
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
    'retn':(data:asm_command)=>new RETN(),
    'gc':(data:asm_command)=>new GC(),
    'offset_set':(data:asm_command)=>new OFFSET_SET(data[1],data[2],data[3]),
    'offset_get':(data:asm_command)=>new OFFSET_GET(data[1],data[2],data[3]),
    'str_get':(data:asm_command)=>new STR_GET(data[1],data[2],data[3]),
    'offset_addr':(data:asm_command)=>new OFFSET_ADDR(data[1],data[2],data[3]),
    'param_set':(data:asm_command)=>new PARAM_SET(data[1],data[2]),
    'param_load':(data:asm_command)=>new PARAM_LOAD(data[1],data[2]),
    'delete':(data:asm_command)=>new DELETE(data[1])
}
export type opt_visitor =(data:IR, tool:IRTool, bid:number, index:number)=>void
export type ud_table={
    def:Map<number,number[]>,
    use:Map<number,number[]>,
    barrier:number[]
}
export type cfg={[block:number]:{last:[number,boolean,boolean,number][],next:[number,boolean,boolean,number][],call:number}}
export type slot=(data:IR,tool:IRTool)=>[number[],number[]]
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
    mem_state:Map<number,Map<number|string,number|string|null>>
    param_state:Map<number, number | string | null>
    last_touch:Map<number,[number,number,boolean,IR]>
    ud:ud_table
    cfg:cfg
    guse:Set<number>
    //已插 delete 的变量槽(kill.ts 去重,跨优化轮次保留)
    deleted:Set<number>
    //跨块写:槽→写入它的块集合(循环体跨块修改变量,块内折叠需保守)
    cross:Map<number,Set<number>>
    //成员方法块集合(cfg.ts 经 offset_set 引用收集):运行期调用目标无法静态解析,可达剪枝需保留
    methods:Set<number>
    id:number
    private _replace:[number,number,IR][]
    $={
        p:(data:asm_args)=>this.pool.get(data[1]),
        v:(data:asm_args)=>data[1],
        s:(data:asm_args)=>this.state.get(data[1]),
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
            //value 解析不出(槽未知/未初始化):必须清空 left 残留状态,
            //否则 mov x=未知 后 x 仍保留旧常量,后续 cmp/运算被错误折叠
            else
                this.state.set(left,null)
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
            this.mem_state.set(t,this.mem_state.has(t)?new Map([...this.mem_state.get(t),[o,v]]):new Map([[o,v]]))
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
                this.param_state.set(left,value[1])
            else if(this.state.get(value[1])!=null)
                this.param_state.set(left,this.state.get(value[1]))
        },
        rvalue:(data:asm_args)=>this.state.get(this.$.value(data) as number),
        value:(data:asm_args)=>IR.isNumber(data)?data[1]:this.state.get(data[1]),
        mvalue:(target:asm_args,offset:asm_args)=>{
            let t=this.mem_state.get(this.$.value(target) as number)
            if(t==null)return null
            return t.get(this.$.value(offset))
        },
        pvalue:(id:asm_args)=>this.state.get(this.$.value(id) as number),
        z:(data:asm_args):asm_args=>this.$.value(data)&&typeof this.$.value(data)=='number'?['reg',this.$.value(data) as number]:data,
        Z:(...data:asm_args[])=>{
            for(let i of data)
                this.$.z(i)
        },
        t:(id:asm_args)=>this.last_touch.get(this.$.value(id) as number),
        tset:(id:asm_args,bid:number,index:number,w:boolean,ir:IR)=>this.last_touch.set(this.$.value(id) as number,[bid,index,w,ir]),
        //reg写目标直接是槽id;value间接写无法静态定槽(由barrier处理)
        rs:(id:asm_args)=>id[0]=='reg'?id[1]:null,
        //value读的是该槽,reg只是地址传递不读存储
        ws:(data:asm_args)=>data[0]=='reg'?null:data[1],
        _s:(left:asm_args[],right:asm_args[]):[number[],number[]]=>[left.map(i=>this.$.rs(i) as number)
            ,right.map(i=>this.$.ws(i) as number)],
        //在[index,def]之内是否存在读data,如果无,mark data
        dce:(data:asm_args,bid:number,index:number)=>{
            let _slot=this.$.rs(data)
            //仅根块(块0)的函数槽初始化可能被其他块读取,跨块use保护;
            //其他块内本块use已由ud.use处理,过度保护会保留死代码
            if(bid==0&&_slot!=null&&this.guse.has(_slot))return
            let interval=this.ud.def.get(_slot)
            if(interval==null)return
            let b=interval.filter(i=>i>index)[0]
            if(b==null)b=this.command.get(bid).length
            let c=false
            this.ud.barrier.forEach(i=>{
                if(index<=i&&i<b)
                    c=true
            })
            if(c)return
            let use=this.ud.use.get(_slot)
            if(use!=null)
                for(let i of use)
                    //自反指令(add 9=9+10)先读后写,其use位于下个def(b)自身,须算作被使用
                    if(index<=i&&i<=b)
                        return
            this._mark(bid,index)
        },
        cp1:(data:asm_args,bid:number,index:number)=>{
            let _data=this.$.ws(data)
            if(_data==null)return null
            let defs=this.ud.def.get(_data)
            if(defs==null)return null
            let w=defs.filter(i=>i<index)
            if(w.length==0)return null
            let end=w[w.length-1]
            //如果index~end有barrier,return null
            for(let i of this.ud.barrier)
                if(index<=i&&i<end)
                    return null
            let ir=this.command.get(bid)[end]
            if(!(ir instanceof MOV||ir instanceof LOAD))
                return null
            if(ir instanceof LOAD&&typeof this.$.value(ir.data)!='number')
                return null
            data=ir instanceof MOV?ir.right:['reg',this.pool.get(this.$.value(ir.data) as number) as number]
        },
        cp2:(data:asm_args,bid:number,index:number,reg:asm_args)=>{
            let _data=this.$.ws(data)
            if(_data==null)return
            //解引用写目标(mov [value X] [value Y])无法替换成LOAD/MOV(reg,右值),直接传播会生成非法LOAD [value X]
            if(reg[0]!='reg')return
            let defs=this.ud.def.get(_data)
            if(defs==null)return
            let w=defs.filter(i=>i<index)
            if(w.length==0)return
            let end=w[w.length-1]
            for(let i of this.ud.barrier)
                if(index<=i&&i<end)
                    return
            let ir=this.command.get(bid)[end]
            if(!(ir instanceof MOV||ir instanceof LOAD))
                return
            if(ir instanceof LOAD&&typeof this.$.value(ir.data)!='number')
                return
            this.replace(bid,index,ir instanceof LOAD?new LOAD(reg,ir.data):new MOV(reg,ir.right))
        }
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
        this.mem_state=new Map()
        this.last_touch=new Map()
        this.guse=new Set()
        this.deleted=new Set()
        this.cross=new Map<number,Set<number>>()
        this.methods=new Set<number>()
        this._kill=[]
    }
    _id(){
        return this.id++
    }
    //原地替换
    replace(bid:number,index:number,ir:IR){
        this.changed=true
        this._replace.push([bid,index,ir])
    }
    //指令是否已被本 pass 折叠(在 _replace 中待 sweep 应用)
    //CONSTANT 折叠会更新 state,后续 PEEPHOLE 读到折叠结果误判(如 sub 的 l==r)生成错误指令
    replaced(bid:number,index:number){
        return this._replace.some(([b,i])=>b==bid&&i==index)
    }
    dead(bid:number,index:number){
        return this.mark.includes([bid,index])
    }
    _mark(bid:number,index:number){
        this.changed=true
        this.mark.push([bid,index])
    }
    private _kill:number[]
    kill(bid:number){
        this.changed=true
        this._kill.push(bid)
    }
    //集体删除和替换
    sweep(){
        this.changed=false
        //替换
        for(let [bid,index,IR] of this._replace)
            this.command.get(bid)[index]=IR
        //删除
        let groups=new Map<number,number[]>()
        for(let i of this.mark)
            groups.set(i[0],groups.has(i[0])?[...groups.get(i[0]),i[1]]:[i[1]])
        for(let [bid,idx] of groups)
            for(let i of idx.sort((a,b)=>b-a))
                this.command.get(bid).splice(i,1)
        for(let i of this._kill)
            this.command.delete(i)
        this.ud=null
        this.mark=[]
        this.changed=false
        this._replace=[]
        this.state=new Map<number, number | string | null>()
        this.param_state=new Map<number, number | string | null>()
        this.mem_state=new Map()
        this.last_touch=new Map()
        this._kill=[]
    }
}