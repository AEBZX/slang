import {slang_generate_visitor} from "../../generate";

export type opt_visitor =(data:PeepholeTree, tool:PeepholeScope, bid:number, index:number)=>void
export type opt_machine=(tool:PeepholeScope,call:(round:string,tree:PeepholeTree)=>opt_visitor)=>PeepholeScope
import PeepholeTool, {PeepholeScope, PeepholeTree} from './tool'
import {slang_opt_visitor} from "../../optimize/tool";
export default class Optimize extends PeepholeTool{
    //轮次名 -> 该轮注册的 visitor
    ref:Map<string,(Map<any,slang_opt_visitor>)>=new Map()
    machine:opt_machine
    constructor() {
        super('optimize')
    }
    use(data:[string,Map<any,opt_visitor>]|opt_machine){
        if(Array.isArray(data)){
            let round=this.ref.get(data[0])
            if(round==null)this.ref.set(data[0],round=new Map())
            for(const [k,v] of data[1])
                round.set(k,v)
        }
        else this.machine=data as opt_machine
        return this
    }
    run(tool:PeepholeScope){
        return this.machine(tool,(round, tree)=>{
            const call=this.ref.get(round)
            if(call==null)return null
            for(const [k,v] of call)
                if(tree instanceof k)return v
        })
    }
}
