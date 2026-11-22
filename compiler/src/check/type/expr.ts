import {
    block_get,
    cast_get, de_ref, fast_cast, fast_operation, type_view,
    generic_type_real,
    operation_get,
    param_best,
    param_check,
    slang_check_visitor, symbol_do_generic, try_bool,
    type_is, type_sub
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
    VoidType,convert
} from '../../utils'

const Type_Number:slang_check_visitor=(ast:NumberLiteral,scope,call)=>{
    const data=convert(ast.value)
    if(typeof ast.value=='string'){
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
    //先看重载,postfix++的operation要加空气number
    if(fast_operation(scope,ast,ast instanceof IncrementPostfix?'++':'--',new VoidType(),ast.expr,new NumberType()))
        return
    if(ast.expr.type instanceof NumberType){
        ast.type=new NumberType()
        return
    }
    //转换
    if(fast_cast(scope,ast,ast.expr,new NumberType()))
        return
    scope.thr('不是number,也没后置++/--重载,还没转换',ast)
}
const Type_Member:slang_check_visitor=(ast:MemberPostfix,scope,call)=>{
    call(ast.expr,3,scope)
    //这种情况下如果不是类或者模块,那么注册的就是类型在.type就是null,所以可以这样
    const block_type=type_view(ast.expr.type)
    if(block_type instanceof BlockType||block_type instanceof ClassType){
        ast.type=block_get(
            block_type._this,
            block_type instanceof BlockType,
            block_type.local.join('.'),
            ast.name,
            (block_type instanceof ClassType?block_type.generic:[]),
            scope
        )
        return
    }
    scope.thr('不是类或者模块,而且后缀查无此物',ast)
}
const Type_Index:slang_check_visitor=(ast:IndexPostfix,scope,call)=> {
    call(ast.expr, 3)
    call(ast.index, 3)
    if (fast_operation(scope, ast, '[]', new VoidType(), ast.expr, ast.index))
        return
    if (ast.expr.type instanceof ArrayType && ast.index.type instanceof NumberType) {
        ast.type = new ReferenceType(ast.expr.type.t, 'identifier')
        return
    }
    if (ast.expr.type instanceof ArrayType && fast_cast(scope, ast, ast.index, new NumberType())) {
        ast.type = new ReferenceType(ast.expr.type.t, 'identifier')
        return
    }
    if (ast.index.type instanceof NumberType && fast_cast(scope, ast, ast.expr, new ArrayType(new VoidType()))){
        ast.type=new ReferenceType(cast_get(scope,ast,ast.expr.type,new ArrayType(new VoidType())).t,'identifier')
        return
    }
    if(fast_cast(scope,ast,ast.expr,new ArrayType(new VoidType()))&&fast_cast(scope,ast,ast.index,new NumberType()))
        return
    scope.thr('不能当作array[number],[]重载不存在,而且类型转换失败',ast)
}
const Type_Arguments:slang_check_visitor=(ast:ArgumentsPostfix,scope,call)=>{
    call(ast.expr,3,scope)
    for(const item of ast.generic)
        call(item,3,scope)
    for(const item of ast.args)
        call(item,3,scope)
    if(fast_operation(scope,ast,'()',new VoidType(),ast.expr,...ast.args))
        return
    //是不是lambda_type
    const expr_type=type_view(ast.expr.type)
    if(expr_type instanceof LambdaType){
        //实参节点取其类型(param_check 只吃类型)
        const arg_types=ast.args.map(a=>a.type)
        //没有overload,直接检查
        if(!expr_type.overload){
            const type=param_check(Array.from(expr_type.params.values()),arg_types,
                expr_type.generic,ast.generic,expr_type.returnType,scope)
            if(type==null){
                scope.thr('参数类型不匹配',ast)
                return
            }
            ast.type=type
            return
        }
        //需要重载决议
        //已经决议过
        if(expr_type.name.includes('@')){
            ast.type=expr_type.returnType
            return
        }
        const candidates=scope.overload_get(expr_type.name)
            .filter(item=>param_check(Array.from(item.params.values()),arg_types,item.generic,ast.generic,item.return_type,scope)!=null)
        //具体性决策
        const functions=candidates.filter(item=>{
            for(const i of candidates){
                if(i==item)continue
                if(param_best(Array.from(i.params.values()),Array.from(item.params.values()),scope))
                    return false
            }
            return true
        })
        if(functions.length==0)
            scope.thr('重载决议失败,没有符合条件的重载',ast)
        if(functions.length>1)
            scope.thr('重载决议失败,有多个符合条件的重载',ast)
        if(functions.length!=1)
            return
        const function_=functions[0]
        ast.call_target=function_.global_local.join('.')+'@'+function_.index
        let generic:Map<string,Type>=new Map()
        {
            let index=0
            for(const key of function_.generic.keys())
                generic.set(key,ast.generic[index++])
        }
        ast.type=generic_type_real(function_.return_type,generic,scope)
        return
    }
    //尝试cast重载
    if(fast_cast(scope,ast,ast.expr,new LambdaType(
        new Map(
            [...ast.generic.entries()].map(([i, v]) => [String(i), v] as const)
        ),new Map(
            [...ast.args.entries()].map(([i, v]) => [String(i), v] as const)
        ),new VoidType())))return
    scope.thr('不是lambda,而且重载不存在,而且类型转换失败',ast)
}
const Type_PreInc_Dec:slang_check_visitor=(ast:IncrementPrefix|DecrementPrefix,scope,call)=>{
    call(ast.expr,3,scope)
    //先看重载,prefix++直接填
    if(fast_operation(scope,ast,ast instanceof IncrementPrefix?'++':'--',new VoidType(),ast.expr))
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
    if(fast_operation(scope,ast,'!',new VoidType(),ast.expr))
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
    if(fast_operation(scope,ast,'~',new VoidType(),ast.expr))
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
    if(fast_operation(scope,ast,'-',new VoidType(),ast.expr))
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
    if(fast_operation(scope,ast,'*',new VoidType(),ast.expr))
        return
    if(ast.expr.type instanceof PointType){
        ast.type=new ReferenceType(ast.expr.type.t)
        return
    }
    //转换
    if(fast_cast(scope,ast,ast.expr,new PointType(new VoidType())))
        return
    scope.thr('不是指针不能重载,而且类型转换失败',ast)
}
const Type_Point:slang_check_visitor=(ast:AddressPrefix,scope,call)=>{
    call(ast.expr,3,scope)
    if(fast_operation(scope,ast,'&',new VoidType(),ast.expr))
        return
    if(ast.expr.type instanceof ReferenceType){
        ast.type=new PointType(ast.expr.type.t)
        return
    }
    //转换
    if(fast_cast(scope,ast,ast.expr,new ReferenceType(new VoidType())))
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
    //首先必须是Arguments,里面必须是ClassType,然后自动加.constructor检查
    if(!(ast.expr instanceof ArgumentsPostfix)){
        scope.thr('new后面得跟调用',ast)
        return
    }
    //不能直接调用不然会找不到函数
    call(ast.expr.expr,3,scope)
    const ast_type=de_ref(ast.expr.expr.type)
    if(!(ast_type instanceof BlockType)){
        scope.thr('new后面得跟类',ast)
        return
    }
    if(!(scope.get(ast_type.local.join('.')) instanceof Class))
        scope.thr('new后面得跟类',ast)
    ast.type=new ClassType(ast_type.local,ast.expr.generic)
    //检查泛型相容性
    const iden_generic=(scope.get(ast_type.local.join('.')) as Class).generic
    {
        let index=0
        for (const iden of iden_generic.values()) {
            if(!(type_sub(iden,ast.expr.generic[index],scope)))
                scope.thr('泛型不相容',ast)
            index++
        }
    }
    //把generic去了防止arg在报错
    ast.expr.generic=[]
    ast.expr.expr=new MemberPostfix(ast.expr.expr,'constructor')
    call(ast.expr.expr,3,scope)
}
const Type_Binary:slang_check_visitor=(ast:BinaryExpression,scope,call)=>{
    call(ast.left,3,scope)
    call(ast.right,3,scope)
    if(fast_operation(scope,ast,ast.op,new VoidType(),ast.left,ast.right))
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
    try_bool(scope,ast.condition)
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
    [IncrementPostfix,Type_PreInc_Dec],
    [DecrementPostfix,Type_PreInc_Dec],
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