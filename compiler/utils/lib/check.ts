import {ast_data} from '../data'
export type check_visitor=(ast:ast_data,scope:Scope)=>ast_data
export class Scope{
    parent:Scope
    global:Scope
    chain:Map<string,string>
    data:Map<string,ast_data>
    error:string[]
    constructor(parent:Scope,global:Scope){
        this.parent=parent
        this.global=global
        this.data=new Map()
        this.chain=new Map()
        this.error=[]
    }
    enter(){
        return new Scope(this,this.global)
    }
    leave(){
        return this.parent
    }
    get(name:string){
        return this.data.get(name)
    }
    set(name:string,data:ast_data){
        this.data.set(name,data)
    }
    is(chain1:string,chain2:string){
        let chain=[]
        let v=(s:string)=>{
            if(this.chain.has(s)){
                chain.push(this.chain.get(s))
                v(this.chain.get(s))
            }
        }
        v(chain1)
        if(chain.includes(chain2))return true
        chain=[]
        v(chain2)
        return chain.includes(chain1)
    }
    impl(c:string,i:string){
        this.chain.set(c,i)
    }
    thr(msg:string){
        this.error.push(msg)
    }
}
export class Checker{
    scope:Scope
    visitor:Map<string,check_visitor>
    constructor(){
        this.scope=new Scope(null,new Scope(null,null))
        this.visitor=new Map()
    }
    register(name:string,visitor:check_visitor){
        this.visitor.set(name, visitor)
    }
    check(ast:ast_data):ast_data{
        for(let [name,data] of ast.children){
            if(typeof data=='object')
                ast.children.set(name,this.check(data))
        }
        if(!this.visitor.has(ast.type))return ast
        return this.visitor.get(ast.type)(ast,this.scope)
    }
}
export default function (ast:ast_data,...data:{name:string,ast:check_visitor}[]):ast_data{
    let checker=new Checker()
    for(let i of data)
        checker.register(i.name,i.ast)
    return checker.check(ast)
}