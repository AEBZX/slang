export type opt_visitor =(data:PeepholeTree, tool:PeepholeScope, bid:number, index:number)=>void
export type opt_machine=(tool:PeepholeScope,call:(round:string,tree:PeepholeTree)=>opt_visitor)=>PeepholeTool
import PeepholeTool, {init_peephole, PeepholeScope, PeepholeTree} from './tool'
export default class Optimize extends PeepholeTool{
    ref:[string,Map<any,opt_visitor>][]=[]
    machine:opt_machine
    constructor() {
        super('optimize')
    }
    use(data:[string,Map<any,opt_visitor>]|opt_machine){
        if(Array.isArray(data))
            for(const [k,v] of data[1])
                this.ref[data[0]][1].set(k,v)
        else
            this.machine=data as opt_machine
        return this
    }
    run(tool:PeepholeScope){
        return this.machine(tool,(round, tree)=>{
            const call:Map<any,opt_visitor>=this.ref[round][1]
            for(const [k,v] of call)
                if(tree instanceof k)return v
        })
    }
}