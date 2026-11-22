import {IRTree} from '../utils'
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
    constructor(public code:Map<number,IRTree[]>,public pool:Set<number>,public index:number=0) {
        super(null,null)
    }
}