import PeepholeTool, {init_peephole, PeepholeScope, PeepholeTree} from './tool'
export type ir_factory=(data:PeepholeTree,tool:PeepholeScope,call:(data:PeepholeTree)=>void)=>void
export default class IR extends PeepholeTool {
    ref:Map<any,ir_factory>=new Map()
    create:init_peephole=null
    constructor() {
        super('ir')
    }
    use(data:Map<any,ir_factory>|init_peephole){
        if(data instanceof Map)
            for (const [k,v] of data)
                this.ref.set(k,v)
        else this.create=data
        return this
    }
    run(data:[PeepholeScope,PeepholeTree[]]){
        let tool:PeepholeScope=this.create(data)
        const generate=(node:PeepholeTree)=>{
            for(const [k,v] of this.ref)
                if(node instanceof k)
                    v(node,tool,generate)
        }
        data[1].forEach(generate)
        return tool
    }
}