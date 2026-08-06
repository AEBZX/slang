import {ASTTree, HIRTree} from '../data'
import {} from '../model/hir'
type hir_visitor=(node:ASTTree,scope:Scope)=>HIRTree
export class Scope{
    symbol:Map<string,number>
    index:number
    constructor(public parent:Scope,public global:Scope){
        this.index=0
    }
    id(){
        if(this.global!=null)return this.global.id()
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
    enter():Scope{
        return new Scope(this,this.global)
    }
    leave():Scope{
        return this.parent
    }
}