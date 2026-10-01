//round:类型检查
import {
    AddressPrefix,
    ArgumentsPostfix, ArrayExpression, ArrayFix,
    Assign, BinaryExpression, BitNotPrefix, Block,
    BlockType, BooleanType, BooleanLiteral, Call,
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
    ReferencePrefix, Return, StringLiteral, StringType, SwitchStatement, TernaryExpression, Throw, TryStatement, Type,
    TypeFix, TypePrefix, VarDeclaration,
    Variable, VoidType, WhileStatement
} from '../utils'
import {
    cast_best,
    cast_get,
    each_oper, generic_name, is_array_or_map,
    oper_best,
    Operation_Assign, Operation_Binary, Operation_Postfix, Operation_Prefix, overload_resolve, param_is, real_type,
    slang_check_visitor,
    to_point, type_, type_merge
} from './tool'
//round3:类型标注和检查
const Label_File:slang_check_visitor=(ast:File,scope,call)=>{
    scope=scope.enter()
    for(let i of ast.links)
        scope.set(i.as,scope.get(i.module.join('.')))
    for(let i of ast.children)
        call(i,3,scope)
    scope=scope.leave()
}
const Label_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    scope=scope.enter()
    let name=scope.path==''?ast.name:scope.path+'.'+ast.name
    scope.path=name
    ast.type=new BlockType(name.split('.'))
    scope.set(ast.name,ast)
    scope.set(name,ast)
    scope.set('up',new BlockType(name.split('.'),true))
    for(let i of ast.children)
        call(i,3,scope)
    scope=scope.leave()
}
const Label_ClassOrInterface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    let name=scope.path==''?ast.name:scope.path+'.'+ast.name
    ast.type=new BlockType(name.split('.'))
    scope.set(ast.name,ast)
    scope=scope.enter()
    scope.path=name
    for(let i of ast.children.filter(i=>!i.modifiers.unstatic))
        call(i,3,scope)
    for(let [k,v] of ast.generic){
        call(v,3,scope)
        if(!generic_name(k,scope))scope.thr(`泛型${k}重复定义在行${v.line.join('\n')}`)
        scope.set_generic(k,v)
    }
    call(ast.implement,3,scope)
    scope.set('this',new ClassType(name.split('.'),Array.from(ast.generic.values()),true))
    scope.set('up',new BlockType(name.split('.'),true))
    for(let i of ast.children.filter(i=>i.modifiers.unstatic))
        call(i,3,scope)
    scope=scope.leave()
}
const Label_Enum:slang_check_visitor=(ast:Enum,scope,call)=>{
    let name=scope.path==''?ast.name:scope.path+'.'+ast.name
    ast.type=new BlockType(name.split('.'))
    scope.set(ast.name,ast)
}
const Label_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    scope.set(ast.name,ast)
    scope.set_overload(ast.name,ast)
    ast.type=new LambdaType(ast.generic,ast.params,ast.return_type,ast.modifiers._async,true,ast.name)
    scope=scope.enter()
    for(let [k,v] of ast.generic){
        call(v,3,scope)
        if(!generic_name(k,scope))scope.thr(`泛型${k}重复定义在行${v.line.join('\n')}`)
        scope.set_generic(k,v)
    }
    for(let [k,v] of ast.params){
        call(v,3,scope)
        const param=new VarDeclaration(k,v,null)
        param.type=real_type(v,scope)
        scope.set(k,param)
    }
    scope.set('return',ast.return_type)
    call(ast.commands,3,scope)
    scope=scope.leave()
}
const Label_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    scope.set(ast.name,ast)
    call(ast.value,3,scope)
    ast.type=real_type(ast.t,scope)
    call(ast.type,3,scope)
    //无初值的声明不做赋值兼容检查
    if(ast.value!=null&&!type_(ast.value.type,ast.t,scope))
        scope.thr(`变量${ast.name}赋值类型错误在行${ast.line.join('\n')}`)
}
const Label_ListCommand:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    scope=scope.enter()
    for(let i of ast.commands)
        call(i,3,scope)
    scope=scope.leave()
}
const Label_Assign:slang_check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,3,scope)
    call(ast.value,3,scope)
    //ast.data必须是左值
    //左值:*a,纯member和下标组合
    let is_left=false
    if(ast.data instanceof PrefixExpression&&ast.data.prefix[ast.data.prefix.length-1] instanceof ReferencePrefix)
        is_left=true
    if(ast.data instanceof PostfixExpression){
        is_left=true
        for(let i of ast.data.postfix)
            if(!(i instanceof IndexPostfix||i instanceof MemberPostfix))
                is_left=false
    }
    if(ast.data instanceof IdentifierExpr)
        is_left=true
    if(!is_left)scope.thr(`赋值的左侧不是可赋值的左值,在行${ast.line.join('\n')}`)
    let _oper:string=''
    for(let [k,v] of Operation_Assign)
        if(ast instanceof k)_oper=v
    //是否重载operation=
    let operation=oper_best(scope,_oper+'=',ast.data.type,ast.value.type)
    if(operation.length>0)
        ast.oper=operation[0].local.join('.')+_oper+'=@'+operation[0].index
    else{
        let cast=cast_best(ast.data.type,ast.value.type,scope)
        if(cast!=null){
            ast.value.cast=cast.id
            return
        }
    }
    if(!type_(ast.value==null?null:ast.value.type,ast.data==null?null:ast.data.type,scope))
        scope.thr(`赋值类型错误在行${ast.line.join('\n')}`)
}
const Label_ThrowOrReturnOrCallOrIncrementOrDecrement:slang_check_visitor=(ast:Throw|Return|Call|Increment|Decrement,scope,call)=>{
    call(ast.data,3,scope)
    if(ast instanceof Return&&!type_(ast.data==null?null:ast.data.type,scope.get('return'),scope))
        scope.thr(`返回类型错误在行${ast.line.join('\n')}`)
    if(ast instanceof Throw){
        const throw_type:Type=scope.get('throw')
        if(throw_type==null)
            scope.thr(`抛出异常没有try-catch在行${ast.line.join('\n')}`)
        else if(!type_(ast.data==null?null:ast.data.type,throw_type,scope))
            scope.thr(`抛出异常类型错误在行${ast.line.join('\n')}`)
    }
    if(ast instanceof Increment||ast instanceof Decrement){
        const operation=oper_best(scope,ast instanceof Increment?'++':'--',ast.data.type)
        if(operation.length>0){
            ast.oper=operation[0].local.join('.')+(ast instanceof Increment?'++':'--')+'=@'+operation[0].index
            return
        }
        const cast=cast_best(new NumberType(),ast.data==null?null:ast.data.type,scope)
        if(cast!=null){
            ast.data.cast=cast.id
            return
        }
        if(!(type_merge(ast.data.type,new NumberType(),scope) instanceof NumberType))
            scope.thr(`返回类型错误在行${ast.line.join('\n')}`)
    }
}
const Label_VarDeclaration:slang_check_visitor=(ast:VarDeclaration,scope,call)=>{
    call(ast.value,3,scope)
    ast.type=real_type(ast.t,scope)
    call(ast.type,3,scope)
    scope.set(ast.name,ast)
    if(ast.value!=null&&!type_(ast.value.type,ast.t,scope))
        scope.thr(`变量${ast.name}赋值类型错误在行${ast.line.join('\n')}`)
}
const Label_IfStatement:slang_check_visitor=(ast:IfStatement,scope,call)=>{
    call(ast.condition,3,scope)
    scope=scope.enter()
    call(ast.commands,3,scope)
    scope=scope.leave()
    scope=scope.enter()
    call(ast.else_,3,scope)
    scope=scope.leave()
}
const Label_SwitchStatement:slang_check_visitor=(ast:SwitchStatement,scope,call)=>{
    call(ast.condition,3,scope)
    ast.case_list.forEach(i=>{
        call(i.condition,3,scope)
        if(!type_(i.condition==null?null:i.condition.type,ast.condition.type,scope))
            scope.thr(`switch case的类型和switch的类型不一致,在行${ast.line.join('\n')}`)
        scope=scope.enter()
        call(i.commands,3,scope)
        scope=scope.leave()
    })
    scope=scope.enter()
    call(ast.default_,3,scope)
    scope=scope.leave()
}
const Label_WhileOrDoWhileStatement:slang_check_visitor=(ast:WhileStatement|DoWhileStatement,scope,call)=>{
    call(ast.condition,3,scope)
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
    const data_type=real_type(ast.data==null?null:ast.data.type,scope)
    let data:Type
    let type=each_oper(scope,data_type,[ArrayExpression,MapExpression])
    data=type.type
    ast.unwrap=type.unwarp
    if(data_type instanceof FixType&&data_type.fix.length>0){
        const last=data_type.fix[data_type.fix.length-1]
        if(last instanceof ArrayFix||last instanceof MapFix)
            data=real_type(data_type.t,scope)
    }
    if(data instanceof VoidType)
        scope.thr(`foreach的对象不是或不可以转换为数组或Map,在行${ast.line.join('\n')}`)
    const elem=real_type(data,scope)
    const vd=new VarDeclaration(ast.iden,elem,new NullLiteral(null))
    vd.type=elem
    scope.set(ast.iden,vd)
    call(ast.commands,3,scope)
    scope=scope.leave()
}
const Label_TryStatement:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    scope=scope.enter()
    call(real_type(ast.catch_.type,scope),3,scope)
    scope.set('throw',real_type(ast.catch_.type,scope))
    call(ast.commands,3,scope)
    scope=scope.leave()
    scope=scope.enter()
    const ct=real_type(ast.catch_.type,scope)
    const cv=new VarDeclaration(ast.catch_.iden,ct,new NullLiteral(null))
    cv.type=ct
    scope.set(ast.catch_.iden,cv)
    call(ast.catch_.command,3,scope)
    scope=scope.leave()
    scope=scope.enter()
    call(ast.finally_,3,scope)
    scope=scope.leave()
}
const Label_TernaryExpression:slang_check_visitor=(ast:TernaryExpression,scope,call)=>{
    call(ast.condition,3,scope)
    call(ast.trueExpr,3,scope)
    call(ast.falseExpr,3,scope)
    ast.type=ast.trueExpr==null?null:ast.trueExpr.type
    if(!type_(ast.falseExpr==null?null:ast.falseExpr.type,ast.trueExpr==null?null:ast.trueExpr.type,scope))
        scope.thr(`三元运算符的true和false不是同种类型错误在行${ast.line.join('\n')}`)
}
const Label_BinaryExpression:slang_check_visitor=(ast:BinaryExpression,scope,call)=>{
    call(ast.left,3,scope)
    call(ast.right,3,scope)
    let oper:string=''
    for(let [k,v] of Operation_Binary)
        if(ast instanceof k)oper=v
    let operation=oper_best(scope,oper,to_point(ast.left.type),to_point(ast.right.type))
    //oper_best 无匹配时返回空数组,必须判 length 而不是判 null
    if(operation.length>0){
        ast.type=real_type(operation[0].command.ret,scope)
        ast.oper=operation[0].oper
        return
    }
    const is_number=['+','-','*','/','%','&','|','^','>>','<<'].includes(oper)
    ast.type=is_number?new NumberType():new BooleanType()
    const number_oper=['+','-','*','/','%','&','|','^','>>','<<','>','<','>=','<=']
    const boolean_oper=['&&','||']
    if(number_oper.includes(oper)){
        if(!type_(ast.left.type,new NumberType(),scope)||!type_(ast.right.type,new NumberType(),scope)){
            scope.thr(`二元运算符的两个操作数不是运算符规定的错误在行${ast.line.join('\n')}`)
            ast.type=new VoidType()
        }
    }else if(boolean_oper.includes(oper)){
        if(!type_(ast.left.type,new BooleanType(),scope)||!type_(ast.right.type,new BooleanType(),scope)){
            scope.thr(`二元运算符的两个操作数不是运算符规定的错误在行${ast.line.join('\n')}`)
            ast.type=new VoidType()
        }
    }
}
const Label_PrefixExpression:slang_check_visitor=(ast:PrefixExpression,scope,call)=>{
    call(ast.expr,3,scope)
    let type:Type=ast.expr.type
    for(let i=0;i<ast.prefix.length;i++){
        let prefix=ast.prefix[i]
        let oper=''
        for(let [k,v] of Operation_Prefix)
            if(prefix instanceof k)oper=v
        let operation=oper_best(scope,oper,to_point(type))
        if(operation.length>0){
            ast.opers[i]=operation[0].local.join('.')+'.'+operation[0].oper+'@'+operation[0].index
            type=real_type(operation[0].command.ret,scope)
            continue
        }
        if(prefix instanceof TypePrefix)type=prefix.type
        if(prefix instanceof NewPrefix){
            if(!(ast.expr instanceof PostfixExpression&&
                ast.expr.postfix[ast.expr.postfix.length-1] instanceof ArgumentsPostfix)){
                scope.thr(`除了重载new应该对调用使用,在行${ast.line.join('\n')}`)
                continue
            }
            let data=(<PostfixExpression>ast.expr).expr
            let param=(<PostfixExpression>ast.expr).postfix[(<PostfixExpression>ast.expr).postfix.length-1] as ArgumentsPostfix
            call(data,3,scope)
            let local:string[]=null
            if(data.type instanceof BlockType||data.type instanceof ClassType)local=data.type.local
            if(local==null||!(scope.get(local.join('.')) instanceof Class))
                scope.thr(`new操作符用于对类进行初始化,在行${ast.line.join('\n')}`)
            for(let a of param.args)
                call(a,3,scope)
            if(local!=null)type=new ClassType(local,param.generic)
        }
        const cast=cast_get(type,scope)
        if(prefix instanceof IncrementPrefix||prefix instanceof DecrementPrefix||prefix instanceof BitNotPrefix||
            prefix instanceof MinusPrefix){
            if(cast.find(i=>i.type instanceof NumberType)){
                ast.casts[i]=cast.find(i=>i.type instanceof NumberType).id
                type=new NumberType()
                continue
            }
            if(!(type instanceof NumberType))
                scope.thr(`++/--用于对数字进行操作,除非被重载,在行${ast.line.join('\n')}`)
            type=new NumberType()
        }
        if(prefix instanceof NotPrefix){
            if(cast.find(i=>i.type instanceof BooleanType)){
                ast.casts[i]=cast.find(i=>i.type instanceof BooleanType).id
                type=new BooleanType()
                continue
            }
            if(!(type instanceof BooleanType))
                scope.thr(`!用于对布尔进行操作,除非被重载,在行${ast.line.join('\n')}`)
            type=new BooleanType()
        }
        if(prefix instanceof AddressPrefix)
            type=to_point(type)
        if(prefix instanceof ReferencePrefix){
            //只在 FixType+PointFix 时切片,否则报错(不要污染原类型)
            if(type instanceof FixType&&type.fix.length>0&&type.fix[type.fix.length-1] instanceof PointFix)
                type=new FixType(type.t,type.fix.slice(0,-1))
            else
                scope.thr(`引用操作符用于对指针进行操作,在行${ast.line.join('\n')}`)
        }
    }
    ast.type=type
}
const Label_PostfixExpression:slang_check_visitor=(ast:PostfixExpression,scope,call)=>{
    call(ast.expr,3,scope)
    let type=ast.expr.type
    for(let i=0;i<ast.postfix.length;i++){
        const postfix=ast.postfix[i]
        let oper=''
        for(let [k,v] of Operation_Postfix)
            if(postfix instanceof k)oper=v
        let data:Type[]=[]
        if(postfix instanceof IncrementPostfix||postfix instanceof DecrementPostfix)
            data=[to_point(new NumberType())]
        if(postfix instanceof ArgumentsPostfix){
            postfix.args.forEach(a=>call(a,3,scope))
            data=postfix.args.map(a=>to_point(a.type))
        }
        if(postfix instanceof IndexPostfix){
            call(postfix.index,3,scope)
            data=[to_point(postfix.index.type)]
        }
        let operation=oper_best(scope,oper,to_point(type),...data)
        if(operation.length>0){
            ast.opers[i]=operation[0].oper+'@'+operation[0].index
            type=real_type(operation[0].command.ret,scope)
        }else{
            if(postfix instanceof IncrementPostfix||postfix instanceof DecrementPostfix)
                type=new NumberType()
            if(postfix instanceof IndexPostfix){
                const container=real_type(type,scope)
                let fix:TypeFix=null
                if(container instanceof FixType&&container.fix.length>0)
                    fix=container.fix[container.fix.length-1]
                if(fix instanceof MapFix&&!(postfix.index.type instanceof StringType))
                    scope.thr(`Map的键必须是string,在行${ast.line.join('\n')}`)
                if(container instanceof FixType&&(fix instanceof ArrayFix||fix instanceof MapFix)){
                    const rest=container.fix.slice(0,-1)
                    type=rest.length>0?new FixType(container.t,rest):container.t
                }else{
                    //尝试cast
                    const cast=cast_get(type,scope)
                    const has=cast.find(i=>is_array_or_map(i.type))
                    if(has){
                        ast.casts[i]=has.id
                        ast.type=has.type
                        continue
                    }
                    scope.thr(`[]操作符用于对数组或Map进行操作,除非被重载`)
                    type=new VoidType()
                }
            }
            if(postfix instanceof MemberPostfix){
                if(type instanceof ClassType){
                    const name=type.local.join('.')
                    const cls=scope.get(name)
                    const chain=scope.root().chain
                    const inherited=chain.has(name)?[...chain.get(name)]:[]
                    //this 内部可访问任意成员;外部实例只能访问非 static 且非 private 的成员
                    const cond=type._this
                        ?(i:Block)=>i.name==postfix.name
                        :(i:Block)=>i.name==postfix.name&&!!i.modifiers.unstatic
                    let found:Block=null
                    if(cls instanceof Class||cls instanceof Interface)
                        found=cls.children.find(i=>cond(i))??null
                    if(found==null)
                        for(const j of inherited)
                            if(j instanceof Interface){
                                found=j.children.find(i=>cond(i))??null
                                if(found!=null)break
                            }
                    if(found==null)
                        scope.thr(`类${name}中不存在成员${postfix.name}`)
                    else if(!type._this&&found.modifiers&&found.modifiers._private)
                        scope.thr(`不能访问类${name}的private成员${postfix.name},在行${ast.line.join('\n')}`)
                    else
                        type=real_type(found.type,scope)
                }else if(type instanceof BlockType){
                    const block_data=scope.get(type.local.join('.'))
                    if(block_data==null)
                        scope.thr(`类${type.local.join('.')}中不存在成员${postfix.name}`)
                    else if(block_data instanceof Enum&&block_data.children.includes(postfix.name))
                        type=new EnumType(type.local)
                    else if(block_data instanceof Class||block_data instanceof Interface||block_data instanceof Module){
                        const found=block_data.children.find(i=>i.name==postfix.name)
                        if(found)type=real_type(found.type,scope)
                        else scope.thr(`类${type.local.join('.')}中不存在成员${postfix.name}`)
                    }else scope.thr(`类${type.local.join('.')}中不存在成员${postfix.name}`)
                }else scope.thr(`成员操作符用于对类或者接口类型的变量进行操作`)
            }
            if(postfix instanceof ArgumentsPostfix){
                //先看有没有转换到lambda的
                if(type instanceof ClassType){
                    let lambda_cast:{id:string,type:LambdaType}[]=
                        cast_get(type,scope).filter(i=>i.type instanceof LambdaType) as {id:string,type:LambdaType}[]
                    //泛型对的上筛选
                    lambda_cast=lambda_cast.filter(i=>param_is(Array.from(i.type.generic.values()),i.type.generic,scope))
                    //参数对的上的筛选
                    lambda_cast=lambda_cast.filter(i=>param_is(postfix.args.map(a=>a.type),i.type.params,scope))
                    //多个直接报错
                    if(lambda_cast.length>1)scope.thr(`对于${type.local.join('.')}对()的重载,有冲突在行${ast.line.join('\n')}`)
                    if(lambda_cast.length==1){
                        const lambda=lambda_cast[0]
                        ast.casts[i]=lambda.id
                        scope=scope.enter()
                        for(let k=0;k<lambda.type.generic.size&&k<postfix.generic.length;k++)
                            scope.set_generic(Array.from(lambda.type.generic.keys())[k],postfix.generic[k])
                        const rt=real_type(lambda.type,scope)
                        if(rt instanceof LambdaType)type=rt.returnType
                        scope=scope.leave()
                    }
                }
                //再看是不是有lambda的
                if(type instanceof LambdaType){
                    //函数调用
                    if(type.overload){
                        let data=overload_resolve(scope,type.name,postfix.args.map(a=>a.type))
                        if(data.kind=='ambiguous')scope.thr(`对于${type.name}的重载,有冲突的在行${ast.line.join('\n')}`)
                        if(data.kind=='none')scope.thr(`调用的${type.name}没有匹配的重载,在行${ast.line.join('\n')}`)
                        if(data.kind=='best'){
                            //泛型对的上
                            if(!param_is(postfix.generic,data.fn.generic,scope))
                                scope.thr(`调用的${type.name}泛型参数类型错误,在行${ast.line.join('\n')}`)
                            ast.call_targets[i]=type.name+'@'+data.fn.index
                            scope=scope.enter()
                            for(let k=0;k<data.fn.generic.size&&k<postfix.generic.length;k++)
                                scope.set_generic(Array.from(data.fn.generic.keys())[k],postfix.generic[k])
                            type=real_type(data.fn.return_type,scope)
                            scope=scope.leave()
                        }
                    }else{
                        if(!param_is(postfix.args.map(a=>a.type),type.params,scope))
                            scope.thr(`调用的lambda参数类型错误,在行${ast.line.join('\n')}`)
                        type=type.returnType
                    }
                }else if(!(type instanceof ClassType))
                    scope.thr(`调用的类型不是函数,在行${ast.line.join('\n')}`)
            }
        }
        //每个 postfix 处理后记录类型,循环结束后写 ast.type
        ast.types[i]=type
    }
    ast.type=type
}
const Label_IdentifierExpression:slang_check_visitor=(ast:IdentifierExpr,scope,call)=>{
    const data=scope.get(ast.name)
    if(data==null){
        scope.thr(`未定义的变量${ast.name}`)
        ast.type=new VoidType()
        return
    }
    ast.type=data instanceof Type?data:(data.type!=null?data.type:new VoidType())
}
const Label_ArrayExpression:slang_check_visitor=(ast:ArrayExpression,scope,call)=>{
    for(const i of ast.elements)
        call(i,3,scope)
    let type:Type=new VoidType()
    for(const i of ast.elements)
        type=type_merge(type,i.type,scope)
    if(type instanceof FixType)ast.type=new FixType(type.t,[...type.fix,new ArrayFix()])
    else ast.type=new FixType(type,[new ArrayFix()])
}
const Label_MapExpression:slang_check_visitor=(ast:MapExpression,scope,call)=>{
    for(const [,i] of ast.elements)
        call(i,3,scope)
    let type:Type=new VoidType()
    for(const [,i] of ast.elements)
        type=type_merge(type,i.type,scope)
    if(type instanceof FixType)ast.type=new FixType(type.t,[...type.fix,new MapFix()])
    else ast.type=new FixType(type,[new MapFix()])
}
const Label_LambdaExpression:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    scope=scope.enter()
    for(let [k,v] of ast.generic)
        scope.set_generic(k,v)
    ast.params.forEach(i=>call(real_type(i,scope),3,scope))
    call(ast.body,3,scope)
    scope=scope.leave()
}
const Label_FixType:slang_check_visitor=(ast:FixType,scope,call)=>{
    call(ast.t,3,scope)
}
const Label_ClassType:slang_check_visitor=(ast:ClassType,scope,call)=>{
    //generic和定义范围是否兼容
    const block=scope.get(ast.local.join('.'))
    if(block==null||!(block instanceof Class||block instanceof Interface)){
        scope.thr(`类/接口${ast.local.join('.')}不存在,在行${ast.line.join('\n')}`)
        return
    }
    if(!param_is(ast.generic,block.generic,scope))
        scope.thr(`generic参数类型错误,在行${ast.line.join('\n')}`)
}
const Label_EnumType:slang_check_visitor=(ast:EnumType,scope,call)=>{
    const block=scope.get(ast.local.join('.'))
    if(!(block instanceof Enum))scope.thr(`未定义的枚举${ast.local.join('.')}`)
}
const Label_Literal:slang_check_visitor=(ast,scope,call)=>{
    if(ast instanceof NumberLiteral)ast.type=new NumberType()
    else if(ast instanceof StringLiteral)ast.type=new StringType()
    else if(ast instanceof BooleanLiteral)ast.type=new BooleanType()
    else ast.type=new VoidType()
}
export const Round3=new Map<any,slang_check_visitor>([
    [IdentifierExpr,Label_IdentifierExpression],
    [NumberLiteral,Label_Literal],
    [StringLiteral,Label_Literal],
    [BooleanLiteral,Label_Literal],
    [NullLiteral,Label_Literal],
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