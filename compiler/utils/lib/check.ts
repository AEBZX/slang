import {ast_data} from '../data'
export class Scope{
    data:Map<string,ast_data>
    error:string[]
    constructor(public parent:Scope,public global:Scope){
        this.data = new Map()
        this.error = []
    }
    enter(){
        return new Scope(this,this.global)
    }
    leave(){
        return this.parent
    }
    thr(message:string){
        if(this.global!=null){
            this.global.thr(message)
        }else this.error.push(message)
    }
}
export class CheckVisitor{
    scope:Scope
    visit:Map<string,(data:ast_data,scope:Scope)=>ast_data>
    constructor(){
        this.scope = new Scope(null,new Scope(null,null))
        this.visit = new Map()
    }
    visitor(ast:ast_data){
        let v=(ast:ast_data,scope:Scope)=>{
            ast=this.visit.get(ast.type)(ast,scope)
            for(let j=0;j<ast.children.length;j++){
                if(typeof ast.children[j]!='string')
                    ast.children[j]=v(ast.children[j] as ast_data,scope)
            }
            return ast
        }
        return {tree:v(ast,this.scope),error:this.scope.error}
    }
    register(name:string,visitor:(data:ast_data,scope:Scope)=>ast_data){
        this.visit.set(name,visitor)
    }
}
export default {
    visitor:(name:string,visitor:(data:ast_data,scope:Scope)=>ast_data)=>{return {name,visitor}},
    check:(tree:ast_data,visit:{name:string,visitor:(data:ast_data,scope:Scope)=>ast_data}[])=>{
        let v=new CheckVisitor()
        for(let i of visit)
            v.register(i.name,i.visitor)
        return v.visitor(tree)
    }
}