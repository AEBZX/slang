import {IRArgs, IRTree, MOV, number_radix} from '../utils'
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
    private _sweep:[number,number,IRTree[]][]=[]
    r_pool:Map<number|string,number>=new Map()
    //复制传播
    //最简单,a可以替换为b
    //针对mov value a value b(*a=b->a=&b)->value a->reg b
    cpy_rep_table:Map<IRArgs,IRArgs>=new Map()
    //特殊,可以把a作为b的左值
    cpy_set_table:Map<IRArgs,{left:string,command:IRTree}>
    //常量表
    cprop_table:Map<IRArgs,number|string>=new Map()
    //折叠用,记录data[offset]的值
    cprop_offset_table:Map<IRArgs[],number|string>=new Map()
    //记录param[arg]的值
    cprop_param_table:Map<IRArgs,number|string>=new Map()
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
    clear(){
        this.cpy_rep_table.clear()
        this.cpy_set_table.clear()
        this.cprop_table.clear()
        this.cprop_offset_table.clear()
        this.cprop_param_table.clear()
    }
}
export function copy(ir:IRArgs,tool:OPTTool){
    return tool.cpy_rep_table.get(ir)??ir
}
export function mov_rep(ir:MOV,tool:OPTTool){
    const rep=tool.cpy_set_table.get(ir.right)
    if(rep==null)return ir
    rep.command[rep.left]=ir.left
    return rep.command
}
export function cprop_record(set:IRArgs, ir:IRArgs, tool:OPTTool){
    if(set.type=='value')return
    tool.cprop_table.delete(set)
    set=to_v(set)
    if(ir.type=='reg')
        tool.cprop_table.set(set,ir.data)
    if(tool.cprop_table.has(ir))
        tool.cprop_table.set(set,tool.cprop_table.get(ir))
}
export function cprop_offset_record(set:IRArgs[], ir:IRArgs, tool:OPTTool){
    if(set.every(i=>i.type='value'))return
    tool.cprop_offset_table.delete(set)
    set=set.map(to_v)
    if(ir.type=='reg')
        tool.cprop_offset_table.set(set,ir.data)
    if(tool.cprop_table.has(ir))
        tool.cprop_offset_table.set(set,tool.cprop_table.get(ir))
}
export function cprop_param_record(set:IRArgs, ir:IRArgs, tool:OPTTool){
    if(set.type=='value')return
    tool.cprop_param_table.delete(set)
    set=to_v(set)
    if(ir.type=='reg')
        tool.cprop_param_table.set(set,ir.data)
    if(tool.cprop_table.has(ir))
        tool.cprop_param_table.set(set,tool.cprop_table.get(ir))
}
export function cprop(ir:IRArgs,tool:OPTTool){
    if(ir.type=='value')return ir
    if(!tool.cprop_table.has(ir))return ir
    if(typeof tool.cprop_table.get(ir)!='number')return ir
    return IRArgs.reg(tool.cprop_table.get(ir) as number)
}
export function is_constant(...ir:IRArgs[]){
    return ir.every(i => i.type == 'reg')
}
export function to_v(ir:IRArgs){
    ir.type='value'
    return ir
}
export function to_r(ir:IRArgs){
    ir.type='reg'
    return ir
}