import {ast_data, ASTTree} from '../data'

export type desugar_visitor=(node:ASTTree,call:(node:ASTTree)=>ASTTree)=>ASTTree

export class DesugarVisitor{
    visit:Map<any,desugar_visitor>
    constructor(){
        this.visit=new Map()
    }
    visitor(ast:ASTTree,visit:Map<any,desugar_visitor>){
        this.visit=visit
        let g=(ast:ASTTree)=>{
            for(let [k,v] of this.visit)
                if(ast instanceof k)
                    return v(ast,g)
        }
        return g(ast)
    }
}

export default function desugar(tree:ASTTree,visit:Map<any,desugar_visitor>){
    return new DesugarVisitor().visitor(tree,visit)
}