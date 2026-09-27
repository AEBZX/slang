import {
    AdditiveExpression,
    AddressPrefix,
    ArgumentsPostfix,
    ASTTree,
    BasicType,
    BinaryExpression,
    BitNotPrefix, BitwiseAndExpression, BitwiseOrExpression, BitwiseXorExpression,
    Block,
    BlockType,
    Cast,
    Class,
    ClassType,
    DecrementPostfix,
    DecrementPrefix,
    DivisionExpression,
    Enum,
    EnumType, EqualityExpression,
    FixType,
    Function,
    GenericType,
    GreaterEqualExpression,
    GreaterExpression,
    IncrementPostfix,
    IncrementPrefix,
    IndexPostfix, InequalityExpression,
    Interface, LambdaType, LessEqualExpression,
    LessExpression,
    LiteralType, LogicalAndExpression, LogicalOrExpression,
    MinusPrefix,
    ModExpression,
    Modifier,
    Module,
    MultiplicativeExpression,
    NotPrefix,
    NumberType,
    Operation,
    PointFix,
    Postfix,
    ReferencePrefix,
    ShiftLeftExpression,
    ShiftRightExpression,
    SubtractiveExpression,
    Type,
    Value,
    Variable,
    VoidType
} from '../utils'
import {PeepholeScope} from '../utils/lib/tool'
export class Scope extends PeepholeScope{
    parent:Scope
    global:Scope
    //接口/类->继承链上的接口
    chain:Map<string,Set<Interface>>
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
export function type_merge(_type1:Type,_type2:Type,scope:Scope):Type{
    let type1=real_type(_type1,scope)
    let type2=real_type(_type2,scope)
    let root=scope
    while(root.parent)root=root.parent
    let chain=root.chain
    if(type1 instanceof BasicType&&type2 instanceof BasicType){
        //情况1:两个Class
        if(type1 instanceof ClassType&&type2 instanceof ClassType){
            let name1=type1.local.join('.')
            let name2=type2.local.join('.')
            let _t1=scope.get(name1)
            let _t2=scope.get(name2)
            //type2的子类型中存在type1
            if(chain.has(name2)&&chain.get(name2).has(_t1 as Interface))return type1
            //反之
            if(chain.has(name1)&&chain.get(name1).has(_t2 as Interface))return type2
            //是否是一个类
            let s=root.global&&root.global!=root?root.global:root
            return real_type(s.get(name1)===s.get(name2)?type1:new VoidType(),scope)
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
        if(!(type1 instanceof VoidType)&&!(type2 instanceof VoidType))
            return real_type(type1.constructor==type2.constructor?type1:new VoidType(),scope)
        //一边为 VoidType(代表 null 字面量):null 可与任意类型兼容,返回另一边类型
        if(type1 instanceof VoidType)return real_type(type2,scope)
        return real_type(type1,scope)
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
        return real_type(new FixType(base,[...type1.fix]),scope)
    }
    return new VoidType()
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
        return root.chain.has(tn) && root.chain.get(tn).has(scope.get(an) as Interface)

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
export function overload_resolve(scope:Scope,name:string,arg_types:Type[]):
    {kind:'best',fn:Function}|{kind:'ambiguous'}|{kind:'none'}{
    let fns=scope.get_overload(name)
    let sets:Type[][]=fns.map((f:Function)=>Array.from(f.params.values()).map(i=>real_type(i,scope)))
    let idx=pick_best(scope,sets,arg_types.map(i=>real_type(i,scope)))
    if(idx==-1)return {kind:'ambiguous'}
    if(idx==null)return {kind:'none'}
    return {kind:'best',fn:fns[idx]}
}
export function to_point(a:Type){
    if(a instanceof FixType){
        a.fix.push(new PointFix())
        return a
    }
    return new FixType(a,[new PointFix()])
}
export function each_oper(scope:Scope,param:Type,ret:any[]):Type{
    let each=(data:Type)=>{
        for(let i of scope.get_operation(data)){
            if(i.oper!=':')continue
            let type
            if(ret.map(j=>{
                type=j
                return type_merge(i.command.ret,j,scope) instanceof j
            }).includes(true))return type
        }
        for(let i of scope.get_operation(data))
            each(real_type(i.command.ret,scope))
        return new VoidType()
    }
    return each(real_type(param,scope))
}
export const Operation_Prefix=new Map([
    [IncrementPrefix,'++'],
    [DecrementPrefix,'--'],
    [NotPrefix,'!'],
    [MinusPrefix,'-'],
    [BitNotPrefix,'~'],
    [ReferencePrefix,'*'],
    [AddressPrefix,'&']
])
export const Operation_Postfix=new Map<any,string>([
    [IncrementPostfix,'++'],
    [DecrementPostfix,'--'],
    [ArgumentsPostfix,'()'],
    [IndexPostfix,'[]']
])
export const Operation_Binary=new Map<any,string>([
    [AdditiveExpression,'+'],
    [MultiplicativeExpression,'*'],
    [DivisionExpression,'/'],
    [SubtractiveExpression,'-'],
    [ModExpression,'%'],
    [ShiftRightExpression,'>>'],
    [ShiftLeftExpression,'<<'],
    [GreaterExpression,'>'],
    [LessExpression,'<'],
    [GreaterEqualExpression,'>='],
    [LessEqualExpression,'<='],
    [InequalityExpression,'!='],
    [EqualityExpression,'=='],
    [BitwiseAndExpression,'&'],
    [BitwiseOrExpression,'|'],
    [BitwiseXorExpression,'^'],
    [LogicalAndExpression,'&&'],
    [LogicalOrExpression,'||'],
])
export function check_implement(i:Type,scope:Scope,line:string[]){
    const ls=real_type(i,scope)
    if(!(ls instanceof ClassType))
        scope.thr(`generic implement的类型不是ClassType,在行${line}`)
    if(!scope.get((<ClassType>ls).local.join('.')))
        scope.thr(`generic implement的类型${(<ClassType>ls).local.join('.')}不存在,在行${line}`)
    if(!(scope.get((<ClassType>ls).local.join('.')) instanceof Interface))
        scope.thr(`generic implement的类型${(<ClassType>ls).local.join('.')}不是Interface,在行${line}`)
    let implement=scope.global.get((<ClassType>ls).local.join('.'))
    if(!(implement instanceof Interface))
        scope.thr(`generic implement的类型${(<ClassType>ls).local.join('.')}不是Interface,在行${line}`)
}
export function cast_best(result:Type,_cast:Type,scope:Scope){
    let cast=cast_get(real_type(_cast,scope),scope)
    cast=cast.filter(i=>type_merge(real_type(result,scope),real_type(i,scope),scope)==result)
    let ret=cast[0]
    for(let i of cast)
        if(type_merge(real_type(i,scope),real_type(ret,scope),scope)==i)
            ret=i
    return real_type(ret,scope)
}
export function type_(a:Type,b:Type,scope:Scope){
    const cast=cast_best(real_type(b,scope),real_type(a,scope),scope)
    if(!cast)return true
    return type_merge(real_type(a,scope),real_type(b,scope),scope)==b
}
export function generic_name(name:string,scope:Scope){
    return scope.generic.get(name) == null
}
export function real_type(type:Type,scope:Scope){
    if(type instanceof FixType)
        return new FixType(real_type(type.t,scope),type.fix)
    if(type instanceof ClassType){
        const is_generic=scope.get_generic(type.local.join('.'))
        if(is_generic!=null)return real_type(new GenericType(type.local.join('.')),scope)
        const block=scope.get(type.local.join('.'))
        if(block instanceof Class||block instanceof Interface){
            for(let [,v] of block.generic)v=real_type(v,scope)
            return block
        }
        if(block instanceof Enum)return new EnumType(type.local)
    }
    if(type instanceof GenericType)return scope.get_generic(type.generic)
    if(type instanceof LambdaType){
        if(!type.overload){
            let param=type.params
            for(let [,k] of param)k=real_type(k,scope)
            return new LambdaType(null,type.params,type.returnType,type._await)
        }
        let real=scope.get_overload(type.name.split('@')[0])
            .filter(i=>i.index=parseInt(type.name.split('@')[1]))[0];
        (real.type as LambdaType).overload=false
        real.type=real_type(real.type,scope);
        (real.type as LambdaType).overload=true
        return real.type
    }
    return type
}
export function get_field(type:Class|Interface,scope:Scope){
    let field=type.children
    let ret=new Map<string,Type>()
    for(let i of field)
        ret.set(i.name,real_type(i.type,scope))
}