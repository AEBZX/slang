import {PeepholeScope} from '../utils/lib/tool'
import {ASTTree, HIRTree} from '../utils'

export type slang_hir_visitor =(node:ASTTree, scope:HScope, call:(node:ASTTree)=>HIRTree)=>HIRTree
export class HScope extends PeepholeScope{
    symbol:Map<string,number>
    index:number
    link:Map<number,number>
    link_target:Map<string,string>  // link 别名目标路径(如 io→std.io)
    entry:boolean
    constructor(public parent:HScope,public global:HScope){
        super(parent,global)
        this.index=1
        this.symbol=new Map()
        this.link=new Map()
        this.link_target=new Map()
        this.entry=false
    }
    lnk(id:number,data:number){
        this.link.set(id,data)
    }
    lnk_get(id:number):number{
        if(this.link.has(id))
            return this.link.get(id)
        if(this.parent!=null)
            return this.parent.lnk_get(id)
        if(this.global!=null&&this.global!==this)
            return this.global.lnk_get(id)
        return null
    }
    id(){
        if(this.global!=null&&this.global!==this)return this.global.id()
        return this.index++
    }
    get(name:string):number{
        if(this.symbol.has(name))
            return this.symbol.get(name)
        if(this.parent!=null)
            return this.parent.get(name)
        return null
    }
    set(name:string,value:number){
        this.symbol.set(name,value)
    }
    enter():HScope{
        return new HScope(this,this.global)
    }
    leave():HScope{
        return this.parent
    }
}