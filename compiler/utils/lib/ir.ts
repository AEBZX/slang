import PeepholeTool, {init_peephole, PeepholeScope, PeepholeTree} from './tool'
export type asm_factory=(data:PeepholeTree,tool:PeepholeScope)=>void
export class IR extends PeepholeTool {
    ref:Map<any,asm_factory>=new Map()
    create:init_peephole=null
    constructor() {
        super('ir')
    }
    use(data:Map<any,asm_factory>|init_peephole){
        if(data instanceof Map)
            for (let [k,v] of data)
                this.ref.set(k,v)
        else this.create=data
        return this
    }
    run(data:[PeepholeScope,PeepholeTree[]]){
        let tool:PeepholeScope=this.create(data)
        for(let node of data[1])
            for(let [k,v] of this.ref)
                if(node instanceof k)
                    v(node,tool)
        return tool
    }
}