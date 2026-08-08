import {ASTTree, HIRTree} from '../data'
import {HBlock, HClass, HModule, HVariable} from '../model/hir'
import {File} from '../model/ast'
export type hir_visitor=(node:ASTTree,scope:HScope,call:(node:ASTTree,scope?:HScope)=>HIRTree)=>HIRTree
export class HScope{
    symbol:Map<string,number>
    index:number
    link:Map<number,number>
    entry:boolean
    constructor(public parent:HScope,public global:HScope){
        this.index=1
        this.symbol=new Map()
        this.link=new Map()
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
export class HIR{
    scope:HScope
    constructor(public ast:File[],public data:Map<any,hir_visitor>,public pre:(node:File[],scope:HScope)=>void,
                public FileDo:(node:File,scope:HScope)=>void){
        this.scope=new HScope(null,null)
        this.scope.global=this.scope
    }
    run(){
        this.pre(this.ast,this.scope)
        //visitor内enter出的子作用域经call下传
        let visit=(node:ASTTree,scope?:HScope)=>{
            let s=scope||this.scope
            for(let [k,v] of this.data)
                if(node instanceof k)
                    return v(node,s,visit)
        }
        let module=[]
        //对象扁平化:Module/Class的children展开,结果形如[module,...,class,...]
        //非static的HVariable(实例成员)保留在容器children内不展开
        let flat=(h:HIRTree)=>{
            module.push(h)
            if(h instanceof HModule||h instanceof HClass)
                for(let c of h.children)
                    if(!(c instanceof HVariable)||!c.unstatic)
                        flat(c)
        }
        for(let node of this.ast){
            this.scope=this.scope.enter()
            this.FileDo(node,this.scope)
            for(let j of node.children)
                flat(visit(j,this.scope))
        }
        return module
    }
}
export default (ast:File[],data:Map<any,hir_visitor>,pre:(node:File[],scope:HScope)=>void,
    FileDo:(node:File,scope:HScope)=>void):[number,HBlock[]]=> {
    let ls=new HIR(ast,data,pre,FileDo)
    let module=ls.run()
    //run()里scope已enter,id总数取真正的根
    return [ls.scope.global.index,module]
}