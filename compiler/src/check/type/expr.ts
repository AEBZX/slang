import {
    block_get,
    cast_get,
    generic_type_real,
    operation_get,
    param_best,
    param_check,
    slang_check_visitor,
    type_is
} from '../tool'
import {
    ArgumentsPostfix,
    ArrayExpression,
    ArrayType, BlockType, Class, ClassType, DecrementPostfix,
    IdentifierExpr, IncrementPostfix, IndexPostfix, LambdaExpression, LambdaType, MemberPostfix,
    NullLiteral,
    NumberLiteral,
    NumberType,
    ReferenceType,
    StringLiteral, Type,
    VoidType
} from '../../utils'

const Type_Number:slang_check_visitor=(ast:NumberLiteral,scope,call)=>{
    //语言特性,数字类型带小数点是number[],这样浮点数就可以让用户自己搞了
    if(ast.value.includes('.')){
        ast.type=new ArrayType(new NumberType())
        return
    }
    ast.type=new NumberType()
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
    ast.type=new ReferenceType(scope.get(ast.name).type)
}
const Type_Array:slang_check_visitor=(ast:ArrayExpression,scope,call)=>{
    for(const item of ast.elements)
        call(item,3)
    let type:Type=new VoidType()
    //求最小超类型作为数组的类型
    for(const item of ast.elements)
        type=type_is(type,item.type,scope)
    ast.type=new ArrayType(type)
}
const Type_Lambda:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    for(const generic of ast.generic.values())
        call(generic,3)
    for(const param of ast.params.values())
        call(param,3)
    scope=scope.enter()
    for(const [name,type] of ast.generic)
        scope.set_generic(name,type)
    for(const [name,type] of ast.params)
        scope.set(name,type)
    scope.ret=ast.ret
    call(ast.body,3)
    call(ast.ret,3)
    scope=scope.leave()
    ast.type=new LambdaType(ast.generic,ast.params,ast.ret)
}
const Type_Inc_Dec:slang_check_visitor=(ast:IncrementPostfix|DecrementPostfix,scope,call)=>{
    call(ast.expr,3)
    //先看重载,postfix++的operation要加空气number
    const operation=operation_get(scope,ast,ast.oper,new VoidType(),ast.expr.type,new NumberType())
    if(operation!=null){
        ast.type=operation.type
        ast.expr.oper=operation.global_local.join('.')+'.'+operation.index
        return
    }
    if(ast.expr.type instanceof NumberType){
        ast.type=new NumberType()
        return
    }
    //转换
    const cast=cast_get(scope,ast,ast.expr.type,new NumberType())
    if(cast!=null){
        ast.type=new NumberType()
        ast.expr.cast=cast.global_local.join('.')+'.'+cast.id
        return
    }
    scope.thr('不是number,也没后置++/--重载,还没转换',ast)
}
const Type_Member:slang_check_visitor=(ast:MemberPostfix,scope,call)=>{
    call(ast.expr,3)
    if(ast.expr.type instanceof BlockType||ast.expr.type instanceof ClassType){
        ast.type=block_get(ast.expr.type._this,true,
            ast.expr.type.local.join('.'),ast.name,
            (ast.type instanceof ClassType?ast.type.generic:[]),scope)
        return
    }
    scope.thr('不是类或者模块,而且后缀查无此物',ast)
}
const Type_Index:slang_check_visitor=(ast:IndexPostfix,scope,call)=>{
    call(ast.expr,3)
    call(ast.index,3)
    const operation=operation_get(scope,ast,'[]',new VoidType(),ast.expr.type,ast.expr.type,ast.index.type)
    if(operation!=null){
        ast.type=operation.type
        ast.expr.oper=operation.global_local.join('.')+'.'+operation.index
        return
    }
    if(ast.expr.type instanceof ArrayType&&ast.expr.type instanceof NumberType){
        ast.type=ast.expr.type.t
        return
    }
    if(ast.expr.type instanceof ArrayType){
        const cast=cast_get(scope,ast,ast.index.type,new NumberType())
        if(cast!=null){
            ast.type=ast.expr.type.t
            ast.index.cast=cast.global_local.join('.')+'.'+cast.id
            return
        }
    }
    if(ast.index.type instanceof NumberType){
        const cast=cast_get(scope,ast,ast.expr.type,new ArrayType(new VoidType()))
        if(cast!=null){
            ast.type=(cast.type as ArrayType).t
            ast.expr.cast=cast.global_local.join('.')+'.'+cast.id
            return
        }
    }
    const cast1=cast_get(scope,ast,ast.expr.type,new ArrayType(new VoidType()))
    const cast2=cast_get(scope,ast,ast.index.type,new NumberType())
    if(cast1!=null&&cast2!=null){
        ast.type=(cast1.type as ArrayType).t
        ast.expr.cast=cast1.global_local.join('.')+'.'+cast1.id
        ast.index.cast=cast2.global_local.join('.')+'.'+cast2.id
        return
    }
    scope.thr('不能当作array[number],[]重载不存在,而且类型转换失败',ast)
}
const Type_Arguments:slang_check_visitor=(ast:ArgumentsPostfix,scope,call)=>{
    call(ast.expr,3)
    for(const item of ast.generic)
        call(item,3)
    for(const item of ast.args)
        call(item,3)
    const operation=operation_get(scope,ast,'()',new VoidType(),
        ast.expr.type,...ast.args.map(item=>item.type))
    if(operation!=null){
        ast.type=operation.type
        ast.expr.oper=operation.global_local.join('.')+'.'+operation.index
        return
    }
    //是不是lambda_type
    if(ast.expr.type instanceof LambdaType){
        //没有overload,直接检查
        if(!ast.expr.type.overload){
            const type=param_check(Array.from(ast.expr.type.params.values()),ast.args,
                ast.expr.type.generic,ast.generic,ast.expr.type.returnType,scope)
            if(type==null){
                scope.thr('参数类型不匹配',ast)
                return
            }
            ast.type=type
            return
        }
        //需要重载决议
        //已经决议过
        if(ast.expr.type.name.includes('@')){
            ast.type=ast.expr.type.returnType
            return
        }
        const functions=scope.overload_get(ast.expr.type.name)
            .filter(item=>param_check(Array.from(item.params.values()),ast.args,item.generic,ast.generic,item.return_type,scope)!=null)
        //具体性决策
            .filter(item=>{
                for(const i of functions){
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
    const cast=cast_get(scope,ast,ast.expr.type,new LambdaType(new Map(),new Map(),new VoidType()))
}