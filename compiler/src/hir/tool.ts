import {PeepholeScope} from '../utils/lib/tool'
import {ASTTree, HIRTree} from '../utils'

export type slang_hir_visitor =(node:ASTTree, scope:HScope, call:(node:ASTTree)=>HIRTree)=>HIRTree
export class HScope extends PeepholeScope{
    symbol:Map<string,number>
    index:number
    link:Map<number,number>
    link_target:Map<string,string>//link别名目标路径
    label:Map<string,number>
    entry:boolean
    path:string
    path_(name:string){
        this.path=this.path==''?name:this.path+'.'+name
        return this.path
    }
    constructor(public parent:HScope,public global:HScope){
        super(parent,global)
        this.index=1
        this.symbol=new Map()
        this.link=new Map()
        this.link_target=new Map()
        this.entry=false
        this.label=new Map()
        this.path=this.parent!=null?this.parent.path:''
    }
    lnk(id:number,data:number){
        this.link.set(id,data)
    }
    //标签和函数名一样按作用域查找:内层覆盖外层,找不到再向 parent 找
    get_label(name:string):number{
        if(this.label.has(name))return this.label.get(name)
        if(this.parent!=null)return this.parent.get_label(name)
        return null
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
        //全名(模块成员/函数)登记在根作用域的 global 表里
        if(this.global!=null&&this.global!==this&&this.global.symbol.has(name))
            return this.global.symbol.get(name)
        const id=this.id()
        this.set(name,id)
        return id
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