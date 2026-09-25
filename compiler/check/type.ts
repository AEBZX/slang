//round:类型检查
import {
    AddressPrefix,
    ArgumentsPostfix, ArrayExpression,
    Assign, BinaryExpression, BitNotPrefix,
    BlockType, BooleanType, Call,
    Class,
    ClassType, Decrement, DecrementPostfix, DecrementPrefix, DoWhileStatement,
    Enum, Expression,
    File, FixType, ForeachStatement, ForStatement,
    Function, IfStatement, Increment, IncrementPostfix, IncrementPrefix, IndexPostfix,
    Interface,
    LambdaType,
    ListCommand, MapExpression, MemberPostfix, MinusPrefix,
    Module, NewPrefix, NotPrefix, NullLiteral, NumberLiteral, NumberType, PointFix, PostfixExpression,
    PrefixExpression,
    ReferencePrefix, Return, SwitchStatement, TernaryExpression, Throw, TryStatement, Type, TypePrefix, VarDeclaration,
    Variable, VoidType, WhileStatement
} from '../utils'
import {
    each_oper,
    oper_best,
    oper_get_have, Operation_Binary, Operation_Postfix, Operation_Prefix, param_is,
    slang_check_visitor,
    to_point, type_merge
} from './tool'
//round3:类型标注
const Label_File:slang_check_visitor=(ast:File,scope,call)=>{
    scope=scope.enter()
    for(let i of ast.links)
        scope.set(i.as,scope.get(i.module.join('.')))
    for(let i of ast.children)
        call(i,3)
    scope=scope.leave()
}
const Label_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    scope=scope.enter()
    let name=scope.path==''?ast.name:scope.path+'.'+ast.name
    scope.path=name
    ast.type=new BlockType(name.split('.'))
    scope.set(ast.name,ast)
    for(let i of ast.children)
        call(i,3)
    scope=scope.leave()
}
const Label_ClassOrInterface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    let name=scope.path==''?ast.name:scope.path+'.'+ast.name
    scope.path=name
    ast.type=new BlockType(name.split('.'))
    scope.set(ast.name,ast)
    scope=scope.enter()
    for(let [k,v] of ast.generic)
        scope.set_generic(k,v)
    scope.set('this',new ClassType(name.split('.'),Array.from(ast.generic.values())))
    for(let i of ast.children)
        call(i,3)
    scope=scope.leave()
}
const Label_Enum:slang_check_visitor=(ast:Enum,scope,call)=>{
    let name=scope.path==''?ast.name:scope.path+'.'+ast.name
    scope.path=name
    ast.type=new BlockType(name.split('.'))
    scope.set(ast.name,ast)
}
const Label_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    scope.path=scope.path == '' ? ast.name : scope.path + '.' + ast.name
    scope.set(ast.name,ast)
    ast.type=new LambdaType(ast.generic,ast.params,ast.return_type,ast.modifiers._async)
    scope=scope.enter()
    for(let [k,v] of ast.generic)
        scope.set_generic(k,v)
    for(let [k,v] of ast.params)
        scope.set(k,v)
    call(ast.commands,3)
    scope=scope.leave()
}
const Label_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    scope.set(ast.name,ast)
    ast.type=ast.t
    call(ast.value,3)
}
const Label_ListCommand:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    for(let i of ast.commands)
        call(i,3)
}
const Label_Assign:slang_check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,3)
    call(ast.value,3)
}
const Label_ThrowOrReturnOrCallOrIncrementOrDecrement:slang_check_visitor=(ast:Throw|Return|Call|Increment|Decrement,scope,call)=>{
    call(ast.data,3)
}
const Label_VarDeclaration:slang_check_visitor=(ast:VarDeclaration,scope,call)=>{
    call(ast.value,3)
    ast.type=ast.t
    scope.set(ast.name,ast)
}
const Label_IncrementOrDecrement:slang_check_visitor=(ast:Increment|Decrement,scope,call)=>{
    call(ast.data,3)
}
const Label_IfStatement:slang_check_visitor=(ast:IfStatement,scope,call)=>{
    call(ast.condition,3)
    scope=scope.enter()
    call(ast.commands,3)
    scope=scope.leave()
    scope=scope.enter()
    call(ast.else_,3)
    scope=scope.leave()
}
const Label_SwitchStatement:slang_check_visitor=(ast:SwitchStatement,scope,call)=>{
    call(ast.condition,3)
    ast.case_list.forEach(i=>{
        call(i.condition,3)
        scope=scope.enter()
        call(i.commands,3)
        scope=scope.leave()
    })
    scope=scope.enter()
    call(ast.default_,3)
    scope=scope.leave()
}
const Label_WhileOrDoWhileStatement:slang_check_visitor=(ast:WhileStatement|DoWhileStatement,scope,call)=>{
    call(ast.condition,3)
    scope=scope.enter()
    call(ast.commands,3)
    scope=scope.leave()
}
const Label_ForStatement:slang_check_visitor=(ast:ForStatement,scope,call)=>{
    scope=scope.enter()
    ast.init.forEach(i=>call(i,3))
    call(ast.condition,3)
    ast.step.forEach(i=>call(i,3))
    call(ast.commands,3)
    scope=scope.leave()
}
const Label_ForeachStatement:slang_check_visitor=(ast:ForeachStatement,scope,call)=>{
    scope=scope.enter()
    call(ast.data,3)
    scope.set(ast.iden,new VarDeclaration(ast.iden,each_oper(scope,ast.data.type,[ArrayExpression,MapExpression]),new NullLiteral(null)))
    call(ast.commands,3)
    scope=scope.leave()
}
const Label_TryStatement:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    scope=scope.enter()
    call(ast.commands,3)
    scope=scope.leave()
    scope=scope.enter()
    scope.set(ast.catch_.iden,new VarDeclaration(ast.catch_.iden,ast.catch_.type,new NullLiteral(null)))
    call(ast.catch_.command,3)
    scope=scope.leave()
    scope=scope.enter()
    call(ast.finally_,3)
    scope=scope.leave()
}
const Label_TernaryExpression:slang_check_visitor=(ast:TernaryExpression,scope,call)=>{
    call(ast.condition,3)
    call(ast.trueExpr,3)
    call(ast.falseExpr,3)
    ast.type=ast.trueExpr.type
}
const Label_BinaryExpression:slang_check_visitor=(ast:BinaryExpression,scope,call)=>{
    call(ast.left,3)
    call(ast.right,3)
    let oper:string=''
    for(let [k,v] of Operation_Binary)
        if(ast instanceof k)oper=v
    let operation=oper_best(scope,oper,to_point(ast.left.type),to_point(ast.right.type))
    if(operation!=null){
        ast.type=operation[0].type
        return
    }
    ast.type=['+','-','*','/','&','|','^','>>','<<'].includes(oper)?new NumberType():new BooleanType()
}
const Label_PrefixExpression:slang_check_visitor=(ast:PrefixExpression,scope,call)=>{
    call(ast.expr,3)
    let type:Type=ast.expr.type
    for(let prefix of ast.prefix){
        let oper=''
        for(let [k,v] of Operation_Prefix)
            if(prefix instanceof k)oper=v
        let operation=oper_best(scope,oper,to_point(ast.expr))
        if(operation!=null){
            type=operation[0].type
            continue
        }
        if(prefix instanceof TypePrefix)type=prefix.type
        if(prefix instanceof NewPrefix){
            if(type!=ast.expr.type||!(ast.expr instanceof PostfixExpression&&
                ast.expr.postfix[ast.expr.postfix.length-1] instanceof ArgumentsPostfix))
                scope.thr(`除了重载new应该对调用使用`)
            let data=(<PostfixExpression>ast.expr).expr
            let param=(<PostfixExpression>ast.expr).postfix[(<PostfixExpression>ast.expr).postfix.length-1] as ArgumentsPostfix
            call(data,3)
            if(!(data.type instanceof BlockType||scope.get((<BlockType>data.type).local.join('.')) instanceof Class))
                scope.thr(`new操作符用于对类进行初始化`)
            for(let i of param.args)
                call(i,3)
            type=new ClassType((<BlockType>data.type).local,param.generic)
        }
        if(prefix instanceof IncrementPrefix||prefix instanceof DecrementPrefix||prefix instanceof BitNotPrefix||
            prefix instanceof MinusPrefix)
            type=new NumberType()
        if(prefix instanceof NotPrefix)
            type=new BooleanType()
        if(prefix instanceof AddressPrefix)
            type=to_point(type)
        if(prefix instanceof ReferencePrefix) {
            if (!(type instanceof FixType && type.fix[type.fix.length - 1] instanceof PointFix)) {
                scope.thr(`引用操作符用于对指针进行操作`)
            }
            (type as FixType).fix.pop()
        }
    }
    ast.type=type
}
const Label_PostfixExpression:slang_check_visitor=(ast:PostfixExpression,scope,call)=>{
    call(ast.expr,3)
    let type=ast.expr.type
    for(let postfix of ast.postfix){
        let oper=''
        for(let [k,v] of Operation_Postfix)
            if(postfix instanceof k)oper=v
        let data:Expression[]=[]
        if(postfix instanceof IncrementPostfix||postfix instanceof DecrementPostfix)
            data=[new NumberLiteral('0')]
        if(postfix instanceof ArgumentsPostfix)
            data=[...postfix.args]
        if(postfix instanceof IndexPostfix)
            data=[postfix.index]
        let operation=oper_best(scope,oper,to_point(ast.expr),...data)
        if(operation!=null){
            type=operation[0].type
            continue
        }
        if(postfix instanceof IncrementPostfix||postfix instanceof DecrementPostfix)
            type=new NumberType()
        if(postfix instanceof IndexPostfix){
            if(!(type instanceof MapExpression||type instanceof ArrayExpression))
                scope.thr(`[]操作符用于对数组或映射进行操作,除非被重载`)
            let _t:Type=new VoidType()
            if(type instanceof MapExpression)type.elements.forEach(i=>_t=type_merge(_t,i.type,scope))
            if(type instanceof ArrayExpression)type.elements.forEach(i=>_t=type_merge(_t,i.type,scope))
            type=_t
        }
        if(postfix instanceof MemberPostfix){
            if(type instanceof ClassType){
                let cls:Class|Interface=scope.get(type.local.join('.')) as Class|Interface
                const have=(name:string,cls:Class|Interface)=>{
                }
            }
        }
    }
}
