import {
    ArrayType,
    Assign,
    Await,
    BooleanType, DoWhileStatement,
    ExprCommand, ForeachStatement, ForStatement, IfStatement, ListCommand,
    NumberType,
    ReferenceType,
    Return, SwitchStatement, Throw, TryStatement,
    VarDecl, VM,
    VoidType, WhileStatement
} from '../../utils'
import {cast_get, operation_get, slang_check_visitor, to_right, try_bool, type_is} from '../tool'
const Type_Assign:slang_check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,3)
    call(ast.value,3)
    //先看有没有重载
    const operation=operation_get(scope,ast,ast.oper,ast.data,ast.value)
    if(operation!=null){
        ast.oper=operation.global_local.join('.')+'.'+operation.index
        return
    }
    //常规情况
    if(!(ast.data.type instanceof ReferenceType))
        scope.thr('赋值左边不是合法左值',ast)
    if(ast.op=='='&&!(type_is(ast.data,ast.value,scope) instanceof VoidType))
        return
    if(['&&=','&=','||=','|='].includes(ast.op)&&ast.data.type instanceof BooleanType&&ast.value.type instanceof BooleanType)
        return
    //只剩下关于number的运算
    if(ast.data.type instanceof NumberType&&ast.value.type instanceof NumberType)
        return
    //尝试转换
    const cast=cast_get(scope,ast,ast.value.type,ast.data.type)
    if (cast != null) {
        if (ast.op != '=') {
            scope.thr('两者第一没有重载,第二类型不匹配，第三类型转换不了',ast)
            return
        }
        if (!(['&&=', '&=', '||=', '|='].includes(ast.op)
            && ast.data.type instanceof BooleanType
            && ast.value.type instanceof BooleanType)){
            scope.thr('两者第一没有重载,第二类型不匹配，第三类型转换不了',ast)
            return
        }
        if (!(ast.data.type instanceof NumberType && cast.type instanceof NumberType)){
            scope.thr('两者第一没有重载,第二类型不匹配，第三类型转换不了',ast)
            return
        }
        ast.value.cast=cast.global_local.join('.')+'.'+cast.id
        ast.type=cast.type
        return
    }
    scope.thr('两者第一没有重载,第二类型不匹配，第三类型转换不了',ast)
}
const Type_VarDecl:slang_check_visitor=(ast:VarDecl,scope,call)=>{
    call(ast.t,3)
    call(ast.value,3)
    if(ast.t instanceof ReferenceType&&!(ast.value.type instanceof ReferenceType))
        scope.thr('引用类型变量的初始化值必须是左值',ast)
    if(type_is(ast.t,ast.value.type,scope) instanceof VoidType)
        scope.thr('初始化时右值类型和声明类型不匹配',ast)
}
const Type_Await:slang_check_visitor=(ast:Await,scope,call)=>{
    call(ast.command,3)
}
const Type_ExprCommand:slang_check_visitor=(ast:ExprCommand,scope,call)=>{
    call(ast.data,3)
}
const Type_Return:slang_check_visitor=(ast:Return,scope,call)=>{
    call(ast.data,3)
    if(ast.data==null){
        if(scope.ret instanceof VoidType)
            return
        scope.thr('函数返回值不是void但是你用了空return',ast)
        return
    }
    if(type_is(scope.ret,ast.data.type,scope)==scope.ret)
        return
    const cast=cast_get(scope,ast,ast.data.type,scope.ret)
    if(cast!=null){
        ast.data.cast=cast.global_local.join('.')+'.'+cast.id
        ast.data.type=cast.type
        return
    }
    scope.thr('函数返回值类型不匹配',ast)
}
const Type_Throw:slang_check_visitor=(ast:Throw,scope,call)=>{
    call(ast.data,3)
}
const Type_VM:slang_check_visitor=(ast:VM,scope,call)=>{
    for(const param of ast.param)
        call(param,3)
}
const Type_If:slang_check_visitor=(ast:IfStatement,scope,call)=>{
    call(ast.condition,3)
    call(ast.commands,3)
    call(ast.else_,3)
    try_bool(scope,ast.condition)
}
const Type_While_DoWhile:slang_check_visitor=(ast:WhileStatement|DoWhileStatement,scope,call)=>{
    call(ast.condition,3)
    call(ast.commands,3)
    try_bool(scope,ast.condition)
}
const Type_For:slang_check_visitor=(ast:ForStatement,scope,call)=>{
    scope=scope.enter()
    for(const init of ast.init)
        call(init,3)
    call(ast.condition,3)
    for(const step of ast.step)
        call(step,3)
    call(ast.commands,3)
    try_bool(scope,ast.condition)
    scope=scope.leave()
}
const Type_Foreach:slang_check_visitor=(ast:ForeachStatement,scope,call)=>{
    call(ast.data,3)
    scope=scope.enter();
    //类型推断:ast.data是array返回内部元素否则尝试强转
    (()=>{
        //是否重载
        const operation=operation_get(scope,ast,ast.iden,ast.data,new ArrayType(new VoidType()))
        if(operation!=null){
            ast.iden_type=(operation.type as ArrayType).t
            ast.data.type=operation.type
            ast.data.oper=operation.global_local.join('.')+'.'+operation.index
            return
        }
        if(to_right(ast.data.type) instanceof ArrayType){
            ast.iden_type=(to_right(ast.data.type) as ArrayType).t
            return
        }
        //尝试强转
        const cast=cast_get(scope,ast,ast.data.type,new ArrayType(new VoidType()))
        if(cast!=null){
            ast.data.cast=cast.global_local.join('.')+'.'+cast.id
            ast.data.type=cast.type
            ast.iden_type=(cast.type as ArrayType).t
            return
        }
        scope.thr('foreach的data类型不是数组也不能强转成数组,也没有重载:',ast)
    })()
    scope.set(ast.iden,ast.iden_type)
    call(ast.commands,3)
    scope=scope.leave()
}
const Type_Switch:slang_check_visitor=(ast:SwitchStatement,scope,call)=>{
    call(ast.condition,3)
    for(const case_ of ast.case_list){
        call(case_.condition,3);
        //检查两个是否是同一类型
        (()=>{
            if(!(type_is(ast.condition,case_.condition,scope) instanceof VoidType))
                return
            //尝试强转
            const cast=cast_get(scope,ast,case_.condition.type,ast.condition.type)
            if(cast!=null){
                case_.condition.cast=cast.global_local.join('.')+'.'+cast.id
                case_.condition.type=cast.type
                return
            }
            scope.thr('case的条件类型不匹配',case_.condition)
        })()
        call(case_.commands,3)
    }
    call(ast.default_,3)
}
const Type_Try:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    call(ast.commands,3)
    scope=scope.enter()
    scope.set(ast.catch_.iden,ast.catch_.type)
    call(ast.catch_.command,3)
    scope=scope.leave()
    call(ast.finally_,3)
}
const Type_List:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    scope=scope.enter()
    for(const item of ast.commands)
        call(item,3)
    scope=scope.leave()
}