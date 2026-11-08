import {ASTTree, HIRTree} from '../data'
import {File} from '../model/ast'
import PeepholeTool, {init_peephole, PeepholeScope, PeepholeTree, process} from './tool'
export type hir_visitor = (node:PeepholeTree, scope:PeepholeScope, call:(node:PeepholeTree, scope?:PeepholeScope)=>PeepholeTree)=>PeepholeTree
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
        const root=this.create(node)
        const g=(node:PeepholeTree,scope:PeepholeScope):PeepholeTree=>{
            for(let [k,v] of this.ref)
                if(node instanceof k)
                    return v(node,scope,(child,next)=>g(child,next instanceof PeepholeScope?next:scope))
            if(this._default!=null)
                return this._default(node,scope,(child,next)=>g(child,next instanceof PeepholeScope?next:scope))
            return node
        }
        return [root,node.map(n=>g(n,root))]
    }
}