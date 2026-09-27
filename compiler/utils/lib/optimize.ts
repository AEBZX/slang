import {asm_args, asm_command, asm_pool, number_radix} from '../data'
import {
    BINARY,
    BIT_NOT,
    CALL,
    CMP,
    CZ,
    DELETE,
    GC,
    IN,
    IRTree,
    JZ,
    LOAD,
    MOV,
    NOT, OFFSET_ADDR, OFFSET_GET, STR_GET,
    OFFSET_SET,
    OUT,
    PARAM_LOAD,
    PARAM_SET,
    POP,
    PUSH,
    RET,
    RETN,
    TZ
} from '../model/ir'
export type opt_visitor =(data:PeepholeTree, tool:PeepholeScope, bid:number, index:number)=>void
import PeepholeTool, {init_peephole, PeepholeScope, PeepholeTree} from './tool.ts'
export default class Optimize extends PeepholeTool{
    ref:Map<any,opt_visitor>=new Map()
    create:init_peephole=null
    each:any=null
    _each:(scope:PeepholeScope,each:(ir:IRTree, bid:number, index:number)=>void)=>any
    constructor() {
        super('optimize')
    }
    use(data:Map<any,opt_visitor>|init_peephole|((scope:PeepholeScope)=>[IRTree,number,number][])){
        if(data instanceof Map)
            for(let [k,v] of data)
                this.ref.set(k,v)
        else if(data.length==1)
            this.create=data as init_peephole
        else this.each=data
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