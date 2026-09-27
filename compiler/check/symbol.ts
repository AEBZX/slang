//round:符号表构建和相关检查
import {
    Function,
    Link,
    File,
    Module,
    BlockType,
    Class,
    Interface,
    Enum,
    Value,
    ClassType,
    Operation,
    Cast,
    Variable, VarDeclaration, VoidType, ListCommand, Assign, Call, Throw, Return, Increment, Decrement, IfStatement,
    WhileStatement, DoWhileStatement, SwitchStatement, TryStatement, ForStatement, ForeachStatement, GenericType,
    LambdaType, EnumType, LambdaExpression, PostfixExpression, ArgumentsPostfix, Expression, MapExpression,
    ArrayExpression, IndexPostfix, PrefixExpression, TypePrefix, BinaryExpression, TernaryExpression, ASTTree
} from '../utils'
import {build_chain, check_implement, name, resolve_named, slang_check_visitor} from './tool'
//round1:Build不做任何检查,搭建全局static符号表
const Build_File:slang_check_visitor=(ast:File, scope, call)=>{
    for(let i of ast.children)
        call(i,1,scope)
}
const Build_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    let name=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    let module=scope.get(name)
    if(module!=null&&module!==ast&&module instanceof Module){
        module.children=[...module.children,...ast.children]
        scope.set(name,module)
    }
    scope.set(name,ast)
    scope.global.set(name,ast)
    scope=scope.enter()
    scope.path=name
    for(let i of ast.children)
        call(i,1,scope)
    scope=scope.leave()
}
const Build_ClassOrInterface: slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    let name=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    scope.global.set(name,ast)
    scope=scope.enter()
    //嵌套类路径必须是 A.B,path 只在子作用域设置
    scope.path=name
    if(ast instanceof Class||ast instanceof Interface)
        scope.operation_cast_oper=new ClassType(name.split('.'),Array.from(ast.generic.values()))
    for(let i of ast.children)
        call(i,1,scope)
    scope=scope.leave()
}
const Build_Enum:slang_check_visitor=(ast:Enum,scope,call)=>{
    let name=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    scope.global.set(name,ast)
}
const Build_Value:slang_check_visitor=(ast:Value,scope,call)=>{
    scope=scope.enter()
    scope.operation_cast_oper=ast.value
    for(let i of ast.children)
        call(i,1,scope)
    scope=scope.leave()
}
const Build_Operation:slang_check_visitor=(ast:Operation,scope,call)=>{
    scope.global.set_operation(scope.operation_cast_oper,ast)
}
const Build_Cast:slang_check_visitor=(ast:Cast,scope,call)=>{
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
    for(let i of ast.links){
        if(!scope.global.get(i.module.join('.')))
            scope.thr(`link的模块${i.module.join('.')}不存在,在行${i.line.join('\n')}`)
        scope.set(i.as,scope.global.get(i.module.join('.')))
    }
    for(let i of ast.children)
        call(i,2,scope)
    scope=scope.leave()
}
const Verify_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    scope=scope.enter()
    let full=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    scope.path=full
    let module=scope.get(ast.name)
    if(module!=null&&module!==ast){
        if(!(module instanceof Module))scope.thr(`重复定义了${ast.name},在行${ast.line.join('\n')}`)
        else ast.children.push(...(<Module>module).children)
    }
    //裸名与全路径都注册
    scope.set(ast.name,ast)
    scope.set(full,ast)
    scope.set('up',new ASTTree())
    for(let i of ast.children)
        call(i,2,scope)
    scope=scope.leave()
}
const Verify_ClassOrInterface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    let full=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    if(name(full,scope,ast))
        scope.thr(`类/接口${ast.name}不能重名,在行${ast.line.join('\n')}`)
    //implement检查,并填充实现链到root.chain
    if(ast.implement instanceof ClassType){
        build_chain(scope,full,ast)
        call(ast.implement,2,scope)
        let implement=resolve_named(scope,ast.implement.local.join('.'))
        if(!(implement instanceof Interface))
            scope.thr(`implement的类型${ast.implement.local.join('.')}不是Interface,在行${ast.line.join('\n')}`)
    }
    //generic implement且是否是Interface的是否存在
    for(let i of ast.generic.values()){
        call(i,2,scope)
        check_implement(i,scope,ast.line)
    }
    if(new Set(ast.generic.keys()).size!=ast.generic.size)
        scope.thr(`泛型重复定义,在行${ast.line.join('\n')}`)
    scope=scope.enter()
    scope.path=full
    for(let [k,i] of ast.generic)
        scope.set_generic(k,i)
    scope.set('this',new ASTTree())
    scope.set('up',new ASTTree())
    for(let i of ast.children)
        call(i,2,scope)
    scope=scope.leave()
}
const Verify_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    let full=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    if(name(full,scope,ast,true)){
        let fn=scope.global.get(full)
        if(!(fn instanceof Function))
            scope.thr(`函数${ast.name}不能重名,在行${ast.line.join('\n')}`)
    }
    //重载注册
    scope.global.set_overload(full,ast)
    scope.set_overload(ast.name,ast)
    scope.set(ast.name,ast)
    scope=scope.enter()
    scope.path=full
    //generic implement且是否是Interface的是否存在
    for(let i of ast.generic.values()){
        call(i,2,scope)
        check_implement(i,scope,ast.line)
    }
    if(new Set(ast.generic.keys()).size!=ast.generic.size)
        scope.thr(`泛型重复定义,在行${ast.line.join('\n')}`)
    for(let [name,i] of ast.generic)
        scope.set_generic(name,i)
    for(let [name,i] of ast.params){
        call(i,2,scope)
        scope.set(name,new VarDeclaration(name,i,new VoidType()))
    }
    call(ast.return_type,2,scope)
    call(ast.commands,2,scope)
    scope=scope.leave()
}
const Verify_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    let full=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    if(name(full,scope,ast))
        scope.thr(`变量${ast.name}不能重名,在行${ast.line.join('\n')}`)
    scope.set(ast.name,ast)
    call(ast.t,2,scope)
    call(ast.value,2,scope)
}
const Verify_Value:slang_check_visitor=(ast:Value,scope,call)=>{
    ast.children.forEach(i=>call(i,2,scope))
}
const Verify_Operation:slang_check_visitor=(ast:Operation,scope,call)=>{
    call(ast.command,2,scope)
}
const Verify_Cast:slang_check_visitor=(ast:Cast,scope,call)=>{
    call(ast.t,2,scope)
    call(ast.command,2,scope)
}
const Verify_ListCommand:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    scope=scope.enter()
    ast.commands.forEach(i=>call(i,2,scope))
    scope=scope.leave()
}
const Verify_Assign:slang_check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,2,scope)
    call(ast.value,2,scope)
}
const Verify_VarDeclaration:slang_check_visitor=(ast:VarDeclaration,scope,call)=>{
    scope.set(ast.name,ast)
    call(ast.t,2,scope)
    call(ast.value,2,scope)
}
const Verify_ReturnOrThrowOrCallOrIncrementOrDecrement:slang_check_visitor=(ast:Call|Throw|Return|Increment|Decrement,scope,call)=>{
    call(ast.data,2,scope)
    if(ast instanceof Call){
        const data=ast.data
        if(!(data instanceof PostfixExpression)||
            !(data.postfix[data.postfix.length-1] instanceof ArgumentsPostfix))
            scope.thr(`call的data不是函数调用,在行${ast.line.join('\n')}`)
    }
}
const Verify_If:slang_check_visitor=(ast:IfStatement,scope,call)=>{
    call(ast.condition,2,scope)
    call(ast.commands,2,scope)
    call(ast.else_,2,scope)
}
const Verify_WhileOrDoWhile:slang_check_visitor=(ast:WhileStatement|DoWhileStatement,scope,call)=>{
    call(ast.condition,2,scope)
    call(ast.commands,2,scope)
}
const Verify_Switch:slang_check_visitor=(ast:SwitchStatement,scope,call)=>{
    call(ast.condition,2,scope)
    ast.case_list.forEach(i=>{
        call(i.condition,2,scope)
        call(i.commands,2,scope)
    })
    call(ast.default_,2,scope)
}
const Verify_Try:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    call(ast.commands,2,scope)
    call(ast.catch_.type,2,scope)
    scope.set(ast.catch_.iden,new VarDeclaration(ast.catch_.iden,ast.catch_.type,null))
    call(ast.catch_.command,2,scope)
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
    scope.set(ast.iden,new VarDeclaration(ast.iden,null,null))
    call(ast.commands,2,scope)
    scope=scope.leave()
}
const Verify_ClassType:slang_check_visitor=(ast:ClassType,scope,call)=>{
    //按当前路径解析,模块内声明的接口也能被 resolve 到
    const data=resolve_named(scope,ast.local.join('.'))
    if(data==null||!(data instanceof Interface||data instanceof Class)){
        scope.thr(`类/接口${ast.local.join('.')}不是Class或Interface,在行${ast.line.join('\n')}`)
        return
    }
    if(ast.generic.length!=data.generic.size)
        scope.thr(`泛型声明不匹配,在行${ast.line.join('\n')}`)
}
const Verify_LambdaType:slang_check_visitor=(ast:LambdaType,scope,call)=>{
    if(new Set(ast.generic.keys()).size!=ast.generic.size)
        scope.thr(`泛型重复声明,在行${ast.line.join('\n')}`)
    for(let i of ast.generic.values()){
        call(i,2,scope)
        check_implement(i,scope,ast.line)
    }
    if(new Set(ast.params.keys()).size!=ast.params.size)
        scope.thr(`参数重复声明,在行${ast.line.join('\n')}`)
    for(let i of ast.params.values())
        call(i,2,scope)
    call(ast.returnType,2,scope)
}
const Verify_BlockType:slang_check_visitor=(ast:BlockType,scope,call)=>{
    if(!scope.get(ast.local.join('.')))
        scope.thr(`${ast.local.join('.')}不存在,在行${ast.line.join('\n')}`)
}
const Verify_EnumType:slang_check_visitor=(ast:EnumType,scope,call)=>{
    //EnumType 只有 local,没有 value;只校验名称指向枚举
    let data=scope.get(ast.local.join('.'))
    if(data==null||!(data instanceof Enum))
        scope.thr(`${ast.local.join('.')}不存在或不是枚举,在行${ast.line.join('\n')}`)
}
const Verify_GenericType:slang_check_visitor=(ast:GenericType,scope,call)=>{
    if(!scope.get_generic(ast.generic))
        scope.thr(`泛型${ast.generic}不存在,在行${ast.line.join('\n')}`)
}
const Verify_LambdaExpression:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    scope=scope.enter()
    if(new Set(ast.params.keys()).size!=ast.params.size)
        scope.thr(`参数重复声明,在行${ast.line.join('\n')}`)
    for(let i of ast.params.values())
        call(i,2,scope)
    for(let [i,j] of ast.params)
        scope.set(i,new VarDeclaration(i,j,null))
    //generic implement且是否是Interface的是否存在
    for(let i of ast.generic.values()){
        call(i,2,scope)
        check_implement(i,scope,ast.line)
    }
    if(new Set(ast.generic.keys()).size!=ast.generic.size)
        scope.thr(`泛型重复定义,在行${ast.line.join('\n')}`)
    call(ast.body,2,scope)
    call(ast.ret,2,scope)
    scope=scope.leave()
}
const Verify_MapExpressionOrArrayExpression:slang_check_visitor=(ast:MapExpression|ArrayExpression,scope,call)=>{
    ast.elements.forEach(i=>call(i,2,scope))
}
const Verify_PostfixExpression:slang_check_visitor=(ast:PostfixExpression,scope,call)=> {
    call(ast.expr,2,scope)
    for(let i of ast.postfix){
        if(i instanceof ArgumentsPostfix){
            i.generic.forEach(j=>call(j,2,scope))
            i.args.forEach(j=>call(j,2,scope))
        }
        if(i instanceof IndexPostfix)
            call(i.index,2,scope)
    }
}
const Verify_PrefixExpression:slang_check_visitor=(ast:PrefixExpression,scope,call)=> {
    for(let i of ast.prefix)
        if(i instanceof TypePrefix)
            call(i.type,2,scope)
    call(ast.expr,2,scope)
}
const Verify_BinaryExpression:slang_check_visitor=(ast:BinaryExpression,scope,call)=> {
    call(ast.left,2,scope)
    call(ast.right,2,scope)
}
const Verify_TernaryExpression:slang_check_visitor=(ast:TernaryExpression,scope,call)=> {
    call(ast.condition,2,scope)
    call(ast.trueExpr,2,scope)
    call(ast.falseExpr,2,scope)
}
export const Round2=new Map<any,slang_check_visitor>([
    [File,Verify_File],
    [Module,Verify_Module],
    [Class,Verify_ClassOrInterface],
    [Interface,Verify_ClassOrInterface],
    [Enum,Verify_Value],
    [Value,Verify_Value],
    [Operation,Verify_Operation],
    [Cast,Verify_Cast],
    [Function,Verify_Function],
    [Variable,Verify_Variable],
    [ListCommand,Verify_ListCommand],
    [Assign,Verify_Assign],
    [VarDeclaration,Verify_VarDeclaration],
    [Call,Verify_ReturnOrThrowOrCallOrIncrementOrDecrement],
    [Throw,Verify_ReturnOrThrowOrCallOrIncrementOrDecrement],
    [Return,Verify_ReturnOrThrowOrCallOrIncrementOrDecrement],
    [Increment,Verify_ReturnOrThrowOrCallOrIncrementOrDecrement],
    [Decrement,Verify_ReturnOrThrowOrCallOrIncrementOrDecrement],
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
])