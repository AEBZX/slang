import {IRTree} from '../utils'
import {PeepholeScope} from '../utils/lib/tool'

export type slang_opt_visitor =(data:IRTree, tool:OPTTool, bid:number, index:number)=>void
export class OPTTool extends PeepholeScope{
    pool_state:Map<number,number|string>=new Map()
    reg_state:Map<number,number>=new Map()
    constructor(public index:number, command:Map<number,IRTree[]>, pool:Map<number,number|string>) {
        super(null,null)
    }
    id(){
        return this.index++
    }
}