import {PeepholeScope} from '../utils/lib/tool'
import {ASTTree, HIRTree} from '../utils'

export type slang_hir_visitor =(node:ASTTree, scope:HScope, call:(node:ASTTree)=>HIRTree)=>HIRTree
//标签按词法作用域压栈:列表进入时压一层,内层同名标签覆盖外层
export const label_stack:Map<string,number>[]=[]
export function push_labels(labels:Map<string,number>){
    label_stack.push(labels)
}
export function pop_labels(){
    label_stack.pop()
}
export function set_label(name:string,id:number){
    const top=label_stack[label_stack.length-1]
    if(top==null)throw new Error('标签不在任何作用域里:'+name)
    top.set(name,id)
}
export function get_label(name:string):number{
    for(let i=label_stack.length-1;i>=0;i--)
        if(label_stack[i].has(name))return label_stack[i].get(name)
    return null
}
export class HScope extends PeepholeScope{
    symbol:Map<string,number>
    index:number
    link:Map<number,number>
    link_target:Map<string,string>//link别名目标路径
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
        this.path=this.parent!=null?this.parent.path:''
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