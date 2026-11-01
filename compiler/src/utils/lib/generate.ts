import PeepholeTool, {PeepholeScope, PeepholeTree} from './tool'
import {writeFileSync} from 'fs'
export type generate_machine=(tool:PeepholeScope,call:(data:PeepholeTree)=>Buffer)=>Buffer
export type generate_visitor=(data:PeepholeTree)=>Buffer
export default class Generate extends PeepholeTool{
    ref:Map<any,generate_visitor>=new Map()
    machine:generate_machine
    constructor() {
        super('generate')
    }
    use(data:generate_machine|Map<any,generate_visitor>){
        if (data instanceof Map)
            for(const [k,v] of data)
                this.ref.set(k,v)
        else this.machine = data as generate_machine
        return this
    }
    run(param:PeepholeScope){
        const buffer=this.machine(param,(data:PeepholeTree)=>{
            for(const [k,v] of this.ref)
                if(data instanceof k) return v(data)
        })
        return buffer
    }
}
