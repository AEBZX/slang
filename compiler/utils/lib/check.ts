import {ast_data, ast_type, ASTTree} from '../data'
import {Type} from '../model'
export type check_visitor=(ast:ASTTree,scope:Scope,call:(ast:ASTTree)=>ASTTree)=>ASTTree
export type type_checker=(ast:ASTTree,scope:Scope,call:(ast:ASTTree)=>Type)=>Type
export class Scope{
    parent:Scope
    global:Scope
    chain:Map<string,string>
    data:Map<string,ASTTree>
    symbol:Map<ASTTree,Type>
    error:string[]
    constructor(parent:Scope,global:Scope){
        this.parent=parent
        this.global=global
        this.data=new Map()
        this.chain=new Map()
        this.symbol=new Map()
        this.error=[]
    }
    enter(){
        return new Scope(this,this.global)
    }
    leave(){
        return this.parent
    }
    sym(ast:ASTTree,type:Type){
        this.symbol.set(ast,type)
    }
    get_sym(ast:ASTTree):Type{
        return this.symbol.get(ast)||this.parent.get_sym(ast)||this.global.get_sym(ast)
    }
    get(name:string):ASTTree{
        return this.data.get(name)||this.parent.get(name)||this.global.get(name)
    }
    set(name:string,data:ASTTree){
        this.data.set(name,data)
    }
    thr(msg:string){
        this.global.error.push(msg)
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
}