import {
    ArrayType, Assign,
    ASTTree,
    Block, BooleanType,
    Cast, Class,
    ClassType, Enum, EnumType, Expression, FixType,
    Function, GenericType, GotoCommand, IdentifierExpr,
    Interface, LabelCommand, LambdaType, LiteralType,
    Module, NumberType,
    Operation, PointType, ReferencePrefix,
    ReferenceType,
    Type, VarDecl,
    Variable, VoidType
} from '../utils'
import {PeepholeScope} from '../utils/lib/tool'
import {assertType} from 'vitest'
import ast from '../parser/ast'
export class Scope extends PeepholeScope{
    parent:Scope
    block_parent:Scope
    global:Scope
    func:boolean=false
    block:boolean=false
    in_new=false
    //标签表
    label:string[]=[]
    //标签需要延迟处理
    label_delay:{label:string,ast:GotoCommand}[]=[]
    //继承链,key implements value
    implement:Map<string[],ClassType[]>
    //符号表
    symbol:Map<string,ASTTree>
    generic:Map<string,Type>
    //Literal的operation,cast重载
    operation:Map<Type,Operation[]>
    cast:Map<Type,Cast[]>
    cast_oper_type:Type
    error:string[]
    _loop:boolean=false
    ret:Type=null
    path:string=''
    private cast_index:number=0
    private operation_index:number=0
    constructor(parent:Scope,global:Scope){
        super(parent,global)
        this.symbol=new Map()
        this.generic=new Map()
        this.operation=new Map()
        this.cast=new Map()
        this.implement=new Map()
        this.cast_oper_type=null
        this.error=[]
        this.label=[]
    }
    private label_set(name:string){
        if(!this.label.includes(name))this.label.push(name)
    }
    register_label(name:string,ast:LabelCommand){
        if(this.func){
            if(this.label.includes(name))this.thr(`标签${name}重复定义`,ast)
            this.label_set(name)
            return
        }
        this.parent.register_label(name,ast)
    }
    delay_set(name:string,ast:GotoCommand){
        if(this.func){
            if(this.label.includes(name))return
            this.label_delay.push({label:name,ast:ast})
            return
        }
        this.parent.delay_set(name,ast)
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
        //按键相容匹配收集候选(字面量类型实例不等价)
        const ret:Operation[]=[]
        for(const [key,value] of this.operation)
            if(type_sub(key,type,this))ret.push(...value)
        return ret
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
    public cast_get(name:Type):Cast[]{
        if(this.global!=null)return this.global.cast_get(name)
        const ret:Cast[]=[]
        for(const [key,value] of this.cast)
            if(type_sub(key,name,this))ret.push(...value)
        return ret
    }
    public thr(str:string,ast:ASTTree){
        if(this.global==null)this.error.push(`${str}在行${ast.line}`)
        else this.global.thr(str,ast)
    }
    public get(name:string):ASTTree{
        if(this.func)return this.symbol.get(name)||this.block_parent?.get(name)||this.global?.get(name)||null
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
    public enter(func:boolean=false,block:boolean=false):Scope{
        let ret=new Scope(this,this.global)
        if(this.block)ret.block_parent=this
        else ret.block_parent=this.block_parent
        ret.block=block
        ret.func=func
        ret.ret=this.ret
        return ret
    }
    public leave():Scope{
        if(this.func)
            //delay结算
            for(const {label,ast} of this.label_delay)
                if(!this.label.includes(label))
                    this.thr(`标签${label}未定义`,ast)
        return this.parent
    }
}
export type slang_check_visitor =(ast:ASTTree, scope:Scope, call:(ast:ASTTree,round:number,scope?:Scope)=>void)=>void
//模块合并
function module_merge(a:Module,b:Module){
    return new Module(a.modifiers,a.name,[...a.children,...b.children])
}
//处理前置定义
export function symbol_iden(ast:Block[],scope:Scope,path:string=''){
    if(ast==null)return
    let func_index=0
    let oper_index=0
    let cast_index=0
    for(const item of ast){
        if(item instanceof Operation)item.index=oper_index++
        if(item instanceof Cast)item.id=cast_index++
        if(item instanceof Function)item.index=func_index++
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
            if(block instanceof Function&&item instanceof Function){
                //同名函数:重载组挂在符号表首个函数上(多轮 symbol_iden 重复经过,按身份去重)
                if(block.overloads==null)block.overloads=[block]
                if(!block.overloads.includes(item))block.overloads.push(item)
            }
            continue
        }
        scope.set(path+item.name,item)
        //特殊处理:Variable是Type
        if(item instanceof Variable)
            scope.set(path+item.name,item.t)
    }
    for(const item of ast)
        if('children' in item&&!(item instanceof Enum))
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
        if(a.constructor==b.constructor)return a
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
        if(a.local.join('.')==b.local.join('.'))return a
        const implement=scope.global.implement.get(a.local)??[]
        for(const i of implement)
            if((i as ClassType).local.join('.')==b.local.join('.'))return b
    }
    if(a instanceof EnumType&&b instanceof EnumType)
        if(a.local==b.local)return a
    return new VoidType()
}
//a是b的子类型
export function type_sub(a:Type,b:Type,scope:Scope):boolean{
    if(a==null||b==null)return false
    if(a instanceof VoidType) return true
    if(b instanceof VoidType) return true
    if(a instanceof ReferenceType)return type_sub(a.t,b,scope)
    if(b instanceof ReferenceType)return type_sub(a,b.t,scope)
    if(a instanceof ArrayType&&b instanceof ArrayType)return type_sub(a.t,b.t,scope)
    if(a instanceof PointType&&b instanceof PointType)return type_sub(a.t,b.t,scope)
    if(a instanceof LambdaType&&b instanceof LambdaType){
        //a的泛型都是b的泛型的子类型
        for(const [key,value] of a.generic){
            const bg=b.generic.get(key)
            if(bg==null||!type_sub(value,bg,scope))return false
        }
        //a的参数都是b的参数的子类型
        for(const [key,value] of a.params){
            const bp=b.params.get(key)
            if(bp==null||!type_sub(value,bp,scope))return false
        }
        //a的返回值是b的返回值的子类型
        return type_sub(a.returnType,b.returnType,scope)
    }
    if(a instanceof ClassType&&b instanceof ClassType){
        //同一类相容;不同类查继承链
        if(a.local.join('.')==b.local.join('.'))return true
        const implement=scope.global.implement.get(a.local)??[]
        for(const i of implement)
            if(type_sub(i,b,scope))return true
        return false
    }
    if(a instanceof EnumType&&b instanceof EnumType)
        return a.local.join('.')==b.local.join('.')
    //其余同种类型自反相容(number/boolean/字面量等)
    return a.constructor==b.constructor
}
//具体性比较,如果a比b更具体返回true
//要求两者length相同
//也可以用于泛型相容性检查
export function param_best(param1:Type[],param2:Type[],scope:Scope){
    if(param1.length!=param2.length)return false
    return param1.every((v,i)=>type_sub(v,param2[i],scope))
}
//将左值类型转换为便于计算的纯右值类型
export function to_right(type:Type){
    if(type instanceof ReferenceType)return to_right(type.t)
    return type
}
//类型匹配检查,param_iden为形参,param_real为实参,generic_iden为形式泛型,generic_real为注入泛型,匹配返回true否则false
export function param_check(ast:ASTTree,param_iden:Map<string,Type>,param_real:Type[],generic_iden:Map<string,Type>,generic_real:Type[],scope:Scope){
    if(param_iden.size!=param_real.length)
        return false
    if(generic_iden.size!=generic_real.length)
        return false
    const iden=Array.from(param_iden.values())
    for(let i=0;i<iden.length;i++)
        if(!type_sub(iden[i],param_real[i],scope))
            return false
    const gen=Array.from(generic_iden.values())
    for(let i=0;i<gen.length;i++)
        if(!type_sub(gen[i],generic_real[i],scope))
            return false
    return true
}
export function type_view(type:Type){
    const d=to_right(type)
    if(d instanceof Block)return d.type
    return d
}
export function local(scope:Scope,ast:Block){
    return scope.path==''?ast.name:scope.path+'.'+ast.name
}
export function join_path(base:string,name:string){
    return base==''||base==null?name:base+'.'+name
}
//给定type和表做类型推断
function generic_type_get(type:Type,generic:Map<string,Type>):Type{
    if(type instanceof GenericType&&generic.has(type.generic))
        return generic.get(type.generic)
    if(type instanceof ReferenceType)return new ReferenceType(generic_type_get(type.t,generic))
    if(type instanceof PointType)return new PointType(generic_type_get(type.t,generic))
    if(type instanceof ArrayType)return new ArrayType(generic_type_get(type.t,generic))
    if(type instanceof LambdaType){
        let ret:LambdaType=new LambdaType(new Map(),new Map(),new VoidType())
        for(const [key,value] of type.params)
            ret.params.set(key,generic_type_get(value,generic))
        for(const [key,value] of type.generic)
            ret.generic.set(key,generic_type_get(value,generic))
        ret.returnType=generic_type_get(type.returnType,generic)
        return ret
    }
    if(type instanceof ClassType)
        return new ClassType(type.local,type.field.map(i=>generic_field_get(i,generic)))
    return type
}
function generic_field_get(ast:Block,generic:Map<string,Type>):Block{
    if(ast instanceof Variable){
        let ret=structuredClone(ast)
        ret.t=generic_type_get(ast.t,generic)
        return ret
    }
    if(ast instanceof Function){
        let ret=structuredClone(ast)
        for(const [key,value] of ret.generic)
            ret.generic.set(key,generic_type_get(value,generic))
        for(const [key,value] of ret.params)
            ret.params.set(key,generic_type_get(value,generic))
        ret.return_type=generic_type_get(ast.return_type,generic)
        return ret
    }
    if(ast instanceof Operation){
        let ret=structuredClone(ast)
        ret.command.type=generic_type_get(ast.command.type,generic)
        return ret
    }
    if(ast instanceof Cast){
        let ret=structuredClone(ast)
        ret.t=generic_type_get(ast.t,generic)
        return ret
    }
    return ast
}
//得到推断后的ClassType
export function class_generic_type(ast:Class|Interface,generic:Type[],scope:Scope,_this=false){
    let real_generic=new Map<string,Type>()
    {
        let i=0
        for(const index of ast.generic.keys())
            real_generic.set(index,generic[i++])
    }
    const field=ast.children.filter(i=>i.modifiers.unstatic).filter(i=>this||!i.modifiers._private)
        .map(i=>generic_field_get(i,real_generic))
    return new ClassType(ast.global_local,field)
}
export function function_generic_type(ast:Function,generic:Type[],scope:Scope){
    let real_generic=new Map<string,Type>()
    {
        let i=0
        for(const index of ast.generic.keys())
            real_generic.set(index,generic[i++])
    }
    let ret=structuredClone(ast)
    for(const [key,value] of ret.generic)
        ret.generic.set(key,generic_type_get(value,real_generic))
    for(const [key,value] of ret.params)
        ret.params.set(key,generic_type_get(value,real_generic))
    ret.return_type=generic_type_get(ast.return_type,real_generic)
    return ret
}
//operation决议:left为接收者类型,形参约定=[接收者,...实参]
//候选来源:字面量类型查value块注册表,类类型直接取类型携带的成员
//实例视图 field:运算/转换恒收录(经接收者调用),函数/变量为非显式静态成员
//with_private 为 true 时用于 this 视图(不受 private 限制)
export function instance_field(children:Block[],with_private:boolean){
    return children.filter(i=>
        (i instanceof Operation||i instanceof Cast||i.modifiers.unstatic!==false)
        &&(with_private||!i.modifiers._private))
}
export function operation_get(scope:Scope,ast:ASTTree,oper:string,left:Type,...param:Type[]){
    left=to_right(left)
    let candidates:Operation[]
    if(left instanceof LiteralType)
        candidates=scope.operation_get(left)
    else if(left instanceof ClassType)
        candidates=left.field.filter(i=>i instanceof Operation)
    else
        return null
    candidates=candidates.filter(i=>i.oper==oper)
        .filter(i=>param_check(ast,i.command.params,[left,...param],new Map(),[],scope))
    //具体性决议:被参数更具体的其他存活候选覆盖则淘汰
    const survivors=candidates.filter(i=>{
        for(const other of candidates){
            if(other==i)continue
            if(param_best(Array.from(other.command.params.values()),
                          Array.from(i.command.params.values()),scope))
                return false
        }
        return true
    })
    if(survivors.length==0)return null
    if(survivors.length!=1){
        scope.thr(`${oper}存在无法具体性决议的operation`,ast)
        return null
    }
    return survivors[0]
}
//cast决议:data为被转换类型,qiw为期望目标类型;候选来源同operation
export function cast_get(scope:Scope,ast:ASTTree,data:Type,qiw:Type){
    data=to_right(data)
    let candidates:Cast[]
    if(data instanceof LiteralType)
        candidates=scope.cast_get(data)
    else if(data instanceof ClassType)
        candidates=data.field.filter(i=>i instanceof Cast)
    else
        return null
    candidates=candidates.filter(i=>type_sub(i.t,qiw,scope))
    //具体性决议:输出类型更具体的其他存活候选覆盖则淘汰
    const survivors=candidates.filter(i=>{
        for(const other of candidates){
            if(other==i)continue
            if(type_sub(other.t,i.t,scope))
                return false
        }
        return true
    })
    if(survivors.length==0)return null
    if(survivors.length!=1){
        scope.thr('存在无法具体性决议的cast',ast)
        return null
    }
    return survivors[0]
}
export function fast_operation(scope:Scope,ast:ASTTree,oper:string,left:Type,...param:(Type|Expression)[]){
    param=param.map(i=>i instanceof Expression?i.type:i)
    const operation=operation_get(scope,ast,oper,left,...(param as Type[]))
    if(operation==null)return false
    //operation 节点的类型即其 lambda 的返回类型
    ast.type=operation.command.ret
    ast['oper']=oper+'@'+operation.index
    return true
}
export function fast_cast(scope:Scope,ast:Expression,data:Type,qiw:Type){
    if(type_sub(data,qiw,scope))return true
    const cast=cast_get(scope,ast,data,qiw)
    if(cast==null)return false
    ast.type=cast.t
    const input=to_right(data)
    ast.cast=input instanceof LiteralType
        ?(input instanceof NumberType?'number':'boolean')+'.cast@'+cast.id
        :'cast@'+cast.id
    return true
}
