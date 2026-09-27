//round:类型检查
import {
    AddressPrefix,
    ArgumentsPostfix, ArrayExpression, ArrayFix,
    Assign, BinaryExpression, BitNotPrefix, Block,
    BlockType, BooleanType, Call,
    Class,
    ClassType, Decrement, DecrementPostfix, DecrementPrefix, DoWhileStatement,
    Enum, EnumType, Expression,
    File, FixType, ForeachStatement, ForStatement,
    Function, IdentifierExpr, IfStatement, Increment, IncrementPostfix, IncrementPrefix, IndexPostfix,
    Interface, LambdaExpression,
    LambdaType,
    ListCommand, MapExpression, MapFix, MemberPostfix, MinusPrefix,
    Module, NewPrefix, NotPrefix, NullLiteral, NumberLiteral, NumberType, PointFix, PostfixExpression,
    PrefixExpression,
    ReferencePrefix, Return, SwitchStatement, TernaryExpression, Throw, TryStatement, Type,
    TypeFix, TypePrefix, VarDeclaration,
    Variable, VoidType, WhileStatement
} from '../utils'
import {
    cast_best,
    cast_get,
    each_oper, generic_name,
    oper_best, Operation_Binary, Operation_Postfix, Operation_Prefix, overload_resolve, param_is, real_type,
    slang_check_visitor,
    to_point, type_, type_merge
} from './tool'
//round3:类型标注和检查
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
    scope.set('up',new BlockType(name.split('.'),true))
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
    for(let i of ast.children.filter(i=>!i.modifiers.unstatic))
        call(i,3)
    for(let [k,v] of ast.generic){
        call(v,3)
        if(!generic_name(k,scope))scope.thr(`泛型${k}重复定义在行${v.line.join('\n')}`)
        scope.set_generic(k,v)
    }
    call(ast.implement,3)
    scope.set('this',new ClassType(name.split('.'),Array.from(ast.generic.values()),true))
    scope.set('up',new BlockType(name.split('.'),true))
    for(let i of ast.children.filter(i=>i.modifiers.unstatic))
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
    scope.set_overload(ast.name,ast)
    ast.type=new LambdaType(ast.generic,ast.params,ast.return_type,ast.modifiers._async,true,ast.name)
    scope=scope.enter()
    for(let [k,v] of ast.generic){
        call(v,3)
        if(!generic_name(k,scope))scope.thr(`泛型${k}重复定义在行${v.line.join('\n')}`)
        scope.set_generic(k,v)
    }
    for(let [k,v] of ast.params){
        call(v,3)
        scope.set(k,v)
    }
    scope.set('return',ast.return_type)
    call(ast.commands,3)
    scope=scope.leave()
}
const Label_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    scope.set(ast.name,ast)
    call(real_type(ast.t,scope),3)
    ast.type=ast.t
    call(ast.value,3)
    if(!type_(ast.value,ast.t,scope))
        scope.thr(`变量${ast.name}赋值类型错误在行${ast.line.join('\n')}`)
}
const Label_ListCommand:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    for(let i of ast.commands)
        call(i,3)
}
const Label_Assign:slang_check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,3)
    call(ast.value,3)
    if(!type_(ast.value,ast.data.type,scope))
        scope.thr(`赋值类型错误在行${ast.line.join('\n')}`)
}
const Label_ThrowOrReturnOrCallOrIncrementOrDecrement:slang_check_visitor=(ast:Throw|Return|Call|Increment|Decrement,scope,call)=>{
    call(ast.data,3)
    if(ast instanceof Return&&!type_(ast.data,scope.get('return'),scope))
        scope.thr(`返回类型错误在行${ast.line.join('\n')}`)
    if(ast instanceof Throw){
        if(!scope.get('throw'))
            scope.thr(`抛出异常没有try-catch在行${ast.line.join('\n')}`)
        const throw_type:Type=scope.get('throw')
        if(!type_(ast.data,throw_type,scope))
            scope.thr(`抛出异常类型错误在行${ast.line.join('\n')}`)
    }
    if(ast instanceof Increment||ast instanceof Decrement){
        const cast=cast_best(new NumberType(),ast.data,scope)
        if(cast!=null){
            ast.data.cast=cast
            return
        }
        if(!(type_merge(ast.data.type,new NumberType(),scope) instanceof NumberType))
            scope.thr(`返回类型错误在行${ast.line.join('\n')}`)
    }
    if(ast instanceof Call)
        call(ast.data,3)
}
const Label_VarDeclaration:slang_check_visitor=(ast:VarDeclaration,scope,call)=>{
    call(ast.value,3)
    ast.type=ast.t
    call(real_type(ast.t,scope),3)
    scope.set(ast.name,ast)
    call(new Assign(ast,ast.value),3)
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
        if(!type_(i.condition,ast.condition.type,scope))
            scope.thr(`switch case的类型和switch的类型不一致,在行${ast.line.join('\n')}`)
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
    let data=each_oper(scope,real_type(ast.data.type,scope),[ArrayExpression,MapExpression])
    if(data instanceof VoidType)
        scope.thr(`foreach的对象不是或不可以转换为数组或Map,在行${ast.line.join('\n')}`)
    scope.set(ast.iden,new VarDeclaration(ast.iden,real_type(data,scope),new NullLiteral(null)))
    call(ast.commands,3)
    scope=scope.leave()
}
const Label_TryStatement:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    scope=scope.enter()
    call(real_type(ast.catch_.type,scope),3)
    scope.set('throw',real_type(ast.catch_.type,scope))
    call(ast.commands,3)
    scope=scope.leave()
    scope=scope.enter()
    scope.set(ast.catch_.iden,new VarDeclaration(ast.catch_.iden,real_type(ast.catch_.type,scope),new NullLiteral(null)))
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
    if(!type_(ast.falseExpr,ast.trueExpr,scope))
        scope.thr(`三元运算符的true和false不是同种类型错误在行${ast.line.join('\n')}`)
}
const Label_BinaryExpression:slang_check_visitor=(ast:BinaryExpression,scope,call)=>{
    call(ast.left,3)
    call(ast.right,3)
    let oper:string=''
    for(let [k,v] of Operation_Binary)
        if(ast instanceof k)oper=v
    let operation=oper_best(scope,oper,to_point(ast.left.type),to_point(ast.right.type))
    if(operation!=null){
        ast.type=real_type(operation[0].type,scope)
        ast.oper=operation[0].oper
        return
    }
    ast.type=['+','-','*','/','&','|','^','>>','<<'].includes(oper)?new NumberType():new BooleanType()
    if(!type_(ast.left,type_merge(ast.left.type,ast.type,scope),scope))
        scope.thr(`二元运算符的两个操作数不是运算符规定的错误在行${ast.line.join('\n')}`)
}
const Label_PrefixExpression:slang_check_visitor=(ast:PrefixExpression,scope,call)=>{
    call(ast.expr,3)
    let type:Type=ast.expr.type
    for(let i=0;i<ast.prefix.length;i++){
        let prefix=ast.prefix[i]
        let oper=''
        for(let [k,v] of Operation_Prefix)
            if(prefix instanceof k)oper=v
        let operation=oper_best(scope,oper,to_point(ast.expr))
        if(operation!=null){
            ast.opers[i]=operation[0].oper
            type=operation[0].type
            continue
        }
        if(prefix instanceof TypePrefix)type=prefix.type
        if(prefix instanceof NewPrefix){
            if(type!=ast.expr.type||!(ast.expr instanceof PostfixExpression&&
                ast.expr.postfix[ast.expr.postfix.length-1] instanceof ArgumentsPostfix))
                scope.thr(`除了重载new应该对调用使用,在行${ast.line.join('\n')}`)
            let data=(<PostfixExpression>ast.expr).expr
            let param=(<PostfixExpression>ast.expr).postfix[(<PostfixExpression>ast.expr).postfix.length-1] as ArgumentsPostfix
            call(data,3)
            if(!(data.type instanceof BlockType||scope.get((<BlockType>data.type).local.join('.')) instanceof Class))
                scope.thr(`new操作符用于对类进行初始化,在行${ast.line.join('\n')}`)
            for(let i of param.args)
                call(i,3)
            type=new ClassType((<BlockType>data.type).local,param.generic)
        }
        const cast=cast_get(type,scope)
        if(prefix instanceof IncrementPrefix||prefix instanceof DecrementPrefix||prefix instanceof BitNotPrefix||
            prefix instanceof MinusPrefix){
            if(cast.find(i=>i instanceof NumberType)){
                ast.casts[i]=cast.find(i=>i instanceof NumberType)
                type=new NumberType()
                continue
            }
            if(!(type instanceof NumberType))
                scope.thr(`++/--用于对数字进行操作,除非被重载,在行${ast.line.join('\n')}`)
            type=new NumberType()
        }
        if(prefix instanceof NotPrefix){
            if(cast.find(i=>i instanceof BooleanType)){
                ast.casts[i]=cast.find(i=>i instanceof BooleanType)
                type=new BooleanType()
                continue
            }
            if(!(type instanceof BooleanType))
                scope.thr(`!用于对布尔进行操作,除非被重载,在行${ast.line.join('\n')}`)
            type=new BooleanType()
        }
        if(prefix instanceof AddressPrefix)
            type=to_point(type)
        if(prefix instanceof ReferencePrefix) {
            //&a操作转换容易出bug,禁止
            if (!(type instanceof FixType && type.fix[type.fix.length - 1] instanceof PointFix)) {
                scope.thr(`引用操作符用于对指针进行操作,在行${ast.line.join('\n')}`)
            }
            (type as FixType).fix.pop()
        }
    }
    ast.type=type
}
const Label_PostfixExpression:slang_check_visitor=(ast:PostfixExpression,scope,call)=>{
    call(ast.expr,3)
    let type=ast.expr.type
    for(let i=0;i<ast.postfix.length;i++){
        //其实就是放在最后设置一下,但这样可以continue
        ast.types[i-1]=type
        const postfix=ast.postfix[i]
        let oper=''
        for(let [k,v] of Operation_Postfix)
            if(postfix instanceof k)oper=v
        let data:Expression[]=[]
        if(postfix instanceof IncrementPostfix||postfix instanceof DecrementPostfix)
            data=[new NumberLiteral('0')]
        if(postfix instanceof ArgumentsPostfix){
            postfix.args.forEach(i=>call(i,3))
            data=postfix.args.map(to_point)
        }
        if(postfix instanceof IndexPostfix){
            call(postfix.index,3)
            data=[postfix.index]
        }
        let operation=oper_best(scope,oper,to_point(ast.expr),...data)
        if(operation!=null){
            ast.opers[i]=operation[0].oper
            type=operation[0].type
            continue
        }
        if(postfix instanceof IncrementPostfix||postfix instanceof DecrementPostfix)
            type=new NumberType()
        if(postfix instanceof IndexPostfix){
            if(!(type instanceof MapExpression||type instanceof ArrayExpression))
                scope.thr(`[]操作符用于对数组或Map进行操作,除非被重载`)
            let _t:Type=new VoidType()
            if(type instanceof MapExpression)type.elements.forEach(i=>_t=type_merge(_t,i.type,scope))
            if(type instanceof ArrayExpression)type.elements.forEach(i=>_t=type_merge(_t,i.type,scope))
            type=_t
        }
        if(postfix instanceof MemberPostfix){
            if(type instanceof ClassType){
                let name=type.local.join('.')
                let cls:Class|Interface=scope.get(type.local.join('.')) as Class|Interface
                let get=[...scope.chain.get(type.local.join('.'))]
                let cond=(i:Block)=>false
                if(type._this)cond=(i:Block)=>i.name==postfix.name&&!i.modifiers.unstatic
                else cond=(i:Block)=>i.name==postfix.name&&!i.modifiers.unstatic&&!i.modifiers._private
                //找name
                type=cls.children.find(i=>cond(i)).type
                if(type==null)for(let j of get){
                    type=j.children.find(j=>cond(j)).type
                    if(type!=null)break
                }
                if(type==null)scope.thr(`类${name}中不存在成员${postfix.name}`)
            }else if(type instanceof BlockType){
                let data:Block=scope.get(type.local.join('.')) as Block
                if(data instanceof Enum&&data.children.includes(postfix.name))
                    type=new EnumType(type.local)
                else if(data instanceof Class||data instanceof Interface||data instanceof Module){
                    let block
                    if(type._this)block=data.children.filter(i=>!i.modifiers.unstatic)
                    else block=data.children.filter(i=>!i.modifiers.unstatic&&!i.modifiers._private)
                    if(block.find(i=>i.name==postfix.name))
                        type=data.children.find(i=>i.name==postfix.name).type
                    else scope.thr(`类${type.local.join('.')}中不存在成员${postfix.name}`)
                }
            }else scope.thr(`成员操作符用于对类或者接口类型的变量进行操作`)
        }
        if(postfix instanceof ArgumentsPostfix){
            postfix.args.forEach(i=>call(i,3))
            //先看有没有转换到lambda的
            if(type instanceof ClassType&&cast_get(type,scope)){
                let lambda_cast=cast_get(type,scope).filter(i=>i instanceof LambdaType)
                //泛型对的上筛选
                lambda_cast=lambda_cast.filter(i=>param_is(Array.from(i.generic.values()),i.generic,scope))
                //参数对的上的筛选
                lambda_cast=lambda_cast.filter(i=>param_is(postfix.args,i.params,scope))
                //多个直接报错
                if(lambda_cast.length>1)scope.thr(`对于${type.local.join('.')}对()的重载,有冲突在行${ast.line.join('\n')}`)
                //有的话当成可以的
                ast.casts[i]=lambda_cast[0]
                scope=scope.enter()
                for(let i=0;i<lambda_cast[0].generic.size;i++)
                    scope.set_generic(Array.from(lambda_cast[0].generic.keys())[i],postfix.generic[i])
                if(lambda_cast.length==1)type=real_type(lambda_cast[0],scope).returnType
                scope=scope.leave()
            }
            //在看是不是有lambda的
            if(type instanceof LambdaType){
                //函数调用
                if(type.overload){
                    let data=overload_resolve(scope,type.name,postfix.args.map(to_point))
                    if(data.kind=='ambiguous')scope.thr(`对于${type.name}的重载,有冲突的在行${ast.line.join('\n')}`)
                    if(data.kind=='best'){
                        //泛型对的上
                        if(!param_is(postfix.generic,data.fn.generic,scope))
                            scope.thr(`调用的${type.name}泛型参数类型错误,在行${ast.line.join('\n')}`)
                        ast.call_targets[i]=type.name+'@'+data.fn.index
                        scope=scope.enter()
                        for(let i=0;i<data.fn.generic.size;i++)
                            scope.set_generic(Array.from(data.fn.generic.keys())[i],postfix.generic[i])
                        type=real_type(data.fn.return_type,scope)
                        scope=scope.leave()
                    }
                    continue
                }
                if(!param_is(postfix.args.map(i=>i.type),type.params,scope))
                    scope.thr(`调用的lambda参数类型错误,在行${ast.line.join('\n')}`)
                type=type.returnType
            }
        }
    }
}
const Label_IdentifierExpression:slang_check_visitor=(ast:IdentifierExpr,scope,call)=>{
    if(!scope.get(ast.name))scope.thr(`未定义的变量${ast.name}`)
    ast.type=scope.get(ast.name).type
}
const Label_ArrayExpression:slang_check_visitor=(ast:ArrayExpression,scope,call)=>{
    ast.elements.forEach(i=>call(i,3))
    let type=ast.elements[0].type
    for(let i of ast.elements)
        type=type_merge(type,i.type,scope)
    if(type instanceof FixType)ast.type=new FixType(type.t,[...type.fix,new ArrayFix()])
    else ast.type=new FixType(type,[new ArrayFix()])
}
const Label_MapExpression:slang_check_visitor=(ast:MapExpression,scope,call)=>{
    ast.elements.forEach(i=>call(i,3))
    let type=ast.elements[0].type
    for(let [,i] of ast.elements)
        type=type_merge(type,i.type,scope)
    if(type instanceof FixType)ast.type=new FixType(type.t,[...type.fix,new MapFix()])
    else ast.type=new FixType(type,[new MapFix()])
}
const Label_LambdaExpression:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    scope=scope.enter()
    for(let [k,v] of ast.generic)
        scope.set_generic(k,v)
    ast.params.forEach(i=>call(real_type(i,scope),3))
    call(ast.body,3)
    scope=scope.leave()
}
const Label_FixType:slang_check_visitor=(ast:FixType,scope,call)=>{
    call(ast.t,3)
}
const Label_ClassType:slang_check_visitor=(ast:ClassType,scope,call)=>{
    //generic和定义范围是否兼容
    const block:Class|Interface=scope.get(ast.local.join('.')) as Class|Interface
    if(!param_is(ast.generic,block.generic,scope))
        scope.thr(`generic参数类型错误,在行${ast.line.join('\n')}`)
}
const Label_EnumType:slang_check_visitor=(ast:EnumType,scope,call)=>{
    const block=scope.get(ast.local.join('.'))
    if(!(block instanceof Enum))scope.thr(`未定义的枚举${ast.local.join('.')}`)
}
export const Round3=new Map<any,slang_check_visitor>([
    [IdentifierExpr,Label_IdentifierExpression],
    [ArrayExpression,Label_ArrayExpression],
    [MapExpression,Label_MapExpression],
    [LambdaExpression,Label_LambdaExpression],
    [FixType,Label_FixType],
    [ClassType,Label_ClassType],
    [EnumType,Label_EnumType],
    [File,Label_File],
    [Module,Label_Module],
    [Function,Label_Function],
    [Class,Label_ClassOrInterface],
    [Interface,Label_ClassOrInterface],
    [Enum,Label_Enum],
    [Variable,Label_Variable],
    [ListCommand,Label_ListCommand],
    [WhileStatement,Label_WhileOrDoWhileStatement],
    [ForStatement,Label_ForStatement],
    [IfStatement,Label_IfStatement],
    [TryStatement,Label_TryStatement],
    [SwitchStatement,Label_SwitchStatement],
    [DoWhileStatement,Label_WhileOrDoWhileStatement],
    [Throw,Label_ThrowOrReturnOrCallOrIncrementOrDecrement],
    [Return,Label_ThrowOrReturnOrCallOrIncrementOrDecrement],
    [Call,Label_ThrowOrReturnOrCallOrIncrementOrDecrement],
    [Increment,Label_ThrowOrReturnOrCallOrIncrementOrDecrement],
    [Decrement,Label_ThrowOrReturnOrCallOrIncrementOrDecrement],
    [Assign,Label_Assign],
    [ForeachStatement,Label_ForeachStatement],
    [VarDeclaration,Label_VarDeclaration],
    [TernaryExpression,Label_TernaryExpression],
    [PrefixExpression,Label_PrefixExpression],
    [PostfixExpression,Label_PostfixExpression],
    [BinaryExpression,Label_BinaryExpression],
])