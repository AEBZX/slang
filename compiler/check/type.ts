//round:类型检查
import {
    AddressPrefix,
    ArgumentsPostfix,
    ArrayExpression,
    ArrayType,
    Assign,
    Await,
    BinaryExpression,
    BitNotPrefix,
    Block,
    BlockType, BooleanLiteral,
    BooleanType,
    Class,
    ClassType,
    DecrementPostfix,
    DecrementPrefix,
    DoWhileStatement,
    Enum,
    EnumType,
    ExprCommand,
    File,
    FixType,
    ForeachStatement,
    ForStatement,
    Function,
    IdentifierExpr,
    IfStatement,
    IncrementPostfix,
    IncrementPrefix,
    IndexPostfix,
    Interface,
    LambdaExpression,
    LambdaType,
    ListCommand, Literal,
    MapExpression,
    MapType,
    MemberPostfix,
    Module,
    NewPrefix,
    NotPrefix,
    NullLiteral, NumberLiteral,
    NumberType,
    PointType,
    PostfixExpression,
    PrefixExpression,
    ReferencePrefix,
    Return, StringLiteral,
    StringType,
    SwitchStatement,
    TernaryExpression,
    Throw,
    TryStatement,
    Type,
    TypePrefix,
    VarDecl,
    Variable, VM,
    VoidType,
    WhileStatement
} from '../utils'
import {
    cast,
    cast_get,
    generic_is,
    generic_name,
    localToName,
    nameToLocal,
    operation,
    Operation_Binary,
    param_is,
    pick_best,
    real_type,
    set_name,
    slang_check_visitor,
    to_point,
    type_,
    type_merge
} from './tool'
//round3:类型标注和检查
const Label_File:slang_check_visitor=(ast:File,scope,call)=>{
    scope=scope.enter()
    for(const i of ast.links)
        scope.set(i.as,scope.get(i.module.join('.')))
    for(const i of ast.children)
        call(i,3)
    scope=scope.leave()
}
const Label_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    const name=set_name(ast,scope)
    scope=scope.enter()
    scope.path=name
    scope.set('up',new BlockType(name.split('.'),true))
    for(const i of ast.children)
        scope.set(i.name,i)
    for(const i of ast.children)
        call(i,3)
    scope=scope.leave()
}
const Label_ClassOrInterface:slang_check_visitor=(ast:Class|Interface,scope,call)=>{
    const name=set_name(ast,scope)
    scope=scope.enter()
    scope.path=name
    for(const i of ast.children.filter(i=>!i.modifiers.unstatic))
        scope.set(i.name,i)
    for(const i of ast.children.filter(i=>!i.modifiers.unstatic))
        call(i,3)
    for(const [k,v] of ast.generic){
        call(v,3)
        if(!generic_name(k,scope))scope.thr(`泛型${k}重复定义在行${v.line.join('\n')}`)
        scope.set_generic(k,v)
    }
    call(ast.implement,3)
    scope.set('this',new ClassType(nameToLocal(name),Array.from(ast.generic.values()),true))
    scope.set('up',new BlockType(nameToLocal(name),true))
    for(const i of ast.children.filter(i=>i.modifiers.unstatic))
        call(i,3)
    scope=scope.leave()
}
const Label_Enum:slang_check_visitor=(ast:Enum,scope,call)=>{
    set_name(ast,scope)
}
const Label_Function:slang_check_visitor=(ast:Function,scope,call)=>{
    scope.set(ast.name,ast)
    scope.set_overload(ast.name,ast)
    ast.type=new LambdaType(ast.generic,ast.params,ast.return_type,true,ast.name)
    scope=scope.enter()
    for(const [k,v] of ast.generic){
        call(v,3)
        if(!generic_name(k,scope))scope.thr(`泛型${k}重复定义在行${v.line.join('\n')}`)
        scope.set_generic(k,v)
    }
    for(const [k,v] of ast.params){
        call(v,3)
        let param=new VarDecl(k,v,null)
        param.type=real_type(v,scope)
        scope.set(k,param)
    }
    scope.set('return',ast.return_type)
    call(ast.return_type,3)
    call(ast.commands,3)
    scope=scope.leave()
}
const Label_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    call(ast.value,3)
    call(ast.t,3)
    scope.set(ast.name,ast)
    ast.type=real_type(ast.t,scope)
    if(ast.t instanceof VoidType)scope.thr(`变量${ast.name}声明类型为void,在行${ast.line.join('\n')}`)
    //无初值的声明不做赋值兼容检查
    if(ast.value==null)return
    if(operation('=',ast,scope,to_point(ast.t),to_point(ast.value.type)))return
    if(type_(ast.value.type,ast.t,scope))return
    if(cast(ast,scope,ast.t))return
    scope.thr(`赋值类型错误在行${ast.line.join('\n')}`)
}
const Label_Await:slang_check_visitor=(ast:Await,scope,call)=>{
    call(ast.command,3)
}
const Label_ListCommand:slang_check_visitor=(ast:ListCommand,scope,call)=>{
    scope=scope.enter()
    for(const i of ast.commands)
        call(i,3)
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
    if(!is_left)scope.thr(`赋值的左侧不是可赋值的左值,在行${ast.line.join('\n')}`)
    if(type_(ast.value.type,ast.data.type,scope))return
    if(cast(ast,scope,ast.data.type))return
    scope.thr(`赋值类型错误在行${ast.line.join('\n')}`)
}
const Label_ThrowOrReturnOrExprCommand:slang_check_visitor=(ast:Throw|Return|ExprCommand,scope,call)=>{
    call(ast.data,3)
    if(ast instanceof Return&&!type_(ast.data==null?null:ast.data.type,scope.get('return'),scope))
        scope.thr(`返回类型错误在行${ast.line.join('\n')}`)
    if(ast instanceof Throw){
        const throw_type:Type=scope.get('throw')
        if(throw_type==null)
            scope.thr(`抛出异常没有try-catch在行${ast.line.join('\n')}`)
        else if(!type_(ast.data==null?null:ast.data.type,throw_type,scope))
            scope.thr(`抛出异常类型错误在行${ast.line.join('\n')}`)
    }
    if(ast instanceof ExprCommand)call(ast.data,3)
}
const Label_VarDecl:slang_check_visitor=(ast:VarDecl,scope,call)=>{
    call(ast.value,3)
    call(ast.t,3)
    ast.type=real_type(ast.t,scope)
    scope.set(ast.name,ast)
    if(ast.t instanceof VoidType)scope.thr(`变量${ast.name}声明类型为void,在行${ast.line.join('\n')}`)
    if(ast.value==null)return
    if(operation('=',ast,scope,to_point(ast.t),to_point(ast.value.type)))return
    if(type_(ast.value.type,ast.t,scope))return
    if(cast(ast,scope,ast.t))return
    scope.thr(`赋值类型错误在行${ast.line.join('\n')}`)
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
    for(const i of ast.case_list){
        call(i.condition,3)
        if(!type_(i.condition==null?null:i.condition.type,ast.condition.type,scope))
            scope.thr(`switch case的类型和switch的类型不一致,在行${ast.line.join('\n')}`)
        scope=scope.enter()
        call(i.commands,3)
        scope=scope.leave()
    }
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
    const type=real_type(ast.data==null?null:ast.data.type,scope)
    const vd=new VarDecl(ast.iden,new VoidType(),new NullLiteral(null))
    if(type instanceof MapType||type instanceof ArrayType)vd.t=type.t
    cast(vd,scope,new ArrayType(new VoidType()))
    if(vd.t instanceof VoidType)cast(vd,scope,new MapType(new VoidType()))
    scope.set(ast.iden,vd)
    call(ast.commands,3)
    scope=scope.leave()
}
const Label_TryStatement:slang_check_visitor=(ast:TryStatement,scope,call)=>{
    scope=scope.enter()
    call(ast.catch_.type,3)
    scope.set('throw',real_type(ast.catch_.type,scope))
    call(ast.commands,3)
    scope=scope.leave()
    scope=scope.enter()
    const ct=real_type(ast.catch_.type,scope)
    const cv=new VarDecl(ast.catch_.iden,ct,new NullLiteral(null))
    cv.type=ct
    scope.set(ast.catch_.iden,cv)
    call(ast.catch_.command,3)
    scope=scope.leave()
    scope=scope.enter()
    call(ast.finally_,3)
    scope=scope.leave()
}
const Label_VM:slang_check_visitor=(ast:VM,scope,call)=>{
    for(const i of ast.param)
        call(i,3)
}
const Label_TernaryExpression:slang_check_visitor=(ast:TernaryExpression,scope,call)=>{
    call(ast.condition,3)
    call(ast.trueExpr,3)
    call(ast.falseExpr,3)
    const merge=type_merge(real_type(ast.trueExpr.type,scope),real_type(ast.falseExpr.type,scope),scope)
    //falseExpr能不能期望到trueExpr
    if(merge instanceof VoidType&&!cast(ast.falseExpr,scope,ast.trueExpr.type))
        scope.thr(`三元运算符的true/false表达式不是同一类型,在行${ast.line.join('\n')}`)
}
const Label_BinaryExpression:slang_check_visitor=(ast:BinaryExpression,scope,call)=>{
    call(ast.left,3)
    call(ast.right,3)
    let oper:string=''
    for(const [k,v] of Operation_Binary)
        if(ast instanceof k)oper=v
    if(operation(oper,ast,scope,new VoidType(),to_point(ast.left.type),to_point(ast.right.type)))return
    const number_oper=['+','-','*','/','%','&','|','^','>>','<<']
    const is_number=number_oper.includes(oper)
    ast.type=is_number?new NumberType():new BooleanType()
    if(!(ast.left.type.constructor==ast.type.constructor)){
        cast(ast.left,scope,ast.type)
        return
    }
    if(!(ast.right.type.constructor==ast.type.constructor)){
        cast(ast.right,scope,ast.type)
        return
    }
    scope.thr(`二元运算符${oper}的类型错误在行${ast.line.join('\n')}`)
}
const Label_IncrementOrDecrementPostfixOrPrefix:slang_check_visitor=(ast:IncrementPostfix|DecrementPostfix|IncrementPrefix|DecrementPrefix,scope,call)=>{
    call(ast.expr,3)
    ast.type=new NumberType()
    if(ast instanceof PostfixExpression){
        if(ast instanceof IncrementPostfix&&operation('++',ast,scope,new NumberType(),to_point(ast.expr.type),new NumberType()))return
        if(ast instanceof DecrementPostfix&&operation('--',ast,scope,new NumberType(),to_point(ast.expr.type),new NumberType()))return
    }
    if(ast instanceof PrefixExpression){
        if(ast instanceof IncrementPrefix&&operation('++',ast,scope,new NumberType(),to_point(ast.expr.type)))return
        if(ast instanceof DecrementPrefix&&operation('--',ast,scope,new NumberType(),to_point(ast.expr.type)))return
    }
    if(real_type(ast.expr.type,scope) instanceof NumberType)return
    if(cast(ast.expr,scope,new NumberType()))return
    scope.thr(`++/--只能用于number类型在行${ast.line.join('\n')}`)
}
const Label_MemberPostfix:slang_check_visitor=(ast:MemberPostfix,scope,call)=>{
    call(ast.expr,3)
    const type=real_type(ast.expr.type,scope)
    if(type instanceof BlockType){
        const block=scope.get(localToName(type.local)) as Block
        if(block==null)scope.thr(`未定义的块${type.local.join('.')}`)
        if(block instanceof Enum&&block.children.includes(ast.name))
            ast.type=new EnumType(type.local)
        if(block instanceof Module||block instanceof Class||block instanceof Interface&&
            block.children.find(i=>i.name==ast.name&&i.modifiers.unstatic&&(type._this||!i.modifiers._private)))
            ast.type=new BlockType([...type.local,ast.name])
        return
    }
    if(type instanceof ClassType){
        const block=scope.get(localToName(type.local)) as Class|Interface
        const field=block.children.find(i=>i.name==ast.name&&i.modifiers.unstatic&&
            (type._this||!i.modifiers._private))
        if(field!=null)ast.type=field.type
        return
    }
    scope.thr(`${ast.name}不存在,在行${ast.line.join('\n')}`)
}
const Label_IndexPostfix:slang_check_visitor=(ast:IndexPostfix,scope,call)=>{
    call(ast.expr,3)
    call(ast.index,3)
    const expr_type=real_type(ast.expr.type,scope)
    const index_type=real_type(ast.index.type,scope)
    if(operation('[]',ast,scope,new VoidType(),to_point(expr_type),to_point(index_type)))return
    const expr_cast_map=cast(ast.expr,scope,new MapType(new VoidType()))
    const expr_cast_string=cast(ast.expr,scope,new StringType())
    const expr_cast_array=cast(ast.expr,scope,new ArrayType(new VoidType()))
    const index_cast_string=cast(ast.index,scope,new StringType())
    const index_cast_number=cast(ast.index,scope,new NumberType())
    if(expr_type instanceof StringType||expr_type instanceof ArrayType){
        if(index_type instanceof NumberType)return
        if(index_cast_number)return
        scope.thr(`string/array的索引只能是number在行${ast.line.join('\n')}`)
    }
    if(expr_type instanceof MapType){
        if(index_type instanceof StringType)return
        if(index_cast_string)return
        scope.thr(`map的索引只能是string在行${ast.line.join('\n')}`)
    }
    if(index_type instanceof NumberType){
        if(expr_cast_array)return
        if(expr_cast_string)return
        scope.thr(`number类型的索引只能用于string/array在行${ast.line.join('\n')}`)
    }
    if(index_type instanceof StringType){
        if(expr_cast_map)return
        scope.thr(`string类型的索引只能用于map在行${ast.line.join('\n')}`)
    }
    //两个不知名奇葩类型,需要尝试组合
    if(expr_cast_map&&index_cast_string)return
    if(expr_cast_array&&index_cast_number)return
    if(expr_cast_string&&index_cast_number)return
}
const Label_ArgumentsPostfix:slang_check_visitor=(ast:ArgumentsPostfix,scope,call)=>{
    call(ast.expr,3)
    for(const i of ast.generic)
        call(i,3)
    for(const i of ast.args)
        call(i,3)
    if(operation('()',ast,scope,new VoidType(),to_point(ast.expr.type),...ast.args.map(i=>i.type)))return
    if(ast.expr.type instanceof BlockType){
        ast.expr=new IdentifierExpr(ast.expr.type.local[0])
        for(let i=1;i<ast.expr.type['local'].length;i++)
            ast.expr=new MemberPostfix(ast.expr,ast.expr.type['local'][i])
        ast.expr=new MemberPostfix(ast.expr,'constructor')
        ast.cons=true
        ast.local=ast.expr.type['local']
        call(ast,3)
        return
    }
    if(ast.expr.type instanceof LambdaType){
        if(!ast.expr.type.overload){
            if(!generic_is(ast.generic,ast.expr.type.generic,scope))
                scope.thr(`generic参数类型错误,在行${ast.line.join('\n')}`)
            if(!param_is(ast.args.map(i=>i.type),ast.expr.type.params,scope))
                scope.thr(`参数类型错误,在行${ast.line.join('\n')}`)
            ast.type=ast.expr.type.returnType
            return
        }
        const func=scope.get_overload(ast.expr.type.name)
            .filter(i=>param_is(ast.args.map(i=>i.type),i.params,scope))
            .filter(i=>generic_is(ast.generic,i.generic,scope))
        if(func.length==0)scope.thr(`名称为${ast.expr.type.name}的函数没有符合generic和param的重载在行${ast.line.join('\n')}`)
        if(func.length>1)
            func[0]=func[pick_best(scope,func.map(i=>Array.from(i.params.values())),ast.args.map(i=>i.type))]
        ast.type=func[0].return_type
        ast.call_target=ast.expr.type.name+'@'+func[0].index
        return
    }
    const cast_=cast_get(ast.expr.type,scope)
        .filter(i=>i.type instanceof LambdaType&&
        param_is(ast.args.map(i=>i.type),i.type.params,scope)&&
        generic_is(ast.generic,i.type.generic,scope))
    if(cast_.length==0)scope.thr(`没有符合generic和param的Lambda类型转换`)
    if(cast_.length>1)
        cast_[0]=cast_[pick_best(scope,cast_.map(i=>Array.from((<LambdaType>i.type).params.values())),ast.args.map(i=>i.type))]
    ast.expr.cast=cast_[0].id
    ast.type=(<LambdaType>cast_[0].type).returnType
}
const Label_ReferencePrefix:slang_check_visitor=(ast:ReferencePrefix,scope,call)=>{
    call(ast.expr,3)
    if(operation('*',ast,scope,new VoidType(),to_point(ast.expr.type)))return
    if(real_type(ast.expr.type,scope) instanceof PointType)return
    if(cast(ast.expr,scope,new PointType(new VoidType())))return
    ast.type=(<PointType>real_type(ast.expr.type,scope)).t
    scope.thr(`引用操作符只能用于指针类型在行${ast.line.join('\n')}`)
}
const Label_AddressPrefix:slang_check_visitor=(ast:AddressPrefix,scope,call)=>{
    call(ast.expr,3)
    if(operation('&',ast,scope,new VoidType(),to_point(ast.expr.type)))return
    ast.type=new PointType(ast.expr.type)
}
const Label_BitNotPrefix:slang_check_visitor=(ast:BitNotPrefix,scope,call)=>{
    call(ast.expr,3)
    ast.type=new NumberType()
    if(operation('~',ast,scope,new VoidType(),to_point(ast.expr.type)))return
    if(real_type(ast.expr.type,scope) instanceof NumberType)return
    if(cast(ast.expr,scope,new NumberType()))return
    scope.thr(`位非操作符只能用于number类型在行${ast.line.join('\n')}`)
}
const Label_NotPrefix:slang_check_visitor=(ast:NotPrefix,scope,call)=>{
    call(ast.expr,3)
    ast.type=new BooleanType()
    if(operation('!',ast,scope,new VoidType(),to_point(ast.expr.type)))return
    if(real_type(ast.expr.type,scope) instanceof BooleanType)return
    if(cast(ast.expr,scope,new BooleanType()))return
    scope.thr(`非操作符只能用于boolean类型在行${ast.line.join('\n')}`)
}
const Label_TypePrefix:slang_check_visitor=(ast:TypePrefix,scope,call)=>{
    ast.type=ast.t
    call(ast.t,3)
    call(ast.expr,3)
    if(cast(ast.expr,scope,ast.t))return
    scope.thr(`类型转换失败,在行${ast.line.join('\n')}`)
}
const Label_NewPrefix:slang_check_visitor=(ast:NewPrefix,scope,call)=>{
    call(ast.expr,3)
    if(operation('new',ast,scope,new VoidType(),to_point(ast.expr)))return
    if(ast.expr instanceof ArgumentsPostfix&&ast.expr.cons){
        ast.type=new ClassType(ast.expr.local,ast.expr.generic)
        return
    }
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
        call(i,3)
    let type:Type=new VoidType()
    for(const i of ast.elements)
        type=type_merge(type,i.type,scope)
    ast.type=new ArrayType(type)
}
const Label_MapExpression:slang_check_visitor=(ast:MapExpression,scope,call)=>{
    for(const i of ast.elements.values())
        call(i,3)
    let type:Type=new VoidType()
    for(const [,i] of ast.elements)
        type=type_merge(type,i.type,scope)
    ast.type=new MapType(type)
}
const Label_LambdaExpression:slang_check_visitor=(ast:LambdaExpression,scope,call)=>{
    scope=scope.enter()
    for(const [k,v] of ast.generic)
        scope.set_generic(k,v)
    for(const v of ast.generic.values())call(v,3)
    for(const v of ast.params.values())call(v,3)
    call(ast.body,3)
    call(ast.ret,3)
    ast.type=new LambdaType(ast.generic,ast.params,ast.ret)
    scope=scope.leave()
}
const Label_Literal:slang_check_visitor=(ast:Literal,scope,call)=>{
    if(ast instanceof NumberLiteral)ast.type=new NumberType()
    if(ast instanceof StringLiteral)ast.type=new StringType()
    if(ast instanceof BooleanLiteral)ast.type=new BooleanType()
    if(ast instanceof NullLiteral)ast.type=new VoidType()
}
const Label_FixType:slang_check_visitor=(ast:FixType,scope,call)=>{
    call(ast.t,3)
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
export const Round3=new Map<any,slang_check_visitor>([
    [IdentifierExpr,Label_IdentifierExpression],
    [ArrayExpression,Label_ArrayExpression],
    [MapExpression,Label_MapExpression],
    [LambdaExpression,Label_LambdaExpression],
    [FixType,Label_FixType],
    [ClassType,Label_ClassType],
    [EnumType,Label_EnumType],
    [File,Label_File],
    [ArgumentsPostfix,Label_ArgumentsPostfix],
    [ReferencePrefix,Label_ReferencePrefix],
    [AddressPrefix,Label_AddressPrefix],
    [BitNotPrefix,Label_BitNotPrefix],
    [NotPrefix,Label_NotPrefix],
    [TypePrefix,Label_TypePrefix],
    [NewPrefix,Label_NewPrefix],
    [MemberPostfix,Label_MemberPostfix],
    [IndexPostfix,Label_IndexPostfix],
    [IncrementPostfix,Label_IncrementOrDecrementPostfixOrPrefix],
    [DecrementPostfix,Label_IncrementOrDecrementPostfixOrPrefix],
    [IncrementPrefix,Label_IncrementOrDecrementPostfixOrPrefix],
    [DecrementPrefix,Label_IncrementOrDecrementPostfixOrPrefix],
    [Module,Label_Module],
    [ListCommand,Label_ListCommand],
    [WhileStatement,Label_WhileOrDoWhileStatement],
    [DoWhileStatement,Label_WhileOrDoWhileStatement],
    [ForStatement,Label_ForStatement],
    [TryStatement,Label_TryStatement],
    [Class,Label_ClassOrInterface],
    [Interface,Label_ClassOrInterface],
    [Enum,Label_Enum],
    [Function,Label_Function],
    [Variable,Label_Variable],
    [Assign,Label_Assign],
    [VarDecl,Label_VarDecl],
    [Throw,Label_ThrowOrReturnOrExprCommand],
    [Return,Label_ThrowOrReturnOrExprCommand],
    [ExprCommand,Label_ThrowOrReturnOrExprCommand],
    [IfStatement,Label_IfStatement],
    [SwitchStatement,Label_SwitchStatement],
    [ForeachStatement,Label_ForeachStatement],
    [TernaryExpression,Label_TernaryExpression],
    [BinaryExpression,Label_BinaryExpression],
    [Await,Label_Await],
    [Literal,Label_Literal],
    [VM,Label_VM]
])