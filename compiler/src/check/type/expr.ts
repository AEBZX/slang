import {
    AddressPrefix,
    ArgumentsPostfix, ArrayExpression,
    ArrayType,
    BinaryExpression, BitNotPrefix, Block, BlockType, BooleanLiteral,
    BooleanType, Class, ClassType, DecrementPostfix, DecrementPrefix, Enum, EnumType, IdentifierExpr,
    IncrementPostfix, IncrementPrefix, IndexPostfix, Interface, LambdaExpression,
    LambdaType, Literal, MapExpression, MapType, MemberPostfix, MinusPrefix, Module, NewPrefix, NotPrefix, NullLiteral,
    NumberLiteral,
    NumberType, PointType, PostfixExpression, PrefixExpression, ReferencePrefix, StringLiteral, StringType,
    TernaryExpression, Type, TypePrefix, VarDecl, Variable,
    VoidType
} from '../../utils'
import {
    bindGenerics,
    cast, cast_best, cast_get, generic_is, localToName,
    operation,
    Operation_Binary, param_is, pick_best,
    real_type,
    slang_check_visitor,
    to_point, type_,
    type_merge,
    type_same
} from '../tool'
const Label_TernaryExpression:slang_check_visitor=(ast:TernaryExpression,scope,call)=>{
    call(ast.condition,3)
    call(ast.trueExpr,3)
    call(ast.falseExpr,3)
    const merge=type_merge(real_type(ast.trueExpr.type,scope),real_type(ast.falseExpr.type,scope),scope)
    if(merge instanceof VoidType){
        //falseExpr能不能期望到trueExpr
        if(!cast(ast.falseExpr,scope,ast.trueExpr.type)){
            scope.thr(`三元运算符的true/false表达式不是同一类型,在行${(ast.line??[]).join('\n')}`)
            return
        }
        ast.type=ast.trueExpr.type
        return
    }
    ast.type=merge
}
const Label_BinaryExpression:slang_check_visitor=(ast:BinaryExpression,scope,call)=>{
    call(ast.left,3)
    call(ast.right,3)
    let oper:string=''
    for(const [k,v] of Operation_Binary)
        if(ast instanceof k)oper=v
    if(operation(oper,ast,scope,new VoidType(),to_point(ast.left.type),to_point(ast.right.type)))return
    //operation>正常>cast:没匹配到用户定义就走内建,两侧同型直接过
    const number_oper=['+','-','*','/','%','&','|','^','>>','<<']
    ast.type=number_oper.includes(oper)?new NumberType():new BooleanType()
    if(type_same(real_type(ast.left.type,scope),real_type(ast.right.type,scope)))return
    if(cast(ast.left,scope,ast.right.type))return
    if(cast(ast.right,scope,ast.left.type))return
    scope.thr(`二元运算符${oper}的类型错误在行${(ast.line??[]).join('\n')}`)
}
const Label_IncrementOrDecrementPostfixOrPrefix:slang_check_visitor=(ast:IncrementPostfix|DecrementPostfix|IncrementPrefix|DecrementPrefix,scope,call)=>{
    call(ast.expr,3)
    ast.type=new NumberType()
    if(ast instanceof PostfixExpression){
        if(ast instanceof IncrementPostfix&&operation('++',ast,scope,new NumberType(),to_point(ast.expr.type),new NumberType()))return
        if(ast instanceof DecrementPostfix&&operation('--',ast,scope,new NumberType(),to_point(ast.expr.type),new NumberType()))return
    }
    if(ast instanceof PrefixExpression){
        if(ast instanceof IncrementPrefix&&operation('++',ast,scope,new NumberType(),to_point(ast.expr.type)))return
        if(ast instanceof DecrementPrefix&&operation('--',ast,scope,new NumberType(),to_point(ast.expr.type)))return
    }
    if(real_type(ast.expr.type,scope) instanceof NumberType)return
    if(cast(ast.expr,scope,new NumberType()))return
    scope.thr(`++/--只能用于number类型在行${(ast.line??[]).join('\n')}`)
}
const Label_MemberPostfix:slang_check_visitor=(ast:MemberPostfix,scope,call)=>{
    call(ast.expr,3)
    const type=real_type(ast.expr.type,scope)
    //类实例:成员是实例成员(静态成员要写成 C.m)
    if(type instanceof ClassType){
        const block=scope.get(localToName(type.local)) as Class
        if(block instanceof Class){
            const member=block.children.find(i=>i.name==ast.name&&i.modifiers.unstatic&&!i.modifiers._private)
            if(member instanceof Function){ast.type=member.type;return}
            if(member instanceof Variable){ast.type=real_type(member.t,scope);return}
            if(member!=null){ast.type=new BlockType([...type.local,ast.name]);return}
            scope.thr(`${type.local.join('.')}没有成员${ast.name}在行${(ast.line??[]).join('`n')}`)
            return
        }
    }
    if(type instanceof BlockType){
        const block=scope.get(localToName(type.local)) as Block
        if(block==null){
            scope.thr(`未定义的块${type.local.join('.')}在行${(ast.line??[]).join('\n')}`)
            return
        }
        if(block instanceof Enum&&block.children.includes(ast.name)){
            ast.type=new EnumType(type.local)
            return
        }
        if(block instanceof Module||block instanceof Class||block instanceof Interface){
            const member=block.children.find(i=>i.name==ast.name&&(type._this||!i.modifiers._private)
                &&(block instanceof Module||!i.modifiers.unstatic))
            if(member instanceof Function){ast.type=member.type;return}
            if(member instanceof Variable){ast.type=real_type(member.t,scope);return}
            if(member!=null){ast.type=new BlockType([...type.local,ast.name]);return}
        }
    }
    if(type instanceof ClassType){
        const block=scope.get(localToName(type.local)) as Class|Interface
        const field=block.children.find(i=>i.name==ast.name&&i.modifiers.unstatic&&
            (type._this||!i.modifiers._private))
        if(field!=null){ast.type=field.type;return}
    }
    scope.thr(`${ast.name}不存在,在行${(ast.line??[]).join('\n')}`)
}
const Label_IndexPostfix:slang_check_visitor=(ast:IndexPostfix,scope,call)=>{
    call(ast.expr,3)
    call(ast.index,3)
    const expr_type=real_type(ast.expr.type,scope)
    const index_type=real_type(ast.index.type,scope)
    if(operation('[]',ast,scope,new VoidType(),to_point(expr_type),to_point(index_type)))return
    const expr_cast_map=cast(ast.expr,scope,new MapType(new VoidType()))
    const expr_cast_string=cast(ast.expr,scope,new StringType())
    const expr_cast_array=cast(ast.expr,scope,new ArrayType(new VoidType()))
    const index_cast_string=cast(ast.index,scope,new StringType())
    const index_cast_number=cast(ast.index,scope,new NumberType())
    if(expr_type instanceof StringType){
        if(index_type instanceof NumberType||index_cast_number){
            ast.type=new StringType()
            return
        }
        scope.thr(`string的索引只能是number在行${(ast.line??[]).join('\n')}`)
        return
    }
    if(expr_type instanceof ArrayType){
        if(index_type instanceof NumberType||index_cast_number){
            ast.type=expr_type.t
            return
        }
        scope.thr(`array的索引只能是number在行${(ast.line??[]).join('\n')}`)
        return
    }
    if(expr_type instanceof MapType){
        if(index_type instanceof StringType||index_cast_string){
            ast.type=expr_type.t
            return
        }
        scope.thr(`map的索引只能是string在行${(ast.line??[]).join('\n')}`)
        return
    }
    if(index_type instanceof NumberType&&(expr_cast_array||expr_cast_string))return
    if(index_type instanceof StringType&&expr_cast_map)return
    //两个不知名奇葩类型,需要尝试组合
    if(expr_cast_map&&index_cast_string)return
    if(expr_cast_array&&index_cast_number)return
    if(expr_cast_string&&index_cast_number)return
    scope.thr(`不支持的索引类型组合在行${(ast.line??[]).join('\n')}`)
}
const Label_ArgumentsPostfix:slang_check_visitor=(ast:ArgumentsPostfix,scope,call)=>{
    call(ast.expr,3)
    for(const i of ast.generic)
        call(i,3)
    for(const i of ast.args)
        call(i,3)
    if(operation('()',ast,scope,new VoidType(),to_point(ast.expr.type),...ast.args.map(i=>i.type)))return
    //裸类名/点路径的 callee 类型是 BlockType:解析回块,函数取函数类型,类按构造处理
    if(ast.expr.type instanceof BlockType){
        const block=scope.get(localToName(ast.expr.type.local))
        if(block instanceof Function)ast.expr.type=block.type
        else if(block instanceof Class){
            ast.expr.type=new ClassType(ast.expr.type.local,Array.from(block.generic.values()))
            bindGenerics(scope,block.generic,ast.generic)
            ast.generic=[]
        }
    }
    //裸类名 callee 的类型是 BlockType:解析回块,是类就转成 ClassType 走构造
    if(ast.expr.type instanceof BlockType){
        const block=scope.get(localToName(ast.expr.type.local))
        if(block instanceof Class)ast.expr.type=new ClassType(ast.expr.type.local,Array.from(block.generic.values()))
    }
    if(ast.expr.type instanceof ClassType){
        const local=ast.expr.type.local
        const block=scope.get(localToName(local)) as Class
        const ctor=block==null||block.children==null?null:block.children.find(i=>i.name=='constructor')
        //类里写了 constructor 成员就按普通函数调用处理,没写则构造的结果就是该类的实例。
        //原来这里会把 callee 重写成合成的 MemberPostfix(...,'constructor') 再递归一次,
        //但类里根本没有这个成员,于是递归里报错时读 ast.line 直接崩掉。
        if(ctor instanceof Function)ast.expr.type=ctor.type
        else{
            ast.cons=true
            ast.local=local
            ast.type=ast.expr.type
            //类里没有构造函数:new 只能不带实参
            if(ast.args.length>0)
                scope.thr(`类${local.join('.')}没有构造函数,不能带实参在行${(ast.line??[]).join('\n')}`)
            return
        }
    }
    if(ast.expr.type instanceof LambdaType){
        if(!ast.expr.type.overload){
            if(!generic_is(ast.generic,ast.expr.type.generic,scope))
                scope.thr(`generic参数类型错误,在行${(ast.line??[]).join('\n')}`)
            if(!param_is(ast.args.map(i=>i.type),ast.expr.type.params,scope))
                scope.thr(`参数类型错误,在行${(ast.line??[]).join('\n')}`)
            ast.type=ast.expr.type.returnType
            return
        }
        const raw_generic:any=ast.generic
        const generic_list:any[]=raw_generic instanceof Map?Array.from(raw_generic.values())
            :(Array.isArray(raw_generic)?raw_generic:[])
        const explicit:Type[]=generic_list
            .map(g=>g instanceof Type?g:(g==null?null:g.type))
            .filter(g=>g instanceof Type)
        const func=scope.get_overload(ast.expr.type.name)
            .filter(i=>param_is(ast.args.map(i=>i.type),i.params,scope))
            //显式泛型为空时不该滤掉候选(隐式推断),写了才要求匹配
            .filter(i=>explicit.length==0||generic_is(explicit,i.generic,scope))
        if(func.length==0){
            scope.thr(`名称为${ast.expr.type.name}的函数没有符合generic和param的重载在行${(ast.line??[]).join('\n')}`)
            return
        }
        if(func.length>1){
            const best=pick_best(scope,func.map(i=>Array.from(i.params.values())),ast.args.map(i=>i.type))
            if(best==null||best==-1){
                scope.thr(`名称为${ast.expr.type.name}的函数有多个符合generic和param的重载在行${(ast.line??[]).join('\n')}`)
                return
            }
            func[0]=func[best]
        }
        ast.type=func[0].return_type
        ast.call_target=ast.expr.type.name+'@'+func[0].index
        return
    }
    const cast_=cast_get(ast.expr.type,scope)
        .filter(i=>i.type instanceof LambdaType&&
            param_is(ast.args.map(i=>i.type),i.type.params,scope)&&
            generic_is(ast.generic,i.type.generic,scope))
    if(cast_.length==0){
        scope.thr(`没有符合generic和param的Lambda类型转换在行${(ast.line??[]).join('\n')}`)
        return
    }
    if(cast_.length>1){
        const best=pick_best(scope,cast_.map(i=>Array.from((<LambdaType>i.type).params.values())),ast.args.map(i=>i.type))
        if(best==null||best==-1){
            scope.thr(`有多个符合generic和param的Lambda类型转换在行${(ast.line??[]).join('\n')}`)
            return
        }
        cast_[0]=cast_[best]
    }
    ast.expr.cast=cast_[0].id
    ast.type=(<LambdaType>cast_[0].type).returnType
}
const Label_MinusPrefix:slang_check_visitor=(ast:MinusPrefix,scope,call)=>{
    call(ast.expr,3)
    ast.type=new NumberType()
    if(operation('-',ast,scope,new VoidType(),to_point(ast.expr.type)))return
    if(real_type(ast.expr.type,scope) instanceof NumberType)return
    if(cast(ast.expr,scope,new NumberType()))return
    scope.thr(`负号只能用于number类型在行${(ast.line??[]).join('\n')}`)
}
const Label_ReferencePrefix:slang_check_visitor=(ast:ReferencePrefix,scope,call)=>{
    call(ast.expr,3)
    if(operation('*',ast,scope,new VoidType(),to_point(ast.expr.type)))return
    const pt=real_type(ast.expr.type,scope)
    //解引用:*T 的类型就是 T
    if(pt instanceof PointType){
        ast.type=pt.t
        return
    }
    //不是指针:有能转到指针的 cast 就借用 cast 目标的目标类型
    const c=cast_best(new PointType(new VoidType()),pt,scope)
    if(c!=null){
        ast.expr.cast=c.id
        ast.type=c.type instanceof PointType?c.type.t:new VoidType()
        return
    }
    scope.thr(`引用操作符只能用于指针类型在行${(ast.line??[]).join('\n')}`)
}
const Label_AddressPrefix:slang_check_visitor=(ast:AddressPrefix,scope,call)=>{
    call(ast.expr,3)
    if(operation('&',ast,scope,new VoidType(),to_point(ast.expr.type)))return
    let is_left=false
    if(ast.expr instanceof ReferencePrefix||ast.expr instanceof IdentifierExpr||ast.expr instanceof IndexPostfix||
        ast.expr instanceof MemberPostfix)
        is_left=true
    if(!is_left)scope.thr(`取地址操作符只能用于左值在行${(ast.line??[]).join('\n')}`)
    ast.type=new PointType(ast.expr.type)
}
const Label_BitNotPrefix:slang_check_visitor=(ast:BitNotPrefix,scope,call)=>{
    call(ast.expr,3)
    ast.type=new NumberType()
    if(operation('~',ast,scope,new VoidType(),to_point(ast.expr.type)))return
    if(real_type(ast.expr.type,scope) instanceof NumberType)return
    if(cast(ast.expr,scope,new NumberType()))return
    scope.thr(`位非操作符只能用于number类型在行${(ast.line??[]).join('\n')}`)
}
const Label_NotPrefix:slang_check_visitor=(ast:NotPrefix,scope,call)=>{
    call(ast.expr,3)
    ast.type=new BooleanType()
    if(operation('!',ast,scope,new VoidType(),to_point(ast.expr.type)))return
    if(real_type(ast.expr.type,scope) instanceof BooleanType)return
    if(cast(ast.expr,scope,new BooleanType()))return
    scope.thr(`非操作符只能用于boolean类型在行${(ast.line??[]).join('\n')}`)
}
const Label_TypePrefix:slang_check_visitor=(ast:TypePrefix,scope,call)=>{
    ast.type=ast.t
    call(ast.t,3)
    call(ast.expr,3)
    if(cast(ast.expr,scope,ast.t))return
    scope.thr(`类型转换失败,在行${(ast.line??[]).join('\n')}`)
}
const Label_NewPrefix:slang_check_visitor=(ast:NewPrefix,scope,call)=>{
    call(ast.expr,3)
    if(operation('new',ast,scope,new VoidType(),to_point(ast.expr.type)))return
    if(ast.expr instanceof ArgumentsPostfix&&ast.expr.cons){
        ast.type=new ClassType(ast.expr.local,ast.expr.generic)
        return
    }
    scope.thr(`new只能用于类,在行${(ast.line??[]).join('\n')}`)
}
const Label_IdentifierExpression:slang_check_visitor=(ast:IdentifierExpr,scope,call)=>{
    const data=scope.get(ast.name)
    if(data==null){
        scope.thr(`未定义的变量${ast.name}在行${(ast.line??[]).join('\n')}`)
        ast.type=new VoidType()
        return
    }
    ast.type=data instanceof Type?data:(data.type!=null?data.type:new VoidType())
}
const Label_ArrayExpression:slang_check_visitor=(ast:ArrayExpression,scope,call)=>{
    for(const i of ast.elements)
        call(i,3)
    let type:Type=new VoidType()
    for(const i of ast.elements)
        type=type_merge(type,i.type,scope)
    ast.type=new ArrayType(type)
    if(ast.elements.length>0){
        const first=ast.elements[0]
        for(const i of ast.elements)
            if(!type_(i.type,first.type,scope)&&!type_(first.type,i.type,scope))
                scope.thr(`数组元素的类型不一致在行${(ast.line??[]).join('\n')}`)
    }
}
const Label_MapExpression:slang_check_visitor=(ast:MapExpression,scope,call)=>{
    for(const i of ast.elements.values())
        call(i,3)
    let type:Type=new VoidType()
    for(const [,i] of ast.elements)
        type=type_merge(type,i.type,scope)
    ast.type=new MapType(type)
}
const Label_LambdaExpression:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    scope=scope.enter()
    for(const [k,v] of ast.generic)
        scope.set_generic(k,v)
    scope.set('return',ast.ret)
    for(const v of ast.generic.values())call(v,3,scope)
    for(const [k,v] of ast.params){
        call(v,3,scope)
        const param=new VarDecl(k,v,null)
        param.type=real_type(v,scope)
        scope.set(k,param)
    }
    call(ast.body,3,scope)
    call(ast.ret,3,scope)
    ast.type=new LambdaType(ast.generic,ast.params,ast.ret)
    scope=scope.leave()
}
const Label_Literal:slang_check_visitor=(ast:Literal,scope,call)=>{
    if(ast instanceof NumberLiteral)ast.type=new NumberType()
    if(ast instanceof StringLiteral)ast.type=new StringType()
    if(ast instanceof BooleanLiteral)ast.type=new BooleanType()
    if(ast instanceof NullLiteral)ast.type=new VoidType()
}
export default new Map<any,slang_check_visitor>([
    [Literal,Label_Literal],
    [IdentifierExpr,Label_IdentifierExpression],
    [ArrayExpression,Label_ArrayExpression],
    [MapExpression,Label_MapExpression],
    [LambdaExpression,Label_LambdaExpression],
    [MinusPrefix,Label_MinusPrefix],
    [ReferencePrefix,Label_ReferencePrefix],
    [AddressPrefix,Label_AddressPrefix],
    [BitNotPrefix,Label_BitNotPrefix],
    [NotPrefix,Label_NotPrefix],
    [TypePrefix,Label_TypePrefix],
    [NewPrefix,Label_NewPrefix],
    [ArgumentsPostfix,Label_ArgumentsPostfix],
    [IndexPostfix,Label_IndexPostfix],
    [MemberPostfix,Label_MemberPostfix],
    [TernaryExpression,Label_TernaryExpression],
    [BinaryExpression,Label_BinaryExpression]
])