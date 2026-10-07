import {IRArgs, IRTree} from '../utils'
import {PeepholeScope} from '../utils/lib/tool'
export const BINARYMap=new Map([
    ['add',(a:number,b:number)=>a+b],
    ['sub',(a:number,b:number)=>a-b],
    ['mul',(a:number,b:number)=>a*b],
    ['div',(a:number,b:number)=>a/b],
    ['mod',(a:number,b:number)=>a%b],
    ['shl',(a:number,b:number)=>a<<b],
    ['shr',(a:number,b:number)=>a>>b],
    ['and',(a:number,b:number)=>a&b],
    ['or',(a:number,b:number)=>a|b],
    ['xor',(a:number,b:number)=>a^b]
])
export const CMPMap=new Map([
    [0,(a:number|string,b:number|string)=>a==b?1:0],
    [1,(a:number|string,b:number|string)=>a>b?1:0],
    [2,(a:number|string,b:number|string)=>a>=b?1:0],
    [3,(a:number|string,b:number|string)=>a!=b?1:0],
    [4,(a:number|string,b:number|string)=>a<b?1:0],
    [5,(a:number|string,b:number|string)=>a<=b?1:0]
])
export type slang_opt_visitor =(data:IRTree, tool:OPTTool, bid:number, index:number)=>void
export class OPTTool extends PeepholeScope{
    private pool_state:Map<number,number|string>=new Map()
    private state_pool:Map<number|string,number>=new Map()
    private _sweep:[number,number,IRTree[]][]=[]
    private r_pool:Map<number|string,number>=new Map()
    pool_set(key:number,value:number|string){
        if(key==null||value==null)return
        this.pool_state.set(key,value)
        this.state_pool.set(value,key)
    }
    pool_get(key:number){
        if(key==null)return null
        return this.pool_state.get(key)
    }
    getForValue(value:number|string){
        if(value==null)return null
        if(this.r_pool.has(value))
            return this.r_pool.get(value)
        const id=this.id()
        this.r_pool.set(value,id)
        this.pool.set(id,value)
        return id
    }
    constructor(public index:number,public command:Map<number,IRTree[]>,public pool:Map<number,number|string>) {
        super(null,null)
        for(const [k,v] of pool)
            this.r_pool.set(v,k)
    }
    id(){
        return this.index++
    }
    sweep(bid:number,index:number,...ir:IRTree[]){
        if(this._sweep.find(i=>i[0]==bid&&i[1]==index))return
        this._sweep.push([bid,index,ir])
    }
}
export function is_reg(arg:IRArgs){
    return arg.type=='reg'
}
export function value(arg:IRArgs,tool:OPTTool){
    if(is_reg(arg))return arg.data
    //取arg.data寄存器的值
    return tool.pool_get(arg.data)
}
export function rep(arg:IRArgs,tool:OPTTool){
    const _arg=value(arg,tool)
    if(arg==null||typeof _arg!='number')return arg
    return IRArgs.reg(_arg)
}