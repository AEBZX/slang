import {ASTTree, HIRTree} from '../data'
import {HModule} from '../model/hir'
import {File} from '../model/ast'
export type hir_visitor=(node:ASTTree,scope:HScope,call:(node:ASTTree)=>HIRTree)=>HIRTree
export class HScope{
    symbol:Map<string,number>
    index:number
    link:Map<number,number>
    constructor(public parent:HScope,public global:HScope){
        this.index=0
        this.symbol=new Map()
        this.link=new Map()
    }
    lnk(id:number,data:number){
        this.link.set(id,data)
    }
    lnk_get(id:number):number{
        if(this.link.has(id))
            return this.link.get(id)
        if(this.parent!=null)
            return this.parent.lnk_get(id)
        if(this.global!=null)
            return this.global.lnk_get(id)
        return null
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
    enter():HScope{
        return new HScope(this,this.global)
    }
    leave():HScope{
        return this.parent
    }
}
export class HIR{
    scope:HScope
    constructor(public ast:File[],public data:Map<any,hir_visitor>,public pre:(node:File[],scope:HScope)=>void,
                public FileDo:(node:File,scope:HScope)=>void){
        this.scope=new HScope(null,null)
    }
    run(){
        this.pre(this.ast,this.scope)
        let visit=(node:ASTTree)=>{
            for(let [k,v] of this.data)
                if(node instanceof k)
                    return v(node,this.scope,visit)
        }
        let module=[]
        for(let node of this.ast){
            this.scope=this.scope.enter()
            this.FileDo(node,this.scope)
            for(let j of node.children)
                module.push(visit(j))
        }
        return module
    }
}
export default (ast:File[],data:Map<any,hir_visitor>,pre:(node:File[],scope:HScope)=>void,
    FileDo:(node:File,scope:HScope)=>void)=>
    new HIR(ast,data,pre,FileDo).run()