import {ast_data} from '../data'
export class DesugarVisitor{
    visit:Map<string,(data:ast_data)=>ast_data>
    constructor(){
        this.visit=new Map()
    }
    visitor(ast:ast_data){
        let v=(ast:ast_data)=>{
            if(!this.visit.has(ast.type))return ast
            ast=this.visit.get(ast.type)(ast)
            for(let j=0;j<ast.children.length;j++){
                if(typeof ast.children[j]!='string')
                    ast.children[j]=v(ast.children[j] as ast_data)
            }
            return ast
        }
        return v(ast)
    }
    register(name:string,visitor:(data:ast_data)=>ast_data){
        this.visit.set(name, visitor)
    }
}
export default {
    visitor:(name:string,visitor:(data:ast_data)=>ast_data)=>{return {name,visitor}},
    desugar:(tree:ast_data,visit:{name:string,visitor:(data:ast_data)=>ast_data}[])=>{
        let v=new DesugarVisitor()
        for(let i of visit)
            v.register(i.name,i.visitor)
        return v.visitor(tree)
    }
}