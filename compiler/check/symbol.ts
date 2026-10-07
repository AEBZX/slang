//round:符号表构建和相关检查
import {
    ArgumentsPostfix,
    ArrayExpression,
    Assign,
    ASTTree,
    Await,
    BinaryExpression,
    BlockType,
    BooleanType,
    Cast,
    Class,
    ClassType,
    DoWhileStatement,
    Enum,
    EnumType,
    ExprCommand,
    Expression,
    File,
    ForeachStatement,
    ForStatement,
    Function,
    GenericType,
    IfStatement,
    IndexPostfix,
    Interface,
    LambdaExpression,
    LambdaType,
    ListCommand,
    MapExpression,
    Module,
    NullLiteral,
    NumberType,
    Operation,
    PostfixExpression,
    PrefixExpression,
    Return,
    StringType,
    SwitchStatement,
    TernaryExpression,
    Throw,
    TryStatement,
    TypePrefix,
    Value,
    VarDecl,
    Variable,
    WhileStatement
} from '../utils'
import {build_chain, name, resolve_named, slang_check_visitor, verify_generics} from './tool'
//round1:Build不做任何检查,搭建全局static符号表
const Build_File:slang_check_visitor=(ast:File, scope, call)=>{
    for(const i of ast.children)
        call(i,1)
}
const Build_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    const name=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    const module=scope.get(name)
    if(module!=null&&module!==ast&&module instanceof Module){
        //同名模块合并:children 收编进先注册的块,注册表始终指向它,新块只构建增量
        module.children.push(...ast.children)
        scope.set(name,module)
        scope.global.set(name,module)
        scope=scope.enter()
        scope.path=name
        for(const i of ast.children)
            call(i,1,scope)
        scope=scope.leave()
        return
    }
    scope.set(name,ast)
    scope.global.set(name,ast)
    scope=scope.enter()
    scope.path=name
    for(const i of ast.children)
        call(i,1,scope)
    scope=scope.leave()
}
const Build_ClassOrInterface: slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    const name=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    scope.global.set(name,ast)
    scope=scope.enter()
    scope.path=name
    if(ast instanceof Class||ast instanceof Interface)
        scope.operation_cast_oper=new ClassType(name.split('.'),Array.from(ast.generic.values()))
    for(const i of ast.children)
        call(i,1,scope)
    scope=scope.leave()
}
const Build_Enum:slang_check_visitor=(ast:Enum,scope,call)=>{
    const name=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    scope.global.set(name,ast)
}
const Build_Value:slang_check_visitor=(ast:Value,scope,call)=>{
    scope=scope.enter()
    scope.operation_cast_oper=ast.value
    scope.path=ast.value instanceof NumberType?'number':
        ast.value instanceof StringType?'string':
            ast.value instanceof BooleanType?'boolean':null
    for(let i of ast.children)
        call(i,1,scope)
    scope=scope.leave()
}
const Build_Operation:slang_check_visitor=(ast:Operation,scope,call)=>{
    ast.local=scope.path.split('.')
    scope.global.set_operation(scope.operation_cast_oper,ast)
}
const Build_Cast:slang_check_visitor=(ast:Cast,scope,call)=>{
    ast.local=scope.path.split('.')
    scope.global.set_cast(scope.operation_cast_oper,ast)
}
const Build_Function:slang_check_visitor=(ast:Function, scope, call)=>{
    let name=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    if(!ast.modifiers.unstatic&&!ast.modifiers._private){
        scope.global.set(name,ast)
        scope.global.set_overload(name,ast)
    }
}
const Build_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    let name=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    if(!ast.modifiers.unstatic&&!ast.modifiers._private)
        scope.global.set(name,ast)
}
export const Round1=new Map<any,slang_check_visitor>([
    [File,Build_File],
    [Module,Build_Module],
    [Class,Build_ClassOrInterface],
    [Interface,Build_ClassOrInterface],
    [Enum,Build_Enum],
    [Value,Build_Value],
    [Operation,Build_Operation],
    [Cast,Build_Cast],
    [Function,Build_Function],
    [Variable,Build_Variable]
])
//round2:Verify检查重名,不存在名称等
const Verify_File:slang_check_visitor=(ast:File,scope,call)=>{
    scope=scope.enter()
    //links检查
    for(const i of ast.links){
        if(!scope.global.get(i.module.join('.')))
            scope.thr(`link的模块${i.module.join('.')}不存在,在行${i.line.join('\n')}`)
        scope.set(i.as,scope.global.get(i.module.join('.')))
    }
    for(const i of ast.children)
        call(i,2,scope)
    scope=scope.leave()
}
const Verify_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    scope=scope.enter()
    const full=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    scope.path=full
    const module=scope.get(ast.name)??scope.get(full)
    if(module!=null&&module!==ast){
        //同名模块:符号表指向先注册的块,children 在它的那一轮已访问过,这里只对齐注册
        if(!(module instanceof Module))scope.thr(`重复定义了${ast.name},在行${ast.line.join('\n')}`)
        else{
            scope.set(ast.name,module)
            scope.set(full,module)
        }
        scope=scope.leave()
        return
    }
    //裸名与全路径都注册
    scope.set(ast.name,ast)
    scope.set(full,ast)
    scope.set('up',new ASTTree())
    for(const i of ast.children)
        call(i,2,scope)
    scope=scope.leave()
}
const Verify_Enum:slang_check_visitor=(ast:Enum,scope,call)=>{
    const full=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    if(name(full,scope,ast))
        scope.thr(`枚举${ast.name}不能重名,在行${ast.line.join('\n')}`)
    scope.set(ast.name,ast)
    scope.set(full,ast)
    if(ast.children.length!=new Set(ast.children).size)
        scope.thr(`枚举${ast.name}有重复的成员,在行${ast.line.join('\n')}`)
}
const Verify_ClassOrInterface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    const full=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    if(name(full,scope,ast))
        scope.thr(`类/接口${ast.name}不能重名,在行${ast.line.join('\n')}`)
    if(ast.implement instanceof ClassType){
        build_chain(scope,full,ast)
        call(ast.implement,2)
        const implement=resolve_named(scope,ast.implement.local.join('.'))
        if(!(implement instanceof Interface))
            scope.thr(`implement的类型${ast.implement.local.join('.')}不是Interface,在行${ast.line.join('\n')}`)
    }
    //generic implement且是否是Interface的是否存在
    verify_generics(ast,scope,call)
    scope=scope.enter()
    scope.path=full
    for(const [k,i] of ast.generic)
        scope.set_generic(k,i)
    scope.set('this',new ASTTree())
    scope.set('up',new ASTTree())
    for(const i of ast.children)
        call(i,2,scope)
    scope=scope.leave()
}
const Verify_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    const full=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    if(name(full,scope,ast,true)){
        const fn=scope.global.get(full)
        if(!(fn instanceof Function))
            scope.thr(`函数${ast.name}不能重名,在行${ast.line.join('\n')}`)
    }
    //重载注册:全路径组给 LambdaType 的名字解析用,裸名组给同作用域直接调用用
    scope.global.set_overload(full,ast)
    if(!ast.modifiers.unstatic){
        scope.global.set(ast.name,ast)
        scope.global.set(full,ast)
    }
    scope.set_overload(ast.name,ast)
    scope.set(ast.name,ast)
    scope.set(full,ast)
    scope=scope.enter()
    scope.path=full
    //generic implement且是否是Interface的是否存在
    verify_generics(ast,scope,call)
    for(const [name,i] of ast.generic)
        scope.set_generic(name,i)
    for(const [name,i] of ast.params){
        call(i,2,scope)
        scope.set(name,new VarDecl(name,i,new NullLiteral(null)))
    }
    call(ast.return_type,2,scope)
    call(ast.commands,2,scope)
    scope=scope.leave()
}
const Verify_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    const full=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    if(name(full,scope,ast))
        scope.thr(`变量${ast.name}不能重名,在行${ast.line.join('\n')}`)
    if(!ast.modifiers.unstatic)
        scope.global.set(full,ast)
    scope.set(ast.name,ast)
    scope.set(full,ast)
    call(ast.t,2,scope)
    call(ast.value,2,scope)
}
const Verify_Value:slang_check_visitor=(ast:Value,scope,call)=>{
    ast.children.forEach(i=>call(i,2))
}
const Verify_Operation:slang_check_visitor=(ast:Operation,scope,call)=>{
    call(ast.command,2)
}
const Verify_Cast:slang_check_visitor=(ast:Cast,scope,call)=>{
    call(ast.t,2)
    call(ast.command,2)
}
const Verify_Await:slang_check_visitor=(ast:Await,scope,call)=>{
    call(ast.command,2)
}
const Verify_ListCommand:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    scope=scope.enter()
    ast.commands.forEach(i=>call(i,2,scope))
    scope=scope.leave()
}
const Verify_Assign:slang_check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,2)
    call(ast.value,2)
}
const Verify_VarDecl:slang_check_visitor=(ast:VarDecl,scope,call)=>{
    scope.set(ast.name,ast)
    call(ast.t,2)
    call(ast.value,2)
}
const Verify_ReturnOrThrowOrExprCommand:slang_check_visitor=(ast:ExprCommand|Throw|Return,scope,call)=>{
    call(ast.data,2)
}
const Verify_If:slang_check_visitor=(ast:IfStatement,scope,call)=>{
    call(ast.condition,2)
    call(ast.commands,2)
    call(ast.else_,2)
}
const Verify_WhileOrDoWhile:slang_check_visitor=(ast:WhileStatement|DoWhileStatement,scope,call)=>{
    call(ast.condition,2)
    call(ast.commands,2)
}
const Verify_Switch:slang_check_visitor=(ast:SwitchStatement,scope,call)=>{
    call(ast.condition,2)
    ast.case_list.forEach(i=>{
        call(i.condition,2)
        call(i.commands,2)
    })
    call(ast.default_,2)
}
const Verify_Try:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    call(ast.commands,2)
    call(ast.catch_.type,2)
    scope.set(ast.catch_.iden,new VarDecl(ast.catch_.iden,ast.catch_.type,null))
    call(ast.catch_.command,2)
    call(ast.finally_,2)
}
const Verify_For:slang_check_visitor=(ast:ForStatement,scope,call)=>{
    scope=scope.enter()
    ast.init.forEach(i=>call(i,2,scope))
    call(ast.condition,2,scope)
    call(ast.commands,2,scope)
    ast.step.forEach(i=>call(i,2,scope))
    scope=scope.leave()
}
const Verify_Foreach:slang_check_visitor=(ast:ForeachStatement,scope,call)=>{
    scope=scope.enter()
    call(ast.data,2,scope)
    scope.set(ast.iden,new VarDecl(ast.iden,null,null))
    call(ast.commands,2,scope)
    scope=scope.leave()
}
const Verify_ClassType:slang_check_visitor=(ast:ClassType,scope,call)=>{
    //按当前路径解析,模块内声明的接口也能被 resolve 到;枚举作类型标注同样合法
    const data=resolve_named(scope,ast.local.join('.'))
    if(data==null||!(data instanceof Interface||data instanceof Class||data instanceof Enum)){
        scope.thr(`类/接口${ast.local.join('.')}不是Class或Interface,在行${ast.line.join('\n')}`)
        return
    }
    //枚举没有泛型;泛型数量只在类/接口上校验
    if(!(data instanceof Enum)&&ast.generic.length!=data.generic.size)
        scope.thr(`泛型声明不匹配,在行${ast.line.join('\n')}`)
}
const Verify_LambdaType:slang_check_visitor=(ast:LambdaType,scope,call)=>{
    verify_generics(ast,scope,call)
    for(const i of ast.params.values())
        call(i,2)
    call(ast.returnType,2)
}
const Verify_BlockType:slang_check_visitor=(ast:BlockType,scope,call)=>{
    if(!scope.get(ast.local.join('.')))
        scope.thr(`${ast.local.join('.')}不存在,在行${ast.line.join('\n')}`)
}
const Verify_EnumType:slang_check_visitor=(ast:EnumType,scope,call)=>{
    const data=scope.get(ast.local.join('.'))
    if(data==null||!(data instanceof Enum))
        scope.thr(`${ast.local.join('.')}不存在或不是枚举,在行${ast.line.join('\n')}`)
}
const Verify_GenericType:slang_check_visitor=(ast:GenericType,scope,call)=>{
    if(!scope.get_generic(ast.generic))
        scope.thr(`泛型${ast.generic}不存在,在行${ast.line.join('\n')}`)
}
const Verify_LambdaExpression:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    scope=scope.enter()
    for(const [k,v] of ast.generic)
        scope.set_generic(k,v)
    if(new Set(ast.params.keys()).size!=ast.params.size)
        scope.thr(`参数重复声明,在行${ast.line.join('\n')}`)
    for(const i of ast.params.values())
        call(i,2,scope)
    for(const [i,j] of ast.params)
        scope.set(i,new VarDecl(i,j,null))
    //generic implement且是否是Interface的是否存在
    verify_generics(ast,scope,call)
    call(ast.body,2,scope)
    call(ast.ret,2,scope)
    scope=scope.leave()
}
const Verify_MapExpressionOrArrayExpression:slang_check_visitor=(ast:MapExpression|ArrayExpression,scope,call)=>{
    ast.elements.forEach((i:Expression)=>call(i,2,scope))
}
const Verify_PostfixExpression:slang_check_visitor=(ast:PostfixExpression,scope,call)=> {
    call(ast.expr, 2)
    if (ast instanceof ArgumentsPostfix)
        for (const i of ast.args)
            call(i, 2)
    if(ast instanceof IndexPostfix)
        call(ast.index,2)
}
const Verify_PrefixExpression:slang_check_visitor=(ast:PrefixExpression,scope,call)=> {
    if(ast instanceof TypePrefix)
        call(ast.type,2)
    call(ast.expr,2)
}
const Verify_BinaryExpression:slang_check_visitor=(ast:BinaryExpression,scope,call)=> {
    call(ast.left,2)
    call(ast.right,2)
}
const Verify_TernaryExpression:slang_check_visitor=(ast:TernaryExpression,scope,call)=> {
    call(ast.condition,2)
    call(ast.trueExpr,2)
    call(ast.falseExpr,2)
}
export const Round2=new Map<any,slang_check_visitor>([
    [File,Verify_File],
    [Module,Verify_Module],
    [Class,Verify_ClassOrInterface],
    [Interface,Verify_ClassOrInterface],
    [Enum,Verify_Enum],
    [Value,Verify_Value],
    [Operation,Verify_Operation],
    [Cast,Verify_Cast],
    [Function,Verify_Function],
    [Variable,Verify_Variable],
    [ListCommand,Verify_ListCommand],
    [Assign,Verify_Assign],
    [VarDecl,Verify_VarDecl],
    [ExprCommand,Verify_ReturnOrThrowOrExprCommand],
    [Throw,Verify_ReturnOrThrowOrExprCommand],
    [Return,Verify_ReturnOrThrowOrExprCommand],
    [IfStatement,Verify_If],
    [WhileStatement,Verify_WhileOrDoWhile],
    [DoWhileStatement,Verify_WhileOrDoWhile],
    [SwitchStatement,Verify_Switch],
    [TryStatement,Verify_Try],
    [ForStatement,Verify_For],
    [ForeachStatement,Verify_Foreach],
    [LambdaType,Verify_LambdaType],
    [BlockType,Verify_BlockType],
    [EnumType,Verify_EnumType],
    [ClassType,Verify_ClassType],
    [GenericType,Verify_GenericType],
    [LambdaExpression,Verify_LambdaExpression],
    [MapExpression,Verify_MapExpressionOrArrayExpression],
    [ArrayExpression,Verify_MapExpressionOrArrayExpression],
    [PostfixExpression,Verify_PostfixExpression],
    [PrefixExpression,Verify_PrefixExpression],
    [BinaryExpression,Verify_BinaryExpression],
    [TernaryExpression,Verify_TernaryExpression],
    [Await,Verify_Await]
])