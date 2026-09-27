import {ast_data, ast_type, ASTTree} from '../data'
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
import {Function} from '../model/ast'
import PeepholeTool, {init_peephole, PeepholeScope, PeepholeTree} from './tool'
export type check_visitor=(ast:PeepholeTree,scope:PeepholeScope,call:(ast:PeepholeTree,round:number,scope?:PeepholeScope)=>void)=>void
export default class Check extends PeepholeTool{
    ref:Map<number,Map<any,check_visitor>>=new Map()
    create:init_peephole=null
    constructor(){
        super('check')
    }
    use(data:[number,Map<any,check_visitor>]|init_peephole){
        if(Array.isArray(data))
            this.ref.set(data[0],new Map(data[1]))
        else this.create=data
        return this
    }
    run(ast:PeepholeTree[]){
        let scope=this.create(ast)
        //按轮次升序,逐根节点派发;visitor 的 call 会把当前 scope 一并下传
        let rounds=[...this.ref.keys()].sort((a,b)=>a-b)
        let g=(node:PeepholeTree,round:number,current?:PeepholeScope)=>{
            let sc=current??scope
            for(let [k,v] of (this.ref.get(round)??[]))
                if(node instanceof k)
                    v(node,sc,g)
        }
        for(let r of rounds)
            ast.forEach(node=>g(node,r))
        return scope
    }
}