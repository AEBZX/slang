export type opt_visitor =(data:PeepholeTree, tool:PeepholeScope, bid:number, index:number)=>void
import PeepholeTool, {init_peephole, PeepholeScope, PeepholeTree} from './tool'
export default class Optimize extends PeepholeTool{
    ref:Map<any,opt_visitor>=new Map()
    create:init_peephole=null
    each:(scope:PeepholeScope,each:(ir:PeepholeTree,bid:number,index:number)=>void)=>PeepholeTree[]=null
    constructor() {
        super('optimize')
    }
    use(data:Map<any,opt_visitor>|init_peephole|
        ((scope:PeepholeScope,each:(ir:PeepholeTree,bid:number,index:number)=>void)=>PeepholeTree[])){
        if(data instanceof Map)
            for(let [k,v] of data)
                this.ref.set(k,v)
        else if(data.length==1)
            this.create=data as init_peephole
        return this
    }
    run(tool:PeepholeScope){
        let scope=this.create(tool)
        return this.each(scope,(ir,bid,index)=>{
            for(let [k,v] of this.ref)
                if(ir instanceof k)
                    v(ir,tool,bid,index)
        })
    }
}