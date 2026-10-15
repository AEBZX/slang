import {ASTTree, HIRTree} from '../data'
import {File} from '../model/ast'
import PeepholeTool, {init_peephole, PeepholeScope, PeepholeTree, process} from './tool'
export type hir_visitor = (node:PeepholeTree, scope:PeepholeScope, call:(node:PeepholeTree)=>PeepholeTree)=>PeepholeTree
export default class HIR extends PeepholeTool{
    ref:Map<any,hir_visitor>=new Map()
    _default:hir_visitor=null
    create:init_peephole=null
    process:process=null
    constructor() {
        super('hir')
    }
    use(data:Map<any,hir_visitor>|hir_visitor|init_peephole|process){
        if(data instanceof Map)
            for(let [k,v] of data)
                this.ref.set(k,v)
        else if(data.length==1)
            this.create=data as init_peephole
        else if(data.length==2)
            this.process=data as process
        else this._default=data
        return this
    }
    run(node:PeepholeTree[]){
        let scope=this.create(node)
        let g=(node:PeepholeTree)=>{
            for(let [k,v] of this.ref)
                if(node instanceof k)
                    return v(node,scope,g)
            if(this._default!=null)
                return this._default(node,scope,g)
            return node
        }
        return [scope,node.map(g)]
    }
}