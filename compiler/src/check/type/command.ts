import {
    ArrayExpression, ArrayType,
    Assign,
    Await, DoWhileStatement, ExprCommand, ForeachStatement, ForStatement,
    IdentifierExpr, IfStatement,
    IndexPostfix,
    ListCommand, MapType,
    MemberPostfix, NullLiteral,
    ReferencePrefix, Return, StringType, SwitchStatement,
    Throw, TryStatement, Type, VarDecl, VM, VoidType, WhileStatement
} from '../../utils'
import {cast, operation, real_type, slang_check_visitor, to_point, type_} from '../tool'
const Label_Await:slang_check_visitor=(ast:Await,scope,call)=>{
    call(ast.command,3)
}
const Label_ListCommand:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    scope=scope.enter()
    for(const i of ast.commands)
        call(i,3,scope)
    scope=scope.leave()
}
const Label_Assign:slang_check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,3)
    call(ast.value,3)
    let is_left=false
    if(ast.data instanceof ReferencePrefix||ast.data instanceof IdentifierExpr||ast.data instanceof IndexPostfix||
        ast.data instanceof MemberPostfix)
        is_left=true
    if(operation(ast.op,ast.data,scope,to_point(ast.data.type),to_point(ast.value.type)))return
    if(!is_left)scope.thr(`赋值的左侧不是可赋值的左值,在行${(ast.line??[]).join('\n')}`)
    if(type_(ast.value.type,ast.data.type,scope))return
    if(cast(ast,scope,ast.data.type))return
    scope.thr(`赋值类型错误在行${(ast.line??[]).join('\n')}`)
}
const Label_ThrowOrReturnOrExprCommand:slang_check_visitor=(ast:Throw|Return|ExprCommand,scope,call)=>{
    call(ast.data,3)
    if(ast instanceof Return&&!type_(ast.data==null?null:ast.data.type,scope.get('return'),scope))
        scope.thr(`返回类型错误在行${(ast.line??[]).join('\n')}`)
    if(ast instanceof Throw){
        const throw_type:Type=scope.get('throw')
        if(throw_type==null)
            scope.thr(`抛出异常没有try-catch在行${(ast.line??[]).join('\n')}`)
        else if(!type_(ast.data==null?null:ast.data.type,throw_type,scope))
            scope.thr(`抛出异常类型错误在行${(ast.line??[]).join('\n')}`)
    }
}
const Label_VarDecl:slang_check_visitor=(ast:VarDecl,scope,call)=>{
    call(ast.value,3)
    call(ast.t,3)
    ast.type=real_type(ast.t,scope)
    scope.set(ast.name,ast)
    if(ast.t instanceof VoidType)scope.thr(`变量${ast.name}声明类型为void,在行${(ast.line??[]).join('\n')}`)
    //数组字面量按元素逐个检查:type_ 对 ArrayType 只看"都是数组",
    //元素类型对不对是另一回事,这里补上
    if(ast.value instanceof ArrayExpression&&ast.type instanceof ArrayType){
        const elem=ast.type.t
        for(const i of ast.value.elements)
            if(!type_(i.type,elem,scope)&&!(i.type instanceof VoidType))
                scope.thr(`数组元素类型错误在行${(i.line??[]).join('\n')}`)
    }
    if(ast.value==null)return
    if(operation('=',ast,scope,to_point(ast.t),to_point(ast.value.type)))return
    if(type_(ast.value.type,ast.t,scope))return
    if(cast(ast,scope,ast.t))return
    scope.thr(`赋值类型错误在行${(ast.line??[]).join('\n')}`)
}
const Label_IfStatement:slang_check_visitor=(ast:IfStatement,scope,call)=>{
    call(ast.condition,3)
    scope=scope.enter()
    call(ast.commands,3,scope)
    scope=scope.leave()
    scope=scope.enter()
    call(ast.else_,3,scope)
    scope=scope.leave()
}
const Label_SwitchStatement:slang_check_visitor=(ast:SwitchStatement,scope,call)=>{
    call(ast.condition,3)
    for(const i of ast.case_list){
        call(i.condition,3)
        if(!type_(i.condition==null?null:i.condition.type,ast.condition.type,scope))
            scope.thr(`switch case的类型和switch的类型不一致,在行${(ast.line??[]).join('\n')}`)
        scope=scope.enter()
        call(i.commands,3,scope)
        scope=scope.leave()
    }
    scope=scope.enter()
    call(ast.default_,3,scope)
    scope=scope.leave()
}
const Label_WhileOrDoWhileStatement:slang_check_visitor=(ast:WhileStatement|DoWhileStatement,scope,call)=>{
    call(ast.condition,3)
    scope=scope.enter()
    call(ast.commands,3,scope)
    scope=scope.leave()
}
const Label_ForStatement:slang_check_visitor=(ast:ForStatement,scope,call)=>{
    scope=scope.enter()
    ast.init.forEach(i=>call(i,3,scope))
    call(ast.condition,3,scope)
    ast.step.forEach(i=>call(i,3,scope))
    call(ast.commands,3,scope)
    scope=scope.leave()
}
const Label_ForeachStatement:slang_check_visitor=(ast:ForeachStatement,scope,call)=>{
    scope=scope.enter()
    call(ast.data,3,scope)
    const type=real_type(ast.data==null?null:ast.data.type,scope)
    //元素类型能从容器类型直接拿到就以它为准,别让后面的 cast 覆盖成容器类型
    const elem=type instanceof MapType||type instanceof ArrayType?type.t:
        type instanceof StringType?new StringType():null
    const vd=new VarDecl(ast.iden,elem??new VoidType(),new NullLiteral(null))
    //标识符解析看的是 .type,VarDecl 构造只填了 .t,两个都要给
    vd.type=vd.t
    if(elem==null){
        cast(vd,scope,new ArrayType(new VoidType()))
        if(vd.t instanceof VoidType)cast(vd,scope,new MapType(new VoidType()))
    }
    scope.set(ast.iden,vd)
    ast.iden_type=vd.t
    call(ast.commands,3,scope)
    scope=scope.leave()
}
const Label_TryStatement:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    scope=scope.enter()
    call(ast.catch_.type,3,scope)
    scope.set('throw',real_type(ast.catch_.type,scope))
    call(ast.commands,3,scope)
    scope=scope.leave()
    scope=scope.enter()
    const ct=real_type(ast.catch_.type,scope)
    const cv=new VarDecl(ast.catch_.iden,ct,new NullLiteral(null))
    cv.type=ct
    scope.set(ast.catch_.iden,cv)
    call(ast.catch_.command,3,scope)
    scope=scope.leave()
    scope=scope.enter()
    call(ast.finally_,3,scope)
    scope=scope.leave()
}
const Label_VM:slang_check_visitor=(ast:VM,scope,call)=> {
    for (const i of ast.param)
        call(i, 3)
}
export default new Map<any,slang_check_visitor>([
    [Await, Label_Await],
    [ListCommand, Label_ListCommand],
    [Assign, Label_Assign],
    [Throw, Label_ThrowOrReturnOrExprCommand],
    [Return, Label_ThrowOrReturnOrExprCommand],
    [ExprCommand, Label_ThrowOrReturnOrExprCommand],
    [VarDecl, Label_VarDecl],
    [IfStatement, Label_IfStatement],
    [SwitchStatement, Label_SwitchStatement],
    [WhileStatement, Label_WhileOrDoWhileStatement],
    [DoWhileStatement, Label_WhileOrDoWhileStatement],
    [ForStatement, Label_ForStatement],
    [ForeachStatement, Label_ForeachStatement],
    [TryStatement, Label_TryStatement],
    [VM, Label_VM]
])