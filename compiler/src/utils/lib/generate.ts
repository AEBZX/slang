import PeepholeTool, {PeepholeScope, PeepholeTree} from './tool'
import {writeFileSync} from "fs";
export type generate_machine=(tool:PeepholeScope,call:(data:PeepholeTree)=>Buffer)=>Buffer
export type generate_visitor=(data:PeepholeTree)=>Buffer
export default class Generate extends PeepholeTool{
    ref:Map<any,generate_visitor>
    machine:generate_machine
    local:string
    constructor() {
        super('generate')
    }
    use(data:generate_machine|Map<any,generate_visitor>|string){
        if (data instanceof Map)
            for(const [k,v] of data)
                this.ref.set(k,v)
        else if(typeof data=='string')
            this.local = data
        this.machine = data as generate_machine
        return this
    }
    run(param:PeepholeScope){
        const buffer=this.machine(param,(data:PeepholeTree)=>{
            for(const [k,v] of this.ref)
                if(data instanceof k) return v(data)
        })
        writeFileSync(this.local,buffer,'utf-8')
    }
}