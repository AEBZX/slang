import {ASTTree, Cast, Function, Operation, Type} from '../utils'
import {PeepholeScope} from '../utils/lib/tool'
export class Scope extends PeepholeScope{
    parent:Scope
    global:Scope
    //符号表
    symbol:Map<string,ASTTree>
    overload:Map<string,Function[]>
    //op,operation
    operation:Map<Type,Operation[]>
    cast:Map<Type,Cast[]>
    cast_oper_type:Type
    error:string[]
    _loop:boolean=false
    path:string
    constructor(parent:Scope,global:Scope){
        super(parent,global)
        this.symbol=new Map()
        this.error=[]
    }
    public overload_set(name:string,ast:Function){
        if(!this.overload.has(name))this.overload.set(name,[ast])
        if(this.overload.get(name).includes(ast))return
        ast.index=this.overload.get(name).length
        this.overload.get(name).push(ast)
    }
    public overload_get(name:string,index:number=-1):Function{
        return this.overload.get(name)[index]||this.parent?.overload_get(name,index)||this.global?.overload_get(name,index)||null
    }
    public operation_set(type:Type,ast:Operation){
        if(this.global!=null){
            this.global.operation_set(type,ast)
            return
        }
        if(!this.operation.has(type))this.operation.set(type,[ast])
        if(this.operation.get(type).includes(ast))return
        ast.index=this.operation.get(type).length
        this.operation.get(type).push(ast)
    }
    public operation_get(type:Type):Operation[] {
        if (this.global != null) return this.global.operation_get(type)
        return this.operation.get(type)
    }
    public cast_set(name:Type,ast:Cast){
        if(this.global!=null){
            this.global.cast_set(name,ast)
            return
        }
        if(!this.cast.has(name))this.cast.set(name,[ast])
        if(this.cast.get(name).includes(ast))return
        this.cast.get(name).push(ast)
    }
    public cast_get(name:Type){
        if(this.global!=null)return this.global.cast_get(name)
        return this.cast.get(name)
    }
    public thr(str:string,ast:ASTTree){
        if(this.global==null)this.error.push(`${str}在行${ast.line}`)
        else this.global.thr(str,ast)
    }
    public get(name:string):ASTTree{
        return this.symbol.get(name)||this.parent?.get(name)||this.global?.get(name)||null
    }
    public lookup(name:string,filter:(ast:ASTTree)=>boolean=()=>true){
        const get=this.get(name)
        if(get==null)return false
        return filter(get)
    }
    public set(name:string,ast:ASTTree){
        this.symbol.set(name,ast)
    }
    public loop(){
        if(this._loop)return true
        else return this.parent?.loop()||false
    }
    public enter():Scope{
        return super.enter() as Scope
    }
    public leave():Scope{
        return super.leave() as Scope
    }
}
export type slang_check_visitor =(ast:ASTTree, scope:Scope, call:(ast:ASTTree,round:number)=>void)=>void