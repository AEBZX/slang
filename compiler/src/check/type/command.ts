import {
    ArrayType,
    Assign,
    Await,
    BooleanType, Delete, DoWhileStatement,
    ExprCommand, ForeachStatement, ForStatement, IfStatement, ListCommand,
    NumberType,
    ReferenceType,
    Return, SwitchStatement, Throw, TryStatement,
    VarDecl, VM,
    VoidType, WhileStatement
} from '../../utils'
import {
    cast_get,
    fast_cast,
    fast_operation,
    operation_get,
    slang_check_visitor,
    to_right,
    try_bool,
    type_is, type_sub
} from '../tool'
const Type_Assign:slang_check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,3,scope)
    call(ast.value,3,scope)
    //先看有没有重载
    const operation=operation_get(scope,ast,ast.oper,ast.data.type,ast.value.type)
    if(operation!=null){
        ast.oper=operation.global_local.join('.')+'.operation@'+operation.index
        return
    }
    //常规情况
    if(!(ast.data.type instanceof ReferenceType))
        scope.thr('赋值左边不是合法左值',ast)
    if(ast.op=='='&&!(type_is(ast.data.type,ast.value.type,scope) instanceof VoidType))
        return
    if(['&&=','&=','||=','|='].includes(ast.op)&&to_right(ast.data.type) instanceof BooleanType&&to_right(ast.value.type) instanceof BooleanType)
        return
    //只剩下关于number的运算
    if(to_right(ast.data.type) instanceof NumberType&&to_right(ast.value.type) instanceof NumberType)
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
        if (!(to_right(ast.data.type) instanceof NumberType && to_right(cast.type) instanceof NumberType)){
            scope.thr('两者第一没有重载,第二类型不匹配，第三类型转换不了',ast)
            return
        }
        ast.value.cast=cast.global_local.join('.')+'.cast@'+cast.id
        ast.type=cast.type
        return
    }
    scope.thr('两者第一没有重载,第二类型不匹配，第三类型转换不了',ast)
}
const Type_VarDecl:slang_check_visitor=(ast:VarDecl,scope,call)=>{
    call(ast.t,3,scope)
    scope.set(ast.name,ast.t instanceof ReferenceType?ast.t:new ReferenceType(ast.t))
    //引用类型必须赋值
    if(ast.t instanceof ReferenceType&&ast.value==null)
        scope.thr('引用类型必须初始化',ast)
    if(ast.value)call(ast.value,3,scope)
    if(!(ast.t instanceof ReferenceType)){
        //无初始化器:仅声明,无 '=' 重载决议
        if(ast.value==null)return
        //如果不是引用,那么就可以进行重载决议和cast决议
        //=的参数基础上在加一个滚木number就是初始化'='
        const operation=operation_get(scope,ast,'=',ast.t,ast.value.type||new VoidType(),new NumberType())
        if(operation!=null){
            ast.t=operation.type
            ast.oper=operation.global_local.join('.')+'.operation@'+operation.index
            return
        }
        //如果类型匹配就可以不管
        if(ast.value.type&&type_sub(ast.value.type,ast.t,scope))return
        //尝试转换
        if(!fast_cast(scope,ast,ast.value,ast.t))scope.thr('变量声明类型不匹配',ast)
        return
    }
    if(ast.value&&!(ast.value.type instanceof ReferenceType))
        scope.thr('引用类型的初始化必须是左值',ast)
}
const Type_Await:slang_check_visitor=(ast:Await,scope,call)=>{
    call(ast.command,3,scope)
}
const Type_ExprCommand:slang_check_visitor=(ast:ExprCommand,scope,call)=>{
    call(ast.data,3,scope)
}
const Type_Delete:slang_check_visitor=(ast:Delete,scope,call)=>{
    call(ast.expr,3,scope)
    if(!(ast.expr.type instanceof ReferenceType))
        scope.thr('不能删除右值',ast)
}
const Type_Return:slang_check_visitor=(ast:Return,scope,call)=>{
    call(ast.data,3,scope)
    if(ast.data==null){
        if(scope.ret instanceof VoidType)
            return
        scope.thr('函数返回值不是void但是你用了空return',ast)
        return
    }
    if(ast.data.type&&type_sub(ast.data.type,scope.ret,scope))
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
    call(ast.data,3,scope)
}
const Type_VM:slang_check_visitor=(ast:VM,scope,call)=>{
    for(const param of ast.param)
        call(param,3,scope)
}
const Type_If:slang_check_visitor=(ast:IfStatement,scope,call)=>{
    call(ast.condition,3,scope)
    call(ast.commands,3,scope)
    call(ast.else_,3,scope)
    try_bool(scope,ast.condition)
}
const Type_While_DoWhile:slang_check_visitor=(ast:WhileStatement|DoWhileStatement,scope,call)=>{
    call(ast.condition,3,scope)
    call(ast.commands,3,scope)
    try_bool(scope,ast.condition)
}
const Type_For:slang_check_visitor=(ast:ForStatement,scope,call)=>{
    scope=scope.enter()
    for(const init of ast.init)
        call(init,3,scope)
    call(ast.condition,3,scope)
    for(const step of ast.step)
        call(step,3,scope)
    call(ast.commands,3,scope)
    try_bool(scope,ast.condition)
    scope=scope.leave()
}
const Type_Foreach:slang_check_visitor=(ast:ForeachStatement,scope,call)=>{
    call(ast.data,3,scope)
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
    call(ast.commands,3,scope)
    scope=scope.leave()
}
const Type_Switch:slang_check_visitor=(ast:SwitchStatement,scope,call)=>{
    call(ast.condition,3,scope)
    for(const case_ of ast.case_list){
        call(case_.condition,3,scope);
        //检查两个是否是同一类型
        (()=>{
            if(!(type_is(ast.condition.type,case_.condition.type,scope) instanceof VoidType))
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
        call(case_.commands,3,scope)
    }
    call(ast.default_,3,scope)
}
const Type_Try:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    call(ast.commands,3,scope)
    scope=scope.enter()
    scope.set(ast.catch_.iden,ast.catch_.type)
    call(ast.catch_.command,3,scope)
    scope=scope.leave()
    call(ast.finally_,3,scope)
}
const Type_List:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    scope=scope.enter()
    for(const item of ast.commands)
        call(item,3,scope)
    scope=scope.leave()
}
export default new Map<any,slang_check_visitor>([
    [Assign,Type_Assign],
    [VarDecl,Type_VarDecl],
    [Await,Type_Await],
    [ExprCommand,Type_ExprCommand],
    [Return,Type_Return],
    [Throw,Type_Throw],
    [VM,Type_VM],
    [Delete,Type_Delete],
    [IfStatement,Type_If],
    [WhileStatement,Type_While_DoWhile],
    [DoWhileStatement,Type_While_DoWhile],
    [ForStatement,Type_For],
    [ForeachStatement,Type_Foreach],
    [SwitchStatement,Type_Switch],
    [TryStatement,Type_Try],
    [ListCommand,Type_List]
])