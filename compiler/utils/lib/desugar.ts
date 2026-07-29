import {ast_data} from '../data'

export type desugar_visitor=(node:ast_data)=>ast_data

export class DesugarVisitor{
    visit:Map<string,desugar_visitor>
    constructor(){
        this.visit=new Map()
    }
    visitor(ast:ast_data){
        let v=(node:ast_data):ast_data=>{
            for(let [k,_v] of node.children)
                if(typeof _v=='object')
                    v(_v)
            if(!this.visit.has(node.type))return node
            return this.visit.get(node.type)(node)
        }
        return v(ast)
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