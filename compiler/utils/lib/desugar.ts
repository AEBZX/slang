import {ast_data, ASTTree} from '../data'
import PeepholeTool, {PeepholeTree} from './tool'
export type desugar_visitor=(node:PeepholeTree,call:(node:PeepholeTree)=>PeepholeTree)=>PeepholeTree
export default class Desugar extends PeepholeTool{
    ref:Map<any,desugar_visitor>
    _default:desugar_visitor
    constructor(){
        super('desugar')
    }
    use(data:Map<any,desugar_visitor>|desugar_visitor):Desugar{
        if(data instanceof Map)
            for(let [k,v] of data)
                this.ref.set(k,v)
        else
            this._default=data
        return this
    }
    run(node:PeepholeTree[]):PeepholeTree[]{
        let generate=(node:PeepholeTree):PeepholeTree=>{
            for(let [k,v] of this.ref)
                if(node instanceof k)
                    return v(node,generate)
            return this._default(node,generate)
        }
        return node.map(generate)
    }
}