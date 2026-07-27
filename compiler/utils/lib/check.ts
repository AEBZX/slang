import {ast_data} from '../data'
import {AstNode} from './ast-node'

export class Scope{
    data:Map<string,AstNode>
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

export type check_visitor=(node:AstNode,scope:Scope)=>AstNode

export class CheckVisitor{
    scope:Scope
    visit:Map<string,check_visitor>
    constructor(){
        this.scope = new Scope(null,new Scope(null,null))
        this.visit = new Map()
    }
    visitor(ast:ast_data){
        let v=(node:AstNode,scope:Scope):AstNode=>{
            for(let j=0;j<node.children.length;j++){
                if(typeof node.children[j]!=='string')
                    node.children[j]=v(node.children[j] as AstNode,scope)
            }
            if(!this.visit.has(node.type))return node
            return this.visit.get(node.type)(node,scope)
        }
        let root=new AstNode(ast)
        return {tree:v(root,this.scope).to_data(),error:this.scope.error}
    }
    register(name:string,visitor:check_visitor){
        this.visit.set(name,visitor)
    }
}

export default {
    visitor:(name:string,visitor:check_visitor)=>{return {name,visitor}},
    check:(tree:ast_data,visit:{name:string,visitor:check_visitor}[])=>{
        let v=new CheckVisitor()
        for(let i of visit)
            v.register(i.name,i.visitor)
        return v.visitor(tree)
    }
}