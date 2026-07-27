import {ast_data} from '../data'
import {AstNode} from './ast-node'

export type desugar_visitor=(node:AstNode)=>AstNode

export class DesugarVisitor{
    visit:Map<string,desugar_visitor>
    constructor(){
        this.visit=new Map()
    }
    visitor(ast:ast_data){
        let v=(node:AstNode):AstNode=>{
            for(let j=0;j<node.children.length;j++){
                if(typeof node.children[j]!=='string')
                    node.children[j]=v(node.children[j] as AstNode)
            }
            if(!this.visit.has(node.type))return node
            return this.visit.get(node.type)(node)
        }
        return v(new AstNode(ast)).to_data()
    }
    register(name:string,visitor:desugar_visitor){
        this.visit.set(name,visitor)
    }
}

export default {
    visitor:(name:string,visitor:desugar_visitor)=>{return {name,visitor}},
    desugar:(tree:ast_data,visit:{name:string,visitor:desugar_visitor}[])=>{
        let v=new DesugarVisitor()
        for(let i of visit)
            v.register(i.name,i.visitor)
        return v.visitor(tree)
    }
}