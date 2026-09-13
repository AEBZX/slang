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
export type check_visitor=(ast:PeepholeTree,scope:PeepholeScope,call:(ast:PeepholeTree,round:number)=>void)=>void
export default class Check extends PeepholeTool{
    ref:Map<number,Map<any,check_visitor>>
    create:init_peephole
    constructor(){
        super('check')
    }
    use(data:[number,Map<any,check_visitor>]|init_peephole){
        if(Array.isArray(data))
            for(let [k,v] of data[1])
                this.ref.get(k).set(k,v)
        else this.create=data
        return this
    }
    run(ast:PeepholeTree[]){
        let scope=this.create(ast)
        let round=[]
        let g=(node:PeepholeTree,round:number)=>{
            for(let [k,v] of this.ref.get(round))
                if(node instanceof k)
                    v(node,scope,g)
        }
        //从小到大排序
        for(let [k,v] of this.ref)
            round.push(k)
        round.sort((a,b)=>a-b)
        for(let i of round)
            g(ast,i)
        return ast
    }
}