import {
    ArrayType,
    ASTTree,
    Block, BooleanType,
    Cast, Class,
    ClassType, Enum, EnumType, Expression, FixType,
    Function, GenericType, IdentifierExpr,
    Interface, LambdaType, LiteralType,
    Module, NumberType,
    Operation, PointType, ReferencePrefix,
    ReferenceType,
    Type,
    Variable, VoidType
} from '../utils'
import {PeepholeScope} from '../utils/lib/tool'
import {assertType} from 'vitest'
import ast from '../parser/ast'
export class Scope extends PeepholeScope{
    parent:Scope
    global:Scope
    //标签表
    label:string[]
    //继承链,key implements value
    implement:Map<string[],ClassType[]>
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
    ret:Type=null
    path:string
    private cast_index:number=0
    private operation_index:number=0
    constructor(parent:Scope,global:Scope){
        super(parent,global)
        this.symbol=new Map()
        this.generic=new Map()
        this.overload=new Map()
        this.operation=new Map()
        this.cast=new Map()
        this.implement=new Map()
        this.cast_oper_type=null
        this.error=[]
        this.label=[]
    }
    public label_set(name:string){
        if(!this.label.includes(name))this.label.push(name)
    }
    public label_get(name:string):boolean{
        return this.label.includes(name)||this.parent?.label_get(name)||this.global?.label_get(name)||false
    }
    public implement_set(local:string[],type:ClassType){
        if(this.global!=null)this.global.implement_set(local,type)
        if(this.implement.get(local)==null)this.implement.set(local,[])
        this.implement.get(local).push(type)
        if(this.implement.get(type.local)!=null)
            this.implement.get(local).push(...this.implement.get(type.local))
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
    public overload_get(name:string):Function[]{
        return this.overload.get(name)||this.parent?.overload_get(name)||this.global?.overload_get(name)||[]
    }
    public operation_set(type:Type,ast:Operation){
        if(this.global!=null){
            this.global.operation_set(type,ast)
            return
        }
        if(!this.operation.has(type))this.operation.set(type,[ast])
        if(this.operation.get(type).includes(ast))return
        ast.index=this.operation_index++
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
        if(this.cast.has(name)&&this.cast.get(name).includes(ast))return
        ast.id=this.cast_index++
        if(!this.cast.has(name))this.cast.set(name,[ast])
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
//两者是同一类型,是则返回最小超类型,否则返回VoidType
export function type_is(a:Type,b:Type,scope:Scope){
    if(a==b)return a
    if(a instanceof ReferenceType)return type_is(a.t,b,scope)
    if(b instanceof ReferenceType)return type_is(a,b.t,scope)
    if(a instanceof GenericType)return type_is(scope.get_generic(a.generic),b,scope)
    if(b instanceof GenericType)return type_is(a,scope.get_generic(b.generic),scope)
    //其中一个是Null返回另一个
    if(a instanceof VoidType)return b
    if(b instanceof VoidType)return a
    //情况1,都是Literal
    if(a instanceof LiteralType&&b instanceof LiteralType){
        if(a==b)return a
        return new VoidType()
    }
    //情况2,array
    if(a instanceof ArrayType&&b instanceof ArrayType)
        return type_is(a.t,b.t,scope)
    //情况3,point
    if(a instanceof PointType&&b instanceof PointType)
        return type_is(a.t,b.t,scope)
    //情况4,lambda
    if(a instanceof LambdaType&&b instanceof LambdaType){
        //参数数量不一致
        if(a.params.size!=b.params.size)return new VoidType()
        //泛型数量不一致
        if(a.generic.size!=b.generic.size)return new VoidType()
        let ret:LambdaType=new LambdaType(new Map(),new Map(),new VoidType())
        ret.returnType=type_is(a.returnType,b.returnType,scope)
        const param_a=Array.from(a.params.values())
        const param_b=Array.from(b.params.values())
        const generic_a=Array.from(a.generic.values())
        const generic_b=Array.from(b.generic.values())
        for(let i=0;i<param_a.length;i++)
            ret.params.set(Array.from(a.params.keys())[i],type_is(param_a[i],param_b[i],scope))
        for(let i=0;i<generic_a.length;i++)
            ret.generic.set(Array.from(a.generic.keys())[i],type_is(generic_a[i],generic_b[i],scope))
        return ret
    }
    //情况5,ClassType,查继承链
    if(a instanceof ClassType&&b instanceof ClassType){
        //a和b是一个Class/Interface,取generic最小超类型
        if(a.local==b.local){
            let ret:ClassType=new ClassType(a.local)
            for(let i=0;i<a.generic.length;i++)
                ret.generic.push(type_is(a.generic[i],b.generic[i],scope))
            return ret
        }
        //a implement b,当成b求
        const implement=scope.global.implement.get(a.local)
        for(const i of implement){
            if((i as ClassType).local==b.local)return type_is(b,i,scope)
            if(scope.global.implement.get(b.local).includes(i))return i
        }
    }
    if(a instanceof EnumType&&b instanceof EnumType)
        if(a.local==b.local)return a
    return new VoidType()
}
//具体性比较,如果a比b更具体返回true
//要求两者length相同
//也可以用于泛型相容性检查
export function param_best(param1:Type[],param2:Type[],scope:Scope){
    return param1.every((v,i)=>type_is(v,param2[i],scope)==param2[i])
}
export function operation_get(scope:Scope,ast:ASTTree,oper:string,ret:Type,...param:Type[]){
    const oper_type=param[0]
    let operations:Operation[]=[]
    for(const [key,value] of scope.operation)
        if(type_is(key,oper_type,scope)==key)operations.push(...value)
    operations=operations.filter(v=>v.oper==oper)
        .filter(v=>type_is(v.command.ret,ret,scope)==ret)
        .filter(v=>v.command.params.size==param.length)
        .filter(v=>{
            for(let i=0;i<v.command.params.size;i++)
                if(type_is(Array.from(v.command.params.values())[i],param[i],scope)!=param[i])return false
            return true
        })//存在一个不等于他的operation,参数比他更具体,pass
        .filter(v=>{
            for(const operation of operations){
                if(v==operation)continue
                if(param_best(Array.from(operation.command.params.values()),
                              Array.from(v.command.params.values()),scope))
                    return false
            }
            return true
        })
    if(operations.length==0)return null
    if(operations.length!=1){
        scope.thr(`${oper}中存在无法进行具体性决议的operation`,ast)
        return null
    }
    return operations[0]
}
export function cast_get(scope:Scope,ast:ASTTree,input:Type,output:Type){
    let casts:Cast[]=[]
    for(const [key,value] of scope.cast)
        if(type_is(key,output,scope)==key)
            casts.push(...value)
    casts=casts.filter(v=>{
        //cast只有一个参数
        const param=Array.from(v.command.params.values())[0]
        return type_is(param, input, scope) == input
    })
        .filter(v=>{
            for(const cast of casts){
                if(cast==v)continue
                if(param_best(Array.from(cast.command.params.values()),
                              Array.from(v.command.params.values()),scope))
                    return false
            }
        })
    if(casts.length==0)return null
    if(casts.length!=1){
        scope.thr(`存在无法进行具体性决议的cast`,ast)
        return null
    }
    return casts[0]
}
//逻辑上condition不是bool可以被转为condition!=null,但是一般会期望condition是bool,所以如果不是bool,尝试一次转换
export function try_bool(scope:Scope,ast:Expression){
    if(ast.type instanceof BooleanType)return
    const cast=cast_get(scope,ast,ast.type,new BooleanType())
    if(cast==null)return
    ast.cast=cast.global_local.join('.')+'.'+cast.id
    ast.type=new BooleanType()
}
//将左值类型转换为便于计算的纯右值类型
export function to_right(type:Type){
    if(type instanceof ReferenceType)return to_right(type.t)
    return type
}
//如果是this,那么不受private限制
export function block_get(_this:boolean,_static:boolean,path:string,name:string,generic:Type[],scope:Scope){
    const block=scope.get(path) as Block
    if(!(block instanceof Module||block instanceof Class||block instanceof Interface||block instanceof Enum))
        return null
    if(!_static&&(block instanceof Module||block instanceof Enum))
        return null
    if(block instanceof Enum) {
        if(block.children.includes(name))
            return new EnumType(block.global_local)
        return null
    }
    const children=block.children
        .filter(v=>_this||!v.modifiers._private)
        .filter(v=>!_static||!v.modifiers.unstatic)
        .filter(v=>v.name==name)
    if(children.length==0)return null
    if(children.length==1){
        if(block instanceof Interface||block instanceof Class&&!_static){
            //泛型注入
            let index=0
            let _generic:Map<string,Type>=new Map()
            for(const key of block.generic.keys())
                _generic.set(key,generic[index++])
            return generic_type_real(children[0].type,_generic,scope)
        }
        return children[0].type
    }
    //此时100%是函数重载
    return new LambdaType(new Map(),new Map(),new VoidType(),true,block.global_local.join('.')+'.'+name)
}
//得出实际类型
export function generic_type_real(type:Type,generic:Map<string,Type>,scope:Scope){
    if(type instanceof FixType){
        type.t=generic_type_real(type.t,generic,scope)
        return type
    }
    if(type instanceof GenericType){
        if(!scope.get_generic(type.generic))return generic.get(type.generic)
        return type
    }
    if(type instanceof ClassType){
        type.generic=type.generic.map(v=>generic_type_real(v,generic,scope))
        return type
    }
}
//类型匹配检查,param_iden为形参,param_real为实参,generic_iden为形式泛型,generic_real为注入泛型
export function param_check(param_iden:Type[],param_real:Type[],generic_iden:Map<string,Type>,generic_real:Type[],
                            ret:Type,scope:Scope){
    if(param_iden.length!=param_real.length)return null
    if(generic_iden.size!=generic_real.length)return null
    param_iden=param_iden.map(v=>generic_type_real(v,generic_iden,scope))
    const generic:Map<string,Type>=new Map()
    {
        let index=0
        for(const key of generic_iden.keys())
            generic.set(key,generic_real[index++])
    }
    param_real=param_real.map(v=>generic_type_real(v,generic,scope))
    return param_best(param_iden,param_real,scope)&&
           param_best(Array.from(generic_iden.values()),generic_real,scope)?
           generic_type_real(ret,generic,scope):null
}
export function fast_operation(scope:Scope,ast:Expression,op:string,ret:Type,...param:(Expression|Type)[]){
    const operation=operation_get(scope,ast,op,ret,...param.map(v=>v instanceof Expression?v.type:v))
    if(operation!=null){
        ast.type=operation.type
        ast.oper=operation.global_local.join('.')+'.operation@'+operation.index
        return true
    }
    return false
}
export function fast_cast(scope:Scope,ast:Expression,input:Expression,output:Type){
    if(type_is(input.type,output,scope)==output)return true
    const cast=cast_get(scope,ast,input.type,output)
    if(cast!=null){
        ast.type=cast.t
        input.cast=cast.global_local.join('.')+'.cast@'+cast.id
        return true
    }
    return false
}