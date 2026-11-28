import {
    type_view,
    param_best,
    param_check,
    slang_check_visitor, symbol_do_generic, to_right,
    type_is, type_sub, fast_operation, fast_cast, cast_get
} from '../tool'
import {
    AddressPrefix,
    ArgumentsPostfix,
    ArrayExpression,
    ArrayType,
    BinaryExpression, BitNotPrefix, BlockType,
    BooleanLiteral, BooleanType, Class, ClassType, DecrementPostfix, DecrementPrefix,
    IdentifierExpr, IncrementPostfix, IncrementPrefix, IndexPostfix, LambdaExpression, LambdaType, MemberPostfix,
    MinusPrefix, NewPrefix,
    NotPrefix,
    NullLiteral,
    NumberLiteral,
    NumberType, PointType, ReferencePrefix,
    ReferenceType,
    StringLiteral, TernaryExpression, Type, TypePrefix,
    VoidType, convert, Function
} from '../../utils'

const Type_Number:slang_check_visitor=(ast:NumberLiteral,scope,call)=>{
    const data=convert(ast.value)
    if(typeof data=='string'){
        ast.type=new NumberType()
        return
    }
    ast.type=new ArrayType(new ArrayType(new NumberType()))
}
const Type_Boolean:slang_check_visitor=(ast:BooleanLiteral,scope,call)=>{
    ast.type=new BooleanType()
}
const Type_String:slang_check_visitor=(ast:StringLiteral,scope,call)=>{
    //如果只有一个元素当成char也就是一个number
    if(ast.value.length<=1){
        ast.type=new NumberType()
        return
    }
    ast.type=new ArrayType(new NumberType())
}
const Type_Null:slang_check_visitor=(ast:NullLiteral,scope,call)=>{
    ast.type=new VoidType()
}
const Type_Identifier:slang_check_visitor=(ast:IdentifierExpr,scope,call)=>{
    ast.type=new ReferenceType(scope.get(ast.name),'identifier')
}
const Type_Array:slang_check_visitor=(ast:ArrayExpression,scope,call)=>{
    for(const item of ast.elements)
        call(item,3,scope)
    let type:Type=new VoidType()
    //求最小超类型作为数组的类型
    for(const item of ast.elements)
        type=type_is(type,item.type,scope)
    ast.type=new ArrayType(type)
}
const Type_Lambda:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    for(const generic of ast.generic.values())
        call(generic,3,scope)
    for(const param of ast.params.values())
        call(param,3,scope)
    scope=scope.enter()
    for(const [name,type] of ast.generic)
        scope.set_generic(name,type)
    for(const [name,type] of ast.params)
        scope.set(name,type)
    scope.ret=ast.ret
    call(ast.body,3,scope)
    call(ast.ret,3,scope)
    scope=scope.leave()
    ast.type=new LambdaType(ast.generic,ast.params,ast.ret)
}
const Type_Inc_Dec:slang_check_visitor=(ast:IncrementPostfix|DecrementPostfix,scope,call)=>{
    call(ast.expr,3,scope)
    ast.type=new VoidType()
    //先看重载,postfix++的operation要加空气number
    if(fast_operation(scope,ast,ast instanceof IncrementPostfix?'++':'--',new NumberType(),ast.expr))
        return
    ast.type=new NumberType()
    if(ast.expr.type instanceof ReferenceType&&ast.expr.type.t instanceof NumberType)
        return
    if(fast_cast(scope,ast.expr,ast.expr.type,new NumberType()))
        return
    scope.thr('++/--只能应用于左值number类型,或者应用到重载',ast)
}
const Type_Member:slang_check_visitor=(ast:MemberPostfix,scope,call)=>{
    call(ast.expr,3,scope)
    ast.type=new VoidType()
    const block_type=type_view(ast.expr.type)
    if(!(block_type instanceof ClassType||block_type instanceof BlockType)){
        scope.thr('不是类或者模块,不可进行.运算',ast)
        return
    }
    if(block_type instanceof ClassType||block_type instanceof BlockType){
        if(!block_type.field.map(i=>i.name==ast.name).includes(true)) {
            scope.thr('找不到字段'+ast.name,ast)
            return
        }
        if(ast.expr.type instanceof ReferenceType)
            ast.type=new ReferenceType(block_type.field.find(i=>i.name==ast.name).type)
        else
            ast.type=block_type.field.find(i=>i.name==ast.name).type
    }
}
const Type_Index:slang_check_visitor=(ast:IndexPostfix,scope,call)=> {
    call(ast.expr, 3)
    call(ast.index, 3)
    ast.type=new VoidType()
    if (fast_operation(scope,ast,'[]',ast.expr.type,ast.index))
        return
    if (ast.expr.type instanceof ArrayType && ast.index.type instanceof NumberType) {
        ast.type = new ReferenceType(ast.expr.type.t, 'identifier')
        return
    }
    const cast_expr=fast_cast(scope,ast,ast.expr.type,new ArrayType(new VoidType()))
    const cast_index=fast_cast(scope,ast,ast.index.type,new NumberType())
    if(cast_expr&&cast_index)
        return
    scope.thr('不能当作array[number],[]重载不存在,而且类型转换失败',ast)
}
const Type_Arguments:slang_check_visitor=(ast:ArgumentsPostfix,scope,call)=>{
    call(ast.expr,3,scope)
    ast.expr.type=new VoidType()
    for(const item of ast.generic)
        call(item,3,scope)
    for(const item of ast.args)
        call(item,3,scope)
    //是不是lambda_type
    const expr_type=type_view(ast.expr.type)
    //new A()这种容易炸
    if(fast_operation(scope,ast,'()',ast.expr.type,...ast.args)&&!scope.in_new)
        return
    if(expr_type instanceof LambdaType){
        //是否是overload(是不是函数,不是函数当lambda变量)
        if(!expr_type.overload){
            //是否相容
            const ok=param_check(ast,expr_type.params,ast.args.map(i=>i.type),expr_type.generic,ast.generic,scope)
            if(ok){
                ast.type=expr_type.returnType
                return
            }
            scope.thr('参数或者泛型不相容',ast)
            return
        }
        //重载情况下ast.expr一定是BlockType/ClassType,先拿到field
        const field= (<BlockType | ClassType>type_view(ast.expr.type)).field
            .filter(i=>i.name==expr_type.name)
            .filter(i=>i instanceof Function)
            .filter(i=>param_check(ast,i.params,ast.args.map(i=>i.type),expr_type.generic,ast.generic,scope))
        if(field.length==0)
            scope.thr('匹配的函数不存在',ast)
        //具体性决策
        let result:Function=null
        for(const item of field){
            if(result==null){
                result=item
                continue
            }
            if(param_best(Array.from(result.params.values()),ast.args.map(i=>i.type),scope))continue
            if(param_best(Array.from(item.generic.values()),ast.generic,scope))continue
            result=item
        }
        ast.type=result.return_type
        ast.call_target=result.name+'@'+result.index
        return
    }
    //是BlockType同时也是类或者接口,等价于调用构造
    if(expr_type instanceof BlockType&&scope.in_new){
        const block=scope.get(expr_type.local.join('.'))
        if(block instanceof Class){
            //泛型匹配
            const ok=param_check(ast,block.generic,ast.generic,block.generic,ast.generic,scope)
            if(!ok)
                scope.thr('泛型不相容',ast)
            //参数匹配
            const constructor=expr_type.field.filter(i=>i instanceof Function)
                .filter(i=>i.name=='constructor')
                .filter(i=>param_check(ast,i.params,ast.args.map(i=>i.type),i.generic,ast.generic,scope))
                .filter(i=>{
                    for(const item of constructor){
                        if(item==i)continue
                        if(param_best(Array.from(item.params.values()),ast.args.map(i=>i.type),scope))continue
                        if(param_best(Array.from(item.generic.values()),ast.generic,scope))continue
                        return true
                    }
                })
            if(constructor.length==0)
                scope.thr('构造函数不存在',ast)
            ast.type=new ClassType(block.global_local,block.children.filter(i=>i.modifiers.unstatic)
                .filter(i=>!i.modifiers._private))
            return
        }
        scope.thr('不是类',ast)
    }
}
const Type_PreInc_Dec:slang_check_visitor=(ast:IncrementPrefix|DecrementPrefix,scope,call)=>{
    call(ast.expr,3,scope)
    ast.type=new VoidType()
    //先看重载,prefix++直接填
    if(fast_operation(scope,ast,ast instanceof IncrementPrefix?'++':'--',ast.expr.type))
        return
    if(ast.expr.type instanceof NumberType){
        ast.type=new NumberType()
        return
    }
    //转换
    if(fast_cast(scope,ast,ast.expr,new NumberType()))
        return
    scope.thr('不是number,也没前置++/--重载,还没转换',ast)
}
const Type_Not:slang_check_visitor=(ast:NotPrefix,scope,call)=>{
    call(ast.expr,3,scope)
    ast.type=new VoidType()
    if(fast_operation(scope,ast,'!',ast.expr.type))
        return
    if(ast.expr.type instanceof BooleanType){
        ast.type=new BooleanType()
        return
    }
    //转换
    if(fast_cast(scope,ast,ast.expr,new BooleanType()))
        return
    scope.thr('不是boolean,也没!重载,还没转换',ast)
}
const Type_BitNot:slang_check_visitor=(ast:BitNotPrefix,scope,call)=>{
    call(ast.expr,3,scope)
    ast.type=new VoidType()
    if(fast_operation(scope,ast,'~',ast.expr.type))
        return
    if(ast.expr.type instanceof NumberType){
        ast.type=new NumberType()
        return
    }
    //转换
    if(fast_cast(scope,ast,ast.expr,new NumberType()))
        return
    scope.thr('不是number,也没~重载,还没转换',ast)
}
const Type_Minus:slang_check_visitor=(ast:MinusPrefix,scope,call)=>{
    call(ast.expr,3,scope)
    ast.type=new VoidType()
    if(fast_operation(scope,ast,'-',ast.expr.type))
        return
    if(ast.expr.type instanceof NumberType){
        ast.type=new NumberType()
        return
    }
    //转换
    if(fast_cast(scope,ast,ast.expr,new NumberType()))
        return
    scope.thr('不是number,也没-重载,还没转换',ast)
}
const Type_Reference:slang_check_visitor=(ast:ReferencePrefix,scope,call)=>{
    call(ast.expr,3,scope)
    ast.type=new VoidType()
    if(fast_operation(scope,ast,'*',ast.expr.type))
        return
    if(type_view(ast.expr.type) instanceof PointType){
        ast.type=new ReferenceType((type_view(ast.expr.type) as PointType).t)
        return
    }
    //转换
    if(fast_cast(scope,ast,ast.expr.type,new PointType(new VoidType())))
        return
    scope.thr('不是指针不能重载,而且类型转换失败',ast)
}
const Type_Point:slang_check_visitor=(ast:AddressPrefix,scope,call)=>{
    call(ast.expr,3,scope)
    ast.type=new VoidType()
    if(fast_operation(scope,ast,'&',ast.expr.type))
        return
    if(ast.expr.type instanceof ReferenceType){
        ast.type=new PointType(ast.expr.type.t)
        return
    }
    //转换
    if(fast_cast(scope,ast,ast.expr.type,new ReferenceType(new VoidType())))
        return
    scope.thr('不是引用不能重载,而且类型转换失败',ast)
}
const Type_Type:slang_check_visitor=(ast:TypePrefix,scope,call)=>{
    call(ast.expr,3,scope)
    ast.type=ast.t
    if(fast_cast(scope,ast,ast.expr,ast.t))return
    scope.thr('你没有定义强转的类型的cast',ast)
}
const Type_New:slang_check_visitor=(ast:NewPrefix,scope,call)=>{
    if(fast_operation(scope,ast,'new',new VoidType(),ast.expr))return
    const in_new=scope.in_new
    scope.in_new=true
    call(ast.expr,3,scope)
    scope.in_new=in_new
    if(!(ast.expr instanceof ArgumentsPostfix))
        scope.thr('不是函数',ast)
}
const Type_Binary:slang_check_visitor=(ast:BinaryExpression,scope,call)=>{
    call(ast.left,3,scope)
    call(ast.right,3,scope)
    const fo = fast_operation(scope,ast,ast.op,new VoidType(),ast.left,ast.right)
    if(fo)
        return
    if(['|','&','==','<','>','&&','||','^'].includes(ast.op)&&ast.left.type instanceof BooleanType&&ast.right.type instanceof BooleanType){
        ast.type=new BooleanType()
        return
    }
    if(ast.left.type instanceof NumberType&&ast.right.type instanceof NumberType){
        ast.type=new NumberType()
        return
    }
    if(['|','&','==','<','>','&&','||','^'].includes(ast.op))
        if(fast_cast(scope,ast,ast.left,new BooleanType())&&fast_cast(scope,ast,ast.right,new BooleanType())){
            ast.type=new BooleanType()
            return
        }
    if(fast_cast(scope,ast,ast.left,new NumberType())&&fast_cast(scope,ast,ast.right,new NumberType())){
        ast.type=new NumberType()
        return
    }
    scope.thr('没有重载,而且类型转换失败',ast)
}
const Type_Ternary:slang_check_visitor=(ast:TernaryExpression,scope,call)=>{
    call(ast.condition,3,scope)
    call(ast.trueExpr,3,scope)
    call(ast.falseExpr,3,scope)
    if(!(type_is(ast.trueExpr,ast.falseExpr,scope) instanceof VoidType)){
        ast.type=type_is(ast.trueExpr,ast.falseExpr,scope)
        return
    }
    //Ternary不做强转
    scope.thr('类型不匹配',ast)
}
export default new Map<any,slang_check_visitor>([
    [ArrayExpression,Type_Array],
    [LambdaExpression,Type_Lambda],
    [NumberLiteral,Type_Number],
    [StringLiteral,Type_String],
    [BooleanLiteral,Type_Boolean],
    [NullLiteral,Type_Null],
    [IdentifierExpr,Type_Identifier],
    [IncrementPostfix,Type_Inc_Dec],
    [DecrementPostfix,Type_Inc_Dec],
    [MemberPostfix,Type_Member],
    [IndexPostfix,Type_Index],
    [ArgumentsPostfix,Type_Arguments],
    [IncrementPrefix,Type_PreInc_Dec],
    [DecrementPrefix,Type_PreInc_Dec],
    [NotPrefix,Type_Not],
    [BitNotPrefix,Type_BitNot],
    [MinusPrefix,Type_Minus],
    [ReferencePrefix,Type_Reference],
    [AddressPrefix,Type_Point],
    [TypePrefix,Type_Type],
    [NewPrefix,Type_New],
    [BinaryExpression,Type_Binary],
    [TernaryExpression,Type_Ternary],
])