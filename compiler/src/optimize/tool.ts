import {BINARY, BIT_NOT, CMP, IN, IRArgs, IRTree, LOAD, MOV, NOT, OFFSET_GET, PARAM_LOAD} from '../utils'
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
//所有传播表都按槽号/参数号做键:IR 里同一个槽在不同指令里是不同的 IRArgs 实例,
//用对象身份做键永远命中不了
export class OPTTool extends PeepholeScope{
    private _sweep:[number,number,IRTree[]][]=[]
    //常量池:id -> 值(与 IRTool.pool 相反)
    pool:Map<number,number|string>=new Map()
    //槽号 -> 内容与它相同的那个参数(拷贝传播)
    cpy_rep_table:Map<number,IRArgs>=new Map()
    //槽号 -> 产出它的指令,可以把写这个槽的 mov 直接并进去
    cpy_set_table:Map<number,{left:string,command:IRTree}>=new Map()
    //槽号 -> 已知常量(只记数字)
    cprop_table:Map<number,number>=new Map()
    //"对象槽:键槽" -> 已知常量
    cprop_offset_table:Map<string,number>=new Map()
    //参数号 -> 已知常量
    cprop_param_table:Map<number,number>=new Map()
    changed:boolean=false
    //用于last环节:字符串操作数 -> 承载它的槽
    id_pool:Map<number|string,number>=new Map()
    constructor(public index:number,public command:Map<number,IRTree[]>,public r_pool:Map<number|string,number>) {
        super(null,null)
        for(const [k,v] of r_pool)
            this.pool.set(v,k)
    }
    pool_id(data:number|string){
        if(this.r_pool.has(data))return this.r_pool.get(data)
        const id=this.id()
        this.r_pool.set(data,id)
        this.pool.set(id,data)
        return id
    }
    id(){
        return this.index++
    }
    sweep(bid:number,index:number,...ir:IRTree[]){
        this.changed=true
        //同一位置只认第一次改写(刻意的:更早的轮次语义更贴近原始指令)
        if(this._sweep.find(i=>i[0]==bid&&i[1]==index))return
        this._sweep.push([bid,index,ir])
    }
    flush(){
        //按块聚合,同一块内按原来的下标升序拼回去,避免前面的改写让后面的下标错位
        const sweep=new Map<number,[number,IRTree[]][]>()
        for(const [bid,index,ir] of this._sweep){
            let list=sweep.get(bid)
            if(list==null)sweep.set(bid,list=[])
            list.push([index,ir])
        }
        for(const [bid,list] of sweep){
            const commands=this.command.get(bid)
            if(commands==null)continue
            list.sort((a,b)=>a[0]-b[0])
            let out:IRTree[]=[]
            let cursor=0
            for(const [index,ir] of list){
                out.push(...commands.slice(cursor,index),...ir)
                cursor=index+1
            }
            out.push(...commands.slice(cursor))
            this.command.set(bid,out)
        }
        this._sweep=[]
        this.changed=false
    }
    clear(){
        this.cpy_rep_table.clear()
        this.cpy_set_table.clear()
        this.cprop_table.clear()
        this.cprop_offset_table.clear()
        this.cprop_param_table.clear()
    }
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
//左值对应右值
export function to_peephole_l(ir:IRArgs){
    if(ir.type=='value')return null
    ir.type='value'
    return ir
}
//reg 形式的操作数原样取数(value 形式要读槽,这里拿不到)
export function value(ir:IRArgs){
    if(ir.type=='reg')return ir.data
    return NaN
}
//读操作数的常量:reg 在右值就是那个数字(立即数),value 才是读槽
export function read_const(ir:IRArgs,tool:OPTTool){
    if(ir==null)return null
    if(ir.type=='value')
        return tool.cprop_table.has(ir.data)?tool.cprop_table.get(ir.data):null
    return ir.data
}
//load 的源是特例:那里的 reg 是常量池 id,要反查
export function pool_const(ir:IRArgs,tool:OPTTool){
    if(ir==null||ir.type!='reg')return read_const(ir,tool)
    return tool.pool.has(ir.data)?tool.pool.get(ir.data):null
}
//把操作数当槽看,取这个槽的已知常量。
//value 形式当左值时代表"编号未知的槽"(它的内容才是槽号),这种一律不推断
export function slot_const(ir:IRArgs,tool:OPTTool){
    if(ir==null||ir.type!='reg')return null
    if(!tool.cprop_table.has(ir.data))return null
    return tool.cprop_table.get(ir.data)
}
//比较运算符编号:oper 是 reg(池 id)
export function oper_of(cmp:CMP,tool:OPTTool){
    const v=read_const(cmp.oper,tool)
    return typeof v=='number'?v:null
}
export function same_slot(dst:IRArgs,src:IRArgs){
    return dst!=null&&src!=null&&dst.data===src.data&&dst.type!==src.type
}
//两个操作数是不是同一个值(槽号与形式都相同)
export function same_arg(a:IRArgs,b:IRArgs){
    return a!=null&&b!=null&&a.data===b.data&&a.type===b.type
}
//写一个操作数。只在原对象上原地改,不占用 sweep 的位置,
//这样后面的 constant_fold / peephole 还能对同一个位置做真改写
export function set_arg(data:IRTree,key:string,arg:IRArgs,tool:OPTTool,bid:number,index:number){
    if(data[key]===arg)return
    data[key]=arg
    tool.changed=true
}
export function copy(ir:IRArgs,tool:OPTTool){
    if(ir.type!='value')return ir
    return tool.cpy_rep_table.get(ir.data)??ir
}
export function mov_rep(ir:MOV,tool:OPTTool){
    if(ir.right.type!='value')return ir
    const rep=tool.cpy_set_table.get(ir.right.data)
    if(rep==null)return ir
    rep.command[rep.left]=ir.left
    return rep.command
}
export function cprop_record(set:IRArgs, ir:IRArgs, tool:OPTTool){
    //写穿地址(左值是 value 形式)不记
    if(set.type!='reg')return
    const v=read_const(ir,tool)
    if(typeof v=='number')tool.cprop_table.set(set.data,v)
    else tool.cprop_table.delete(set.data)
}
export function offset_key(...ir:IRArgs[]){
    return ir.map(i=>i.data).join(':')
}
export function cprop_offset_record(set:IRArgs[], ir:IRArgs, tool:OPTTool){
    //键必须都是固定的槽
    if(set.some(i=>i==null||i.type!='reg'))return
    const key=offset_key(...set)
    const v=read_const(ir,tool)
    if(typeof v=='number')tool.cprop_offset_table.set(key,v)
    else tool.cprop_offset_table.delete(key)
}
export function cprop_param_record(set:IRArgs, ir:IRArgs, tool:OPTTool){
    if(set.type!='reg')return
    const v=read_const(ir,tool)
    if(typeof v=='number')tool.cprop_param_table.set(set.data,v)
    else tool.cprop_param_table.delete(set.data)
}
export function cprop(ir:IRArgs,tool:OPTTool){
    //只有"读槽"(value 形式)才可能换成已知常量
    if(ir.type!='value')return ir
    const v=tool.cprop_table.get(ir.data)
    if(typeof v!='number')return ir
    return IRArgs.reg(v)
}
export function to_load(ir:IRTree,key:string,tool:OPTTool,bid:number,index:number){
    let arg:IRArgs=ir[key]
    if(arg.type=='value')return
    if(Number.isInteger(arg.data)&&arg.data>=0)return
    const id=tool.id_pool.has(arg.data)?tool.id_pool.get(arg.data):(()=>{
        const _id=tool.id()
        tool.id_pool.set(arg.data,_id)
        return _id
    })()
    //先把常量搬进槽,操作数再从这个槽里读:右值写 reg(槽号) 会变成"数字槽号"
    ir[key]=IRArgs.value(id)
    tool.sweep(bid,index,new LOAD(IRArgs.reg(id),IRArgs.reg(tool.pool_id(arg.data))),ir)
}

export function writes_of(ir:IRTree):number[]{
    const out:number[]=[]
    const put=(a:IRArgs)=>{
        if(a==null)return
        if(a.type=='reg')out.push(a.data)
        else out.push(-1)
    }
    if(ir instanceof MOV)put((ir as any).left)
    else if(ir instanceof LOAD)put((ir as any).reg)
    else if(ir instanceof BINARY)put((ir as any).result)
    else if(ir instanceof NOT||ir instanceof BIT_NOT)put((ir as any).left)
    else if(ir instanceof CMP)put((ir as any).left)
    else if(ir instanceof OFFSET_GET)put((ir as any).target)
    else if(ir instanceof IN)put((ir as any).target)
    else if(ir instanceof PARAM_LOAD)put((ir as any).data)
    return out
}
export function kill(tool:OPTTool,slots:number[]){
    if(slots.includes(-1)){
        tool.clear()
        return
    }
    for(const s of slots){
        tool.cpy_rep_table.delete(s)
        tool.cpy_set_table.delete(s)
        tool.cprop_table.delete(s)
    }
}