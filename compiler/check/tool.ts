import {
    AAssign, AddAssign, AddExpression,
    AddressPrefix, AndAssign, AndExpression,
    ArgumentsPostfix, Assign,
    ASTTree,
    BasicType,
    BinaryExpression, BitNotPrefix,
    Block,
    BlockType, BooleanType,
    Cast,
    Class,
    ClassType,
    DecrementPostfix,
    DecrementPrefix, DivAssign, DivExpression,
    Enum,
    EnumType, EqualExpression,
    FixType,
    Function,
    GenericType,
    GreaterEqualExpression,
    GreaterExpression,
    IncrementPostfix,
    IncrementPrefix,
    IndexPostfix, InequalExpression,
    Interface, LambdaExpression, LambdaType, LessEqualExpression,
    LessExpression,
    LiteralType, LogicAndExpression, LogicOrExpression,
    MinusPrefix, ModAssign,
    ModExpression,
    Modifier,
    Module, MulAssign, MulExpression,
    NotPrefix,
    NumberType,
    Operation, OrAssign, OrExpression, PointType,
    ReferencePrefix, ShlAssign, ShlExpression, ShrAssign, ShrExpression, StringType, SubAssign, SubExpression,
    Type,
    Value,
    Variable,
    VoidType, XorAssign, XorExpression
} from '../utils'
import {PeepholeScope} from '../utils/lib/tool'
export class Scope extends PeepholeScope{
    parent:Scope
    global:Scope
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
    operation_number=0
    cast_number=0
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
    root():Scope{
        let s:Scope=this
        while(s.parent)s=s.parent
        return s
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
        for(const [k,v] of this.operation)
            if(type_same(k,type))ret.push(...v)
        if(ret.length)return ret
        if(this.parent)return this.parent.get_operation(type)
        if(this.global&&this.global!=this)return this.global.get_operation(type)
        return []
    }
    set_operation(type:Type,operation:Operation){
        let key=null
        operation.index=this.operation_number++
        for(const k of this.operation.keys())if(type_same(k,type)){key=k;break}
        if(key!=null)this.operation.get(key).push(operation)
        else this.operation.set(type,[operation])
    }
    get_cast(type:Type):Cast[]{
        let ret=[]
        for(const [k,v] of this.cast)
            if(type_same(k,type))ret.push(...v)
        if(ret.length)return ret
        if(this.parent)return this.parent.get_cast(type)
        if(this.global&&this.global!=this)return this.global.get_cast(type)
        return []
    }
    set_cast(type:Type,cast:Cast){
        let key=null
        cast.id=this.cast_number++
        for(const k of this.cast.keys())if(type_same(k,type)){key=k;break}
        if(key!=null)this.cast.get(key).push(cast)
        else this.cast.set(type,[cast])
    }
    thr(msg:string){
        this.global.error.push(msg)
    }
}
export function name(name:string,scope:Scope,ast:ASTTree=null,func=false){
    const exist=scope.get(name)
    //未定义或就是自身:不算冲突
    if(exist==null||exist==ast)return false
    //函数重载允许同名
    return !(func && exist instanceof Function)

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
export type slang_check_visitor =(ast:ASTTree, scope:Scope, call:(ast:ASTTree,round:number,scope?:Scope)=>void)=>void
export function param_is(iden:Type[],param:Map<string,Type>,scope:Scope){
    const real=Array.from(param.values())
    if(iden.length!=real.length)return false
    //每个声明形参都要能接受对应实参
    for(let i=0;i<iden.length;i++)
        if(!type_is(real[i],iden[i],scope))return false
    return true
}
export function fill_modifier(data:Block){
    let def=null
    for(const [k,v] of Default_Modifier)
        if(data instanceof k){def=v;break}
    //未显式指定的字段(null)用默认值补齐,否则 null 会被当成 false(例如 public 方法被当成 static)
    if(data.modifiers==null)return def
    if(def==null)return data.modifiers
    return new Modifier(
        data.modifiers.unstatic==null?def.unstatic:data.modifiers.unstatic,
        data.modifiers._async==null?def._async:data.modifiers._async,
        data.modifiers._private==null?def._private:data.modifiers._private
    )
}
export function type_same(a:Type,b:Type):boolean{
    if(a==null||b==null)return a==b
    if(a.constructor!=b.constructor)return false
    if(a instanceof LiteralType)return true
    if(a instanceof ClassType)return (a as ClassType).local.join('.')==(b as ClassType).local.join('.')
    if(a instanceof FixType&&b instanceof FixType)
        return type_same(a.t,b.t)
    if(a instanceof GenericType)return (a as GenericType).generic==(b as GenericType).generic
    return false
}
export function type_merge(_type1:Type,_type2:Type,scope:Scope):Type{
    //null 入参无从合并
    if(_type1==null||_type2==null)return new VoidType()
    let type1=real_type(_type1,scope)
    let type2=real_type(_type2,scope)
    //未解析的泛型(real_type 返回 undefined)
    if(type1==null){
        scope.thr(`generic type ${_type1 instanceof GenericType?_type1.generic:'unknown'} not found`)
        return new VoidType()
    }
    if(type2==null){
        scope.thr(`generic type ${_type2 instanceof GenericType?_type2.generic:'unknown'} not found`)
        return new VoidType()
    }
    if(type1 instanceof VoidType)return type2
    if(type2 instanceof VoidType)return type1
    if(type1 instanceof BasicType&&type2 instanceof BasicType){
        //情况1:两个Class
        if(type1 instanceof ClassType&&type2 instanceof ClassType){
            let name1=type1.local.join('.')
            let name2=type2.local.join('.')
            //同名即同一类型
            if(name1==name2)return type1
            //实现链:type2 的实现链中含 type1 则 type2 是 type1 的子类型,取 type1
            let chain=scope.root().chain
            let _t1=scope.get(name1)
            let _t2=scope.get(name2)
            if(chain.has(name2)&&chain.get(name2).has(_t1 as Interface))return type1
            if(chain.has(name1)&&chain.get(name1).has(_t2 as Interface))return type2
            return new VoidType()
        }
        if(type1 instanceof EnumType||type2 instanceof EnumType){
            let e=type1 instanceof EnumType?type1:type2 as EnumType
            let o=type1 instanceof EnumType?type2:type1
            if(o instanceof NumberType)return o
            if(o instanceof EnumType)return e.local.join('.')==(o as EnumType).local.join('.')?e:new VoidType()
            if(o instanceof BlockType)return (o as BlockType).local.join('.')==e.local.join('.')?o:new VoidType()
            if(o instanceof ClassType)return (o as ClassType).local.join('.')==e.local.join('.')?o:new VoidType()
        }
        return type1.constructor==type2.constructor?type1:new VoidType()
    }
    //两个FixType
    if(type1 instanceof FixType&&type2 instanceof FixType){
        if(type1.constructor!=type2.constructor)return new VoidType()
        type1.t=type_merge(type1.t,type2.t,scope)
        return type1
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
    for(const a of all)
        for(const b of all){
            if(a==b)continue
            const pa=Array.from(a.command.params.values()),pb=Array.from(b.command.params.values())
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
export function cast_get(type:Type,scope:Scope):{id:string,type:Type}[]{
    type=real_type(type,scope)
    let local=''
    if(type instanceof NumberType)local='number'
    if(type instanceof StringType)local='string'
    if(type instanceof BooleanType)local='boolean'
    if(type instanceof ClassType)local=type.local.join('.')
    return scope.get_cast(type).map(i=>{return {id:local+'.cast@'+i.id,type:i.t}})
}
export function type_is(type1:Type,type2:Type,scope:Scope){
    //type2(实际值)能否赋给 type1(目标)
    return type_(type2,type1,scope)
}
//子类型判断:type 兼容 target(同构或实现链上 type 是 target 的子类)
function type_sub(type:Type,target:Type,scope:Scope):boolean{
    if(type==null||target==null)return false
    //只能互相是子类型
    if(type instanceof ClassType&&target instanceof ClassType){
        let tn=type.local.join('.'),an=target.local.join('.')
        //一个类
        if(tn==an)return true
        let chain=scope.root().chain
        return chain.has(tn) && chain.get(tn).has(scope.get(an) as Interface)
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
    return new PointType(a)
}
export function each_oper(scope:Scope,param:Type,ret:any[]):{type:Type,unwarp:string[]}{
    let unwarp=[]
    let each=(data:Type)=>{
        for(let i of scope.get_operation(data)){
            if(i.oper!=':')continue
            let type
            if(ret.map(j=>{
                type=j
                let ret=type_merge(i.command.ret,j,scope) instanceof j
                if(ret)unwarp.push(i.oper)
                return ret
            }).includes(true))return type
        }
        for(let i of scope.get_operation(data))
            each(real_type(i.command.ret,scope))
        return {type:new VoidType(),unwarp:[]}
    }
    return {
        type:each(real_type(param,scope)),
        unwarp
    }
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
    [AddExpression,'+'],
    [MulExpression,'*'],
    [DivExpression,'/'],
    [SubExpression,'-'],
    [ModExpression,'%'],
    [ShrExpression,'>>'],
    [ShlExpression,'<<'],
    [GreaterExpression,'>'],
    [LessExpression,'<'],
    [GreaterEqualExpression,'>='],
    [LessEqualExpression,'<='],
    [InequalExpression,'!='],
    [EqualExpression,'=='],
    [AndExpression,'&'],
    [OrExpression,'|'],
    [XorExpression,'^'],
    [LogicAndExpression,'&&'],
    [LogicOrExpression,'||'],
])
export const Operation_Assign=new Map<any,string>([
    [AAssign,''],
    [AddAssign,'+'],
    [SubAssign,'-'],
    [MulAssign,'*'],
    [DivAssign,'/'],
    [ModAssign,'%'],
    [AndAssign,'&'],
    [OrAssign,'|'],
    [XorAssign,'^'],
    [ShlAssign,'<<'],
    [ShrAssign,'>>']
])
export function check_implement(i:Type,scope:Scope,line:string[]){
    const ls=real_type(i,scope)
    if(!(ls instanceof ClassType)){
        scope.thr(`generic implement的类型不是ClassType,在行${line}`)
        return
    }
    const name=ls.local.join('.')
    const implement=resolve_named(scope,name)
    if(implement==null){
        scope.thr(`generic implement的类型${name}不存在,在行${line}`)
        return
    }
    if(!(implement instanceof Interface))
        scope.thr(`generic implement的类型${name}不是Interface,在行${line}`)
}
export function cast_best(result:Type,_cast:Type,scope:Scope):{id:string,type:Type}{
    let cast=cast_get(real_type(_cast,scope),scope)
    cast=cast.filter(i=>!(type_merge(real_type(result,scope),real_type(i.type,scope),scope) instanceof VoidType))
    let ret=cast[0]
    for(let i of cast)
        if(type_same(type_merge(real_type(i.type,scope),real_type(ret.type,scope),scope),i.type))
            ret=i
    if(ret==null)return undefined
    return {
        id:ret.id,
        type:real_type(ret.type,scope)
    }
}
//类型检查:a 是实际/来源类型,b 是期望/目标类型
export function type_(a:Type,b:Type,scope:Scope){
    if(a==null)return b==null||real_type(b,scope) instanceof VoidType
    if(b==null)return false
    const ra=real_type(a,scope)
    const rb=real_type(b,scope)
    if(ra==null||rb==null)return false
    //Void(无值/未解析)只与 Void 兼容
    if(ra instanceof VoidType||rb instanceof VoidType)
        return ra instanceof VoidType&&rb instanceof VoidType
    //同构或可合并即兼容
    if(!(type_merge(ra,rb,scope) instanceof VoidType))return true
    //'=' 重载:目标类型上的 = 第二个参数接受来源
    const assign=scope.get_operation(rb).filter(i=>i.oper=='=').filter(i=>{
        const ps=Array.from(i.command.params.values())
        return ps.length>=2&&!(type_merge(real_type(ps[1],scope),ra,scope) instanceof VoidType)
    })
    if(assign.length>0)return true
    //cast 放行
    return cast_best(rb,ra,scope)!=null
}
export function generic_name(name:string,scope:Scope){
    return scope.generic.get(name) == null
}
export function real_type(type:Type,scope:Scope){
    if(type==null)return null
    if(type instanceof FixType){
        type.t=real_type(type.t,scope)
        return type
    }
    //保留 ClassType,只解析其泛型实参(不能替换成 Class 块)
    if(type instanceof ClassType)
        return new ClassType(type.local,type.generic.map(i=>real_type(i,scope)),type._this)
    if(type instanceof GenericType)return scope.get_generic(type.generic)
    if(type instanceof LambdaType){
        if(!type.overload){
            let params=new Map<string,Type>()
            for(const [k,v] of type.params)params.set(k,real_type(v,scope))
            return new LambdaType(type.generic,params,real_type(type.returnType,scope),false,type.name)
        }
        const parts=type.name.split('@')
        const index=parseInt(parts[1])
        const real=scope.get_overload(parts[0]).filter(i=>i.index===index)[0]
        if(real==null)return type
        if(real.type instanceof LambdaType)real.type.overload=false
        real.type=real_type(real.type,scope)
        if(real.type instanceof LambdaType)real.type.overload=true
        return real.type
    }
    return type
}
export function get_field(type:Class|Interface,scope:Scope){
    let field=type.children
    let ret=new Map<string,Type>()
    for(let i of field)
        ret.set(i.name,real_type(i.type,scope))
    return ret
}
//按名解析符号:本地作用域优先,其次全局,最后按当前路径补全
export function resolve_named(scope:Scope,name:string):ASTTree{
    let data=scope.get(name)
    if(data==null&&scope.global)data=scope.global.get(name)
    if(data==null&&scope.path!=''&&scope.global)data=scope.global.get(scope.path+'.'+name)
    return data==null?null:data
}
//收集 block 实现/继承的接口(传递闭包)
export function collect_chain(scope:Scope,block:Class|Interface,out:Set<Interface>,seen:Set<Block>){
    if(block==null||seen.has(block))return
    seen.add(block)
    if(!(block.implement instanceof ClassType))return
    const target=resolve_named(scope,block.implement.local.join('.'))
    if(target instanceof Interface){
        out.add(target)
        collect_chain(scope,target,out,seen)
    }
}
//把 类/接口名 -> 实现接口集合 写入 root().chain(全名与裸名都注册)
export function build_chain(scope:Scope,name:string,block:Class|Interface){
    const root=scope.root()
    const set=new Set<Interface>()
    collect_chain(scope,block,set,new Set())
    for(const key of [name,block.name]){
        if(key==null||key=='')continue
        let cur=root.chain.get(key)
        if(!cur){cur=new Set();root.chain.set(key,cur)}
        for(const i of set)cur.add(i)
    }
}
export function is_array_or_map(type:Type){
}
export function findOper(map: Map<any,string>, node:ASTTree): string {
    for (const [k, v] of map) if (node instanceof k) return v
    return ''
}
export function findCastBy(scope:Scope, from:Type, pred: (t:Type)=>boolean){
    const cast=cast_get(from,scope)
    return cast.filter(i=>pred(i.type))[0]
}
export function localToName(local:string[]){
    return local.join('.')
}
export function nameToLocal(name:string){
    return name.split('.')
}
export function bindGenerics(scope:Scope, defGeneric: Map<string,Type>, instGeneric: Type[]) {
    let k = 0;
    for (const key of defGeneric.keys()) {
        if (k >= instGeneric.length) break
        scope.set_generic(key, instGeneric[k++])
    }
}
export function check_static_modifier(ast:Block, scope:Scope, kind: string) {
    ast.modifiers = fill_modifier(ast)
    const line = ast.line.join('\n')
    if (ast.modifiers.unstatic) scope.thr(`${kind}不能是非static的,在行${line}`)
    if (ast.modifiers._private) scope.thr(`${kind}不能是私有的,在行${line}`)
    if (ast.modifiers._async)   scope.thr(`${kind}不能是异步的,在行${line}`)
    ast.modifiers = Default_Modifier.get(ast)
}
export function check_async_modifier(ast:Block, scope:Scope,kind:string){
    ast.modifiers=fill_modifier(ast)
    if(ast.modifiers._async){
        scope.thr(`${kind}不能是异步的,在行${ast.line.join('\n')}`)
        ast.modifiers._async=false
    }
}
export function check_dup(keys: Iterable<string>, scope: Scope, label: string, line: string[]) {
    const arr = Array.from(keys)
    if (new Set(arr).size != arr.length)
        scope.thr(`${label}重复定义,在行${line.join('\n')}`)
}
export function verify_generics(ast:Class|Interface|LambdaExpression|Function|LambdaType, scope:Scope, call) {
    for (let i of ast.generic.values()) {
        call(i, 2, scope)
        check_implement(i, scope, ast.line)
    }
}
export function try_cast_to(scope:Scope, type:Type, want: Type){
    const cast = cast_get(type, scope)
    const hit = cast.find(i => i.type instanceof want.constructor)
    return hit ? {id: hit.id, type: hit.type} : null
}