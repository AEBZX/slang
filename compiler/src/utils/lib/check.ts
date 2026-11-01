import {
    BasicType,
    BlockType, Cast,
    ClassType,
    EnumType,
    FixType,
    GenericType,
    LiteralType, NumberType,
    Operation,
    Type, Value,
    VoidType
} from '../model/ast'
import {process} from './tool'
import PeepholeTool, {init_peephole, PeepholeScope, PeepholeTree} from './tool'
export type check_visitor=(ast:PeepholeTree,scope:PeepholeScope,call:(ast:PeepholeTree,round:number,scope?:PeepholeScope)=>void)=>void
export default class Check extends PeepholeTool{
    ref:Map<number,Map<any,check_visitor>>
    create:init_peephole=null
    process:process=null
    constructor(){
        super('check')
        this.ref=new Map()
    }
    use(data:[number,Map<any,check_visitor>]|init_peephole){
        if(Array.isArray(data)&&typeof data[0]=='number')
            this.ref.set(data[0],new Map(data[1]))
        else if(data.length==2)this.process=data as process
        else this.create=data as init_peephole
        return this
    }
    run(ast:PeepholeTree[]){
        let scope=this.create(ast)
        let rounds=[...this.ref.keys()].sort((a,b)=>a-b)
        let dispatch=(node:PeepholeTree,round:number,cur:PeepholeScope)=>{
            for(let [k,v] of (this.ref.get(round)??[]))
                if(node instanceof k)
                    v(node,cur,(child,r,explicit?)=>dispatch(child,r,explicit??cur))
        }
        for(let r of rounds) ast.forEach(node=>dispatch(node,r,scope))
        if(this.process)this.process(ast,scope)
        return scope
    }
}