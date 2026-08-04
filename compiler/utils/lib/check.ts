import {ast_data, ast_type, ASTTree} from '../data'
import {BasicType, ClassType, FixType, Type, VoidType} from '../model'
export type check_visitor=(ast:ASTTree,scope:Scope,call:(ast:ASTTree,scope?:Scope)=>void)=>void
export type type_checker=(ast:ASTTree,scope:Scope,call:(ast:ASTTree)=>Type)=>Type
export class Scope{
    parent:Scope
    global:Scope
    chain:Map<string,string[]>
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
        if(this.symbol.has(ast))return this.symbol.get(ast)
        if(this.parent)return this.parent.get_sym(ast)
        if(this.global)return this.global.get_sym(ast)
    }
    get(name:string):ASTTree{
        if(this.data.has(name))return this.data.get(name)
        if(this.parent)return this.parent.get(name)
        if(this.global)return this.global.get(name)
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
export default Checker
export function type_merge(type1:Type,type2:Type,scope:Scope){
    if(type1 instanceof BasicType&&type2 instanceof BasicType){
        //情况1:两个Class
        if(type1 instanceof ClassType&&type2 instanceof ClassType){
            let name1=type1.local.join('.')
            let name2=type2.local.join('.')
            //name1的子类型中存在name2
            if(scope.chain.has(name1)&&scope.chain.get(name1).includes(name2))return type1
            //反之
            if(scope.chain.has(name2)&&scope.chain.get(name2).includes(name1))return type2
            //是否是一个类
            return scope.get(name1)===scope.get(name2)?type1:new VoidType()
        }
        //情况2:正常类型且都不是VoidType
        if(!(type1 instanceof VoidType)&&!(type2 instanceof VoidType))return type1.constructor==type2.constructor?type1:new VoidType()
        return type1.constructor==type2.constructor?type1:new VoidType()
    }
    //两个FixType
    if(type1 instanceof FixType&&type2 instanceof FixType){
        if(type1.fix.length!=type2.fix.length)return new VoidType()
        //每个fix都一致
        for(let i=0;i<type1.fix.length;i++)
            if(type1.fix[i].constructor!=type2.fix[i].constructor)return new VoidType()
        //基础类型不兼容则整体不兼容;fix数组用副本避免污染原类型
        let base=type_merge(type1.t,type2.t,scope)
        if(base instanceof VoidType)return new VoidType()
        return new FixType(base,[...type1.fix])
    }
    return new VoidType()
}