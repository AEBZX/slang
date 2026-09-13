import {
    ASTTree,
    BasicType, Block,
    BlockType,
    Cast, Class,
    ClassType, Enum,
    EnumType,
    FixType,
    Function,
    GenericType, Interface,
    LiteralType, Modifier, Module,
    NumberType,
    Operation,
    Type, Value, Variable,
    VoidType
} from '../utils'
import {PeepholeScope} from '../utils/lib/tool'
export class Scope extends PeepholeScope{
    parent:Scope
    global:Scope
    chain:Map<string,Set<string>>
    data:Map<string,ASTTree>
    symbol:Map<ASTTree,Type>
    generic:Map<string,Type>
    operation:Map<Type,Operation[]>
    cast:Map<Type,Cast[]>
    overload:Map<string,Function[]>
    operation_cast_oper:Type
    error:string[]
    loop:boolean
    throw:boolean
    path:string
    constructor(parent:Scope,global:Scope){
        super(parent,global)
        this.data=new Map()
        this.chain=new Map()
        this.symbol=new Map()
        this.error=[]
        this.loop=false
        this.throw=false
        this.path=''
        this.generic=new Map()
        this.operation=new Map()
        this.cast=new Map()
        this.overload=new Map()
        this.operation_cast_oper=null
    }
    set_overload(name:string,fn:Function){
        let list=this.overload.get(name)
        if(!list){list=[];this.overload.set(name,list)}
        //若同一函数重复入组(symbol._name 与 _static 都收集)则跳过
        if(list.includes(fn))return
        fn.index=list.length
        list.push(fn)
    }
    get_overload(name:string):Function[]{
        if(this.overload.has(name))return this.overload.get(name)
        if(this.parent)return this.parent.get_overload(name)
        if(this.global&&this.global!=this)return this.global.get_overload(name)
        return []
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
        if(name.startsWith('up.'))return this.parent.get(name.slice(3))
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
        return []
    }
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
export function name(name:string,scope:Scope,ast:ASTTree=null,func=false){
    if(scope.get(name)!=ast&&!func)
        return true
    return !(scope.get(name) != ast && scope.get(name) instanceof Function && func)

}
export const Default_Modifier=new Map<any,Modifier>([
    [Module,new Modifier(false,false,false)],
    [Value,new Modifier(false,false,false)],
    [Class,new Modifier(false,false,false)],
    [Enum,new Modifier(false,false,false)],
    [Interface,new Modifier(false,false,false)],
    [Function,new Modifier(true,false,true)],
    [Variable,new Modifier(true,false,true)],
    [Cast,new Modifier(false,false,false)],
    [Operation,new Modifier(false,false,false)]
])
export type slang_check_visitor =(ast:ASTTree, scope:Scope, call:(ast:ASTTree,round:number)=>void)=>void
export function param_is(iden:Type[],param:Map<string,Type>,scope:Scope){
    let real=Array.from(param.values())
    if(iden.length!=real.length)return false
    for(let i=0;i<iden.length;i++)
        if(type_merge(iden[i],real[i],scope)!=iden[i])return false
    return true
}
export function fill_modifier(data:Block){
    if(data.modifiers!=null)return data.modifiers
    for(let [k,v] of Default_Modifier)
        if(data instanceof k)
            return v
}
//类型结构相等
export function type_same(a:Type,b:Type):boolean{
    if(a==null||b==null)return a==b
    //必须是同构的
    if(a.constructor!=b.constructor)return false
    if(a instanceof LiteralType)return true
    if(a instanceof ClassType)return (a as ClassType).local.join('.')==(b as ClassType).local.join('.')
    if(a instanceof FixType){
        //fix和本身都得同构
        let fa=a as FixType,fb=b as FixType
        if(fa.fix.length!=fb.fix.length)return false
        for(let i=0;i<fa.fix.length;i++)
            if(fa.fix[i].constructor!=fb.fix[i].constructor)return false
        return type_same(fa.t,fb.t)
    }
    if(a instanceof GenericType)return (a as GenericType).generic==(b as GenericType).generic
    return true
}
export function type_merge(type1:Type,type2:Type,scope:Scope):Type{
    let root=scope
    while(root.parent)root=root.parent
    let chain=root.chain
    if(type1 instanceof BasicType&&type2 instanceof BasicType){
        //情况1:两个Class
        if(type1 instanceof ClassType&&type2 instanceof ClassType){
            let name1=type1.local.join('.')
            let name2=type2.local.join('.')
            //name1的子类型中存在name2
            if(chain.has(name1)&&chain.get(name1).has(name2))return type1
            //反之
            if(chain.has(name2)&&chain.get(name2).has(name1))return type2
            //是否是一个类
            let s=root.global&&root.global!=root?root.global:root
            return s.get(name1)===s.get(name2)?type1:new VoidType()
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
export function oper_candidates(scope:Scope,oper:string,...type:Type[]):Operation[]{
    return scope.get_operation(type[0]).filter(i=>i.oper==oper)
        .filter(i=>{
            let ps=Array.from(i.command.params.values())
            //都可被赋值
            return !ps.map((j,k)=>type_is(j,type[k],scope)).includes(false)
        })
}
export function oper_best(scope:Scope,oper:string,...type:Type[]):Operation[]{
    let all=oper_candidates(scope,oper,...type)
    //只有一个即最优
    if(all.length<=1)return all
    let worse=new Set<Operation>()
    for(let a of all)
        for(let b of all){
            if(a==b)continue
            let pa=Array.from(a.command.params.values()),pb=Array.from(b.command.params.values())
            //参数数量不一致
            if(pa.length!=pb.length)continue
            let b_more_specific=true,a_strict=false
            for(let i=0;i<pa.length;i++){
                //pb是否更具体
                if(!type_sub(pb[i],pa[i],scope)){
                    b_more_specific=false
                    break
                }
                //是否更宽泛
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
    if(!(type_merge(type2,type1,scope) instanceof VoidType))return true
    //operation=优先级高于cast
    let operation=scope.get_operation(type1)
        .filter(i=>i.oper=='=')
        .filter(i=>
            type_merge(Array.from(i.command.params.values())[1],type2,scope)
            ==Array.from(i.command.params.values())[1]).length!=0
    if(operation)return true
    //cast强转
    return scope.get_cast(type2)
        .filter(i => type_merge(i.t, type1, scope) == type1)
        .length != 0

}
//子类型判断:type 兼容 target(同构或实现链上 type 是 target 的子类)
function type_sub(type:Type,target:Type,scope:Scope):boolean{
    if(type==null||target==null)return false
    //只能互相是子类型
    if(type instanceof ClassType&&target instanceof ClassType){
        let tn=type.local.join('.'),an=target.local.join('.')
        //一个类
        if(tn==an)return true
        let root=scope
        while(root.parent)root=root.leave()
        return root.chain.has(an) && root.chain.get(an).has(tn)

    }
    //或者合并了正常
    return !(type_merge(type,target,scope) instanceof VoidType)
}
//签名最符合决策(函数重载/operation 共用):param_sets 是各候选的形参类型表
export function pick_best(scope:Scope,param_sets:Type[][],arg_types:Type[]):number{
    //先过滤:参数个数一致且每参都能被实参喂入(形参兼容实参)
    let fit:number[]=[]
    for(let k=0;k<param_sets.length;k++){
        let ps=param_sets[k]
        if(ps.length!=arg_types.length)continue
        let ok=true
        for(let i=0;i<ps.length;i++)
            if(!type_is(ps[i],arg_types[i],scope)){ok=false;break}
        if(ok)fit.push(k)
    }
    if(fit.length==0)return null
    if(fit.length==1)return fit[0]
    //剔除被更具体候选支配的:若存在另一候选 j 使 j 每参都是 k 的子类/同构且至少一处严格子类
    let worse=new Set<number>()
    for(let a of fit)for(let b of fit){
        if(a==b)continue
        let pa=param_sets[a],pb=param_sets[b]
        let b_specific=true,a_strict=false
        for(let i=0;i<pa.length;i++){
            if(!type_sub(pb[i],pa[i],scope)){b_specific=false;break}
            if(!type_sub(pa[i],pb[i],scope))a_strict=true
        }
        if(b_specific&&a_strict)worse.add(a)
    }
    let best=fit.filter(i=>!worse.has(i))
    if(best.length==1)return best[0]
    return -1   //并列歧义
}
//重载决议结果:best=唯一最优;ambiguous=并列最符合(需报错);none=无签名匹配
export function overload_resolve(scope:Scope,name:string,fns:any[],arg_types:Type[]):
    {kind:'best',fn:any}|{kind:'ambiguous'}|{kind:'none'}{
    let sets:Type[][]=fns.map((f:any)=>Array.from(f.params.values()))
    let idx=pick_best(scope,sets,arg_types)
    if(idx==-1)return {kind:'ambiguous'}
    if(idx==null)return {kind:'none'}
    return {kind:'best',fn:fns[idx]}
}