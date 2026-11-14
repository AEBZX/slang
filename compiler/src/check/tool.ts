import {ASTTree, Block, Cast, ClassType, Function, Interface, Module, Operation, Type, Variable} from '../utils'
import {PeepholeScope} from '../utils/lib/tool'
import {assertType} from 'vitest'
export class Scope extends PeepholeScope{
    parent:Scope
    global:Scope
    //符号表
    symbol:Map<string,ASTTree>
    generic:Map<string,Type>
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
        this.generic=new Map()
        this.overload=new Map()
        this.operation=new Map()
        this.cast=new Map()
        this.cast_oper_type=null
        this.error=[]
    }
    public get_generic(name:string):Type{
        return this.generic.get(name)||this.parent?.get_generic(name)||this.global?.get_generic(name)||null
    }
    public set_generic(name:string,type:Type){
        this.generic.set(name,type)
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
//模块合并
function module_merge(a:Module,b:Module){
    return new Module(a.modifiers,a.name,[...a.children,...b.children])
}
//处理前置定义
export function symbol_iden(ast:Block[],scope:Scope,path:string=''){
    if(ast==null)return
    for(const item of ast){
        //operation,cast这种在全局注册的无名氏忽略
        if(item instanceof Operation||item instanceof Cast)continue
        //重名
        if(scope.symbol.get(path+item.name)!=null){
            //不报错:函数重名(overload),模块重名(合并)
            const block=scope.symbol.get(path+item.name)
            if(block instanceof Module&&item instanceof Module){
                //处理一个public一个private
                if(block.modifiers._private!=item.modifiers._private)
                    scope.thr(`合并模块${item.name}时出现修饰符不一致`,item)
                scope.set(path+item.name,module_merge(block,item))
            }
            if(block instanceof Function&&item instanceof Function)
                scope.overload_set(path+item.name,item)
            continue
        }
        scope.set(path+item.name,item)
        //特殊处理:Variable是Type
        if(item instanceof Variable)
            scope.set(path+item.name,item.t)
    }
    for(const item of ast)
        if('children' in item)
            symbol_iden(item.children as Block[],scope,path+item.name+'.')
}
export function symbol_check_implement(ast:ASTTree,type:Type,scope:Scope){
    //首先需要是一个ClassType
    if(!(type instanceof ClassType)){
        scope.thr('继承的必须是接口',ast)
        return
    }
    //implement是否存在
    const block=scope.get(type.local.join('.'))
    if(block==null||!(block instanceof Interface)){
        scope.thr('继承的接口不存在',ast)
        return
    }
    //泛型数量对不对的上
    if(block.generic.size!=type.generic.length)
        scope.thr('继承的接口泛型与实际给出的泛型数量不一致',ast)
}
export function symbol_do_generic(ast:ASTTree,generic:Map<string,Type>,scope:Scope,call:(ast:ASTTree,round:number)=>void){
    for(const generic_implement of generic.values())
        symbol_check_implement(ast,generic_implement,scope)
    //检查泛型
    for(const _generic of generic.values())
        call(_generic,2)
    //注册泛型
    for(const [name,type] of generic)
        scope.set_generic(name,type)
}