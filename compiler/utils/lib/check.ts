import {ast_data} from '../data'
export type check_visitor=(ast:ast_data,scope:Scope,call:(ast:ast_data)=>ast_data)=>ast_data
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
    get(name:string):ast_data{
        return this.data.get(name)||this.parent.get(name)||this.global.get(name)
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
    type(a:any,b:any){
        if(a==b)return true
        if(a=='any'||b=='any'||a==null||b==null)return true
        return false
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
        let call=(ast:ast_data):ast_data=>{
            //底向上:先递归处理子节点并写回结果
            if(ast.children){
                for(let [name,child] of ast.children){
                    if(child!=null&&typeof child=='object')
                        ast.children.set(name,call(child))
                }
            }
            if(!this.visitor.has(ast.type))return ast
            return this.visitor.get(ast.type)(ast,this.scope,call)
        }
        return call(ast)
    }
}
export default function (ast:ast_data,...data:{name:string,ast:check_visitor}[]):ast_data{
    let checker=new Checker()
    for(let i of data)
        checker.register(i.name,i.ast)
    return checker.check(ast)
}