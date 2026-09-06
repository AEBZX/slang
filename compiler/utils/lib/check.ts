import {ast_data, ast_type, ASTTree} from '../data'
import {
    BasicType,
    BlockType, Cast,
    ClassType,
    EnumType,
    FixType,
    GenericType,
    LiteralType,
    Operation,
    Type, Value,
    VoidType
} from '../model/ast'
export type check_visitor=(ast:ASTTree,scope:Scope,call:(ast:ASTTree,scope:Scope)=>void)=>void
//类型结构相等:值类型的结构比较(注册键与查询键未必同引用)
export function type_same(a:Type,b:Type):boolean{
    if(a==null||b==null)return a==b
    if(a.constructor!=b.constructor)return false
    if(a instanceof LiteralType)return true
    if(a instanceof ClassType)return (a as ClassType).local.join('.')==(b as ClassType).local.join('.')
    if(a instanceof FixType){
        let fa=a as FixType,fb=b as FixType
        if(fa.fix.length!=fb.fix.length)return false
        for(let i=0;i<fa.fix.length;i++)
            if(fa.fix[i].constructor!=fb.fix[i].constructor)return false
        return type_same(fa.t,fb.t)
    }
    if(a instanceof GenericType)return (a as GenericType).generic==(b as GenericType).generic
    return true
}
//类型的容器名尾段:number/string/boolean 用关键字;类用路径尾段;泛型用名
export function type_name(t:Type):string{
    let cls=(t as any).constructor?.name
    let map:any={'NumberType':'number','BooleanType':'boolean','StringType':'string','VoidType':'void'}
    if(map[cls])return map[cls]
    let local=(t as any).local
    if(local)return local[local.length-1]
    let g=(t as any).generic
    if(g)return String(g)
    return String(cls||'t').toLowerCase()
}
export type type_checker=(ast:ASTTree,scope:Scope,call:(ast:ASTTree)=>Type)=>Type
export class Scope{
    parent:Scope
    global:Scope
    chain:Map<string,Set<string>>
    data:Map<string,ASTTree>
    symbol:Map<ASTTree,Type>
    generic:Map<string,Type>
    operation:Map<Type,Operation[]>
    cast:Map<Type,Cast[]>
    error:string[]
    loop:boolean
    path:string
    constructor(parent:Scope,global:Scope){
        this.parent=parent
        this.global=global
        this.data=new Map()
        this.chain=new Map()
        this.symbol=new Map()
        this.error=[]
        this.loop=false
        this.path=''
        this.generic=new Map()
        this.operation=new Map()
        this.cast=new Map()
    }
    enter(){
        let s=new Scope(this,this.global)
        s.loop=this.loop
        s.path=this.path
        return s
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
    get_generic(name:string):Type{
        if(this.generic.has(name))return this.generic.get(name)
        if(this.parent)return this.parent.get_generic(name)
        if(this.global)return this.global.get_generic(name)
    }
    set_generic(name:string,type:Type){
        this.generic.set(name,type)
    }
    get_operation(type:Type):Operation[]{
        let ret=[]
        for(let [k,v] of this.operation)
            if(type_same(k,type))ret.push(...v)
        if(ret.length)return ret
        if(this.parent)return this.parent.get_operation(type)
        if(this.global&&this.global!=this)return this.global.get_operation(type)
        //无任何注册:返回空表,避免调用点 .filter 崩溃
        return []
    }
    //类型结构相等:注册键(value 块的类型节点)与查询键(字面量推导的新实例)未必同引用,
    //须按结构比较——LiteralType 同构造即同型;ClassType 按路径;FixType 按基+fix;Generic 按名
    set_operation(type:Type,operation:Operation){
        let key=null
        for(let [k,v] of this.operation)if(type_same(k,type)){key=k;break}
        if(key!=null)this.operation.get(key).push(operation)
        else this.operation.set(type,[operation])
    }
    get_cast(type:Type):Cast[]{
        let ret=[]
        for(let [k,v] of this.cast)
            if(type_same(k,type))ret.push(...v)
        if(ret.length)return ret
        if(this.parent)return this.parent.get_cast(type)
        if(this.global&&this.global!=this)return this.global.get_cast(type)
        return []
    }
    set_cast(type:Type,cast:Cast){
        let key=null
        for(let [k,v] of this.cast)if(type_same(k,type)){key=k;break}
        if(key!=null)this.cast.get(key).push(cast)
        else this.cast.set(type,[cast])
    }
    thr(msg:string){
        this.global.error.push(msg)
    }
}
export function type_merge(type1:Type,type2:Type,scope:Scope):Type{
    if(type1 instanceof BasicType&&type2 instanceof BasicType){
        //情况1:两个Class
        if(type1 instanceof ClassType&&type2 instanceof ClassType){
            let name1=type1.local.join('.')
            let name2=type2.local.join('.')
            //name1的子类型中存在name2
            if(scope.chain.has(name1)&&scope.chain.get(name1).has(name2))return type1
            //反之
            if(scope.chain.has(name2)&&scope.chain.get(name2).has(name1))return type2
            //是否是一个类
            return scope.get(name1)===scope.get(name2)?type1:new VoidType()
        }
        if(type1 instanceof EnumType||type2 instanceof EnumType){
            let e=type1 instanceof EnumType?type1:type2 as EnumType
            let o=type1 instanceof EnumType?type2:type1
            if(o instanceof NumberType)return o
            if(o instanceof EnumType)return e.local.join('.')==(o as EnumType).local.join('.')?e:new VoidType()
            if(o instanceof BlockType)return (o as BlockType).local.join('.')==e.local.join('.')?o:new VoidType()
            if(o instanceof ClassType)return (o as ClassType).local.join('.')==e.local.join('.')?o:new VoidType()
        }
        //泛型
        if(type1 instanceof GenericType||type2 instanceof GenericType){
            type1=type1 instanceof GenericType?scope.get_generic(type1.generic):type1
            type2=type2 instanceof GenericType?scope.get_generic(type2.generic):type2
            if(type1==null)scope.thr(`generic type ${type1} not found`)
            if(type2==null)scope.thr(`generic type ${type2} not found`)
            return type_merge(type1,type2,scope)
        }
        //情况2:正常类型且都不是VoidType
        if(!(type1 instanceof VoidType)&&!(type2 instanceof VoidType))return type1.constructor==type2.constructor?type1:new VoidType()
        //一边为 VoidType(代表 null 字面量):null 可与任意类型兼容,返回另一边类型
        if(type1 instanceof VoidType)return type2
        return type1
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
export function oper_get_have(scope:Scope,oper:string,...type:Type[]){
    return scope.get_operation(type[0]).filter(i=>i.oper==oper)
        //所有可以将...type放进去调用的
        .filter(i=>!Array.from(i.command.params.values())
            .map((j,k)=>type_is(j,type[k],scope)).includes(false))
        .map(i=>i.command.ret)
}
//子类型判断:type 是否兼容 target(即 type 可赋给 target)。
//基础类型同构;类用 implements 链:type 是 target 的实现/子类时 type 更具体
let type_sub=(type:Type,target:Type,scope:Scope)=>{
    if(type==null||target==null)return false
    if(type instanceof ClassType&&target instanceof ClassType){
        let tn=type.local.join('.'),an=target.local.join('.')
        if(tn==an)return true
        //target 在 chain 里作为 father,type 作为 child
        if(scope.chain.has(an)&&scope.chain.get(an).has(tn))return true
        return false
    }
    //非类:同构或 merge 非 Void 视为兼容
    return !(type_merge(type,target,scope) instanceof VoidType)
}
//operation 决策:所有参数都能被实参喂入的候选中,选"最具体"(参数是他人参数的子类/同构)。
//歧义(两个不可比的候选中无唯一最优)由调用方自行报错——这里把可能候选都返回,
//调用方按需取:候选1个即确定;多个时比较歧义。
export function oper_candidates(scope:Scope,oper:string,...type:Type[]):Operation[]{
    return scope.get_operation(type[0]).filter(i=>i.oper==oper)
        .filter(i=>{
            let ps=Array.from(i.command.params.values())
            return !ps.map((j,k)=>type_is(j,type[k],scope)).includes(false)
        })
}
export function oper_best(scope:Scope,oper:string,...type:Type[]):Operation[]{
    let all=oper_candidates(scope,oper,...type)
    if(all.length<=1)return all
    //最具体:对每个候选,若存在另一候选使本候选所有参数都是其子类/同构,且至少一处严格子类 → 本候选更差
    let worse=new Set<Operation>()
    for(let a of all)for(let b of all){
        if(a==b)continue
        let pa=Array.from(a.command.params.values()),pb=Array.from(b.command.params.values())
        if(pa.length!=pb.length)continue
        let b_more_specific=true,a_strict=false
        for(let i=0;i<pa.length;i++){
            if(!type_sub(pb[i],pa[i],scope)){b_more_specific=false;break}
            if(!type_sub(pa[i],pb[i],scope))a_strict=true
        }
        if(b_more_specific&&a_strict)worse.add(a)
    }
    return all.filter(i=>!worse.has(i))
}
export function cast_get(type:Type,scope:Scope){
    return [type,...scope.get_cast(type).map(i=>i.t)]
}
export function type_is(type1:Type,type2:Type,scope:Scope){
    //type2(实际值)能否赋给 type1(目标):merge 后非 Void 即兼容
    //(type_merge 返回首个非 Void 参数而非"共同超类",不能与 type1 做相等比较)
    if(!(type_merge(type2,type1,scope) instanceof VoidType))return true
    //operation=优先级高于cast
    let operation=scope.get_operation(type1)
        .filter(i=>i.oper=='=')
        .filter(i=>
            type_merge(Array.from(i.command.params.values())[1],type2,scope)
            ==Array.from(i.command.params.values())[1]).length!=0
    if(operation)return true
    //cast强转
    let cast=scope.get_cast(type2)
        .filter(i=>type_merge(i.t,type1,scope)==type1)
        .length!=0
    if(cast)return true
    return false
}