import {
    Assign,
    BooleanType,
    Break,
    Call,
    check_visitor,
    Class,
    ClassType,
    Continue,
    Decrement,
    DoWhileStatement,
    Enum,
    FixType,
    ForStatement,
    ForeachStatement,
    Function,
    IfStatement,
    Increment,
    Interface,
    Module,
    NumberType,
    Return,
    SwitchStatement,
    Throw,
    TryStatement,
    type_merge,
    Type,
    Variable,
    VarDeclaration,
    VM,
    VoidType,
    WhileStatement, PostfixExpression, ArgumentsPostfix, ArrayFix, MapFix
} from '../utils'
//各种模块
const C_Class:check_visitor=(ast:Class,scope,call)=>{
    for(let i of ast.children)
        if(i instanceof Module)
            scope.thr(`${ast.name} is class at line ${ast.line.join('\n')}`)
    for(let i of ast.children) {
        scope=scope.enter()
        //增加指向自己的up
        scope.set('up',new ClassType([ast.name]))
        call(i,scope)
        scope=scope.leave()
    }
}
const C_Module:check_visitor=(ast:Module,scope,call)=>{
    for(let i of ast.children) {
        scope=scope.enter()
        call(i,scope)
        scope=scope.leave()
    }
}
const C_Function:check_visitor=(ast:Function,scope,call)=>{
    scope=scope.enter()
    for(let [k,v] of ast.params){
        scope.set(k,v)
        scope.sym(v,v)
    }
    //作为返回值,用户绝对不可能命名出关键字
    scope.set('return',ast.return_type)
    scope.sym(ast.return_type,ast.return_type)
    call(ast.commands,scope)
    scope=scope.leave()
}
const C_Interface:check_visitor=(ast:Class,scope,call)=>{
    for(let i of ast.children)
        if(!(i instanceof Function||i instanceof Variable))
            scope.thr(`${ast.name} is interface at line ${ast.line.join('\n')}`)
    for(let i of ast.children)
        call(i,scope)
}
const C_Variable:check_visitor=(ast:Variable,scope,call)=>{
    scope.set(ast.name,ast.t)
    scope.sym(ast.t,ast.t)
    call(ast.value,scope)
}
const C_Enum:check_visitor=(ast:Class,scope,call)=>{
    let x=[]
    for(let i of ast.children){
        if(x.includes(i))
            scope.thr(`${ast.name} is enum at line ${ast.line.join('\n')}`)
        x.push(i)
    }
}
//各种命令
const C_Assign:check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,scope)
    call(ast.value,scope)
    let left=scope.get_sym(ast.data)
    let right=scope.get_sym(ast.value)
    if(type_merge(left,right,scope) instanceof VoidType)
        scope.thr(`${ast.data} is not assignable at line ${ast.line.join('\n')}`)
}
const C_VarDeclaration:check_visitor=(ast:VarDeclaration,scope,call)=>{
    if(scope.get(ast.name))
        scope.thr(`${ast.name} is already defined at line ${ast.line.join('\n')}`)
    scope.set(ast.name,ast.t)
    scope.sym(ast,ast.t)
    if(ast.value){
        call(ast.value,scope)
        let value_type=scope.get_sym(ast.value)
        if(type_merge(value_type,ast.t,scope)!=ast.t)
            scope.thr(`${ast.name} is not assignable at line ${ast.line.join('\n')}`)
    }
}
const C_Call:check_visitor=(ast:Call,scope,call)=>{
    call(ast.data,scope)
    if(!(ast.data instanceof PostfixExpression))
        scope.thr(`${ast.data} is not callable at line ${ast.line.join('\n')}`)
    let ls=ast.data as PostfixExpression
    if(!(ls.postfix[ls.postfix.length-1] instanceof ArgumentsPostfix))
        scope.thr(`${ast.data} is not callable at line ${ast.line.join('\n')}`)
}
const C_Return:check_visitor=(ast:Return,scope,call)=>{
    let ret=scope.get('return')
    if(ret&&ast.data){
        call(ast.data,scope)
        let ret_type=scope.get_sym(ret)
        let data_type=scope.get_sym(ast.data)
        if(type_merge(data_type,ret_type,scope) instanceof VoidType)
            scope.thr(`return type mismatch at line ${ast.line.join('\n')}`)
    }
}
const C_Break:check_visitor=(ast:Break,scope,call)=>{
    if(!scope.get('while'))
        scope.thr(`break outside loop at line ${ast.line.join('\n')}`)
}
const C_Continue:check_visitor=(ast:Continue,scope,call)=>{
    if(!scope.get('while'))
        scope.thr(`continue outside loop at line ${ast.line.join('\n')}`)
}
const C_Throw:check_visitor=(ast:Throw,scope,call)=>{
    call(ast.data,scope)
    let t=scope.get_sym(ast.data)
    let _t:Type=scope.get('throw')
    if(!_t)
        scope.thr(`throw without catch at line ${ast.line.join('\n')}`)
    if(type_merge(t,_t,scope)!=_t)
        scope.thr(`throw type mismatch at line ${ast.line.join('\n')}`)
}
//TODO IR暂未实现,先对%Identifier进行处理
const C_VM:check_visitor=(ast:VM,scope,call)=>{
    let data=ast.data.split('.').filter(i=>i.startsWith('%'))
    for(let i of data)
        if(!scope.get(i.substring(1)))
            scope.thr(`${i} is not defined at line ${ast.line.join('\n')}`)
}
const C_Increment:check_visitor=(ast:Increment,scope,call)=>{
    call(ast.data,scope)
    let t=scope.get_sym(ast.data)
    if(!(t instanceof NumberType))
        scope.thr(`++ can only be applied to number at line ${ast.line.join('\n')}`)
}
const C_Decrement:check_visitor=(ast:Decrement,scope,call)=>{
    call(ast.data,scope)
    let t=scope.get_sym(ast.data)
    if(!(t instanceof NumberType))
        scope.thr(`-- can only be applied to number at line ${ast.line.join('\n')}`)
}
const C_IfStatement:check_visitor=(ast:IfStatement,scope,call)=>{
    let t=scope.get_sym(ast.condition)
    call(ast.condition,scope)
    if(!(t instanceof BooleanType))
        scope.thr(`condition is not boolean at line ${ast.line.join('\n')}`)
    call(ast.commands,scope)
    if(ast.else_)
        call(ast.else_,scope)
}
const C_WhileStatement:check_visitor=(ast:WhileStatement,scope,call)=>{
    call(ast.condition,scope)
    let t=scope.get_sym(ast.condition)
    if(!(t instanceof BooleanType))
        scope.thr(`condition is not boolean at line ${ast.line.join('\n')}`)
    scope=scope.enter()
    scope.set('while',new VoidType())
    call(ast.commands,scope)
    scope=scope.leave()
}
const C_DoWhileStatement:check_visitor=(ast:DoWhileStatement,scope,call)=>{
    scope=scope.enter()
    scope.set('while',new VoidType())
    call(ast.commands,scope)
    scope=scope.leave()
    call(ast.condition,scope)
    let t=scope.get_sym(ast.condition)
    if(!(t instanceof BooleanType))
        scope.thr(`condition is not boolean at line ${ast.line.join('\n')}`)
}
const C_ForStatement:check_visitor=(ast:ForStatement,scope,call)=>{
    scope=scope.enter()
    scope.set('while',new VoidType())
    for(let i of ast.init)
        call(i,scope)
    call(ast.condition,scope)
    let t=scope.get_sym(ast.condition)
    if(!(t instanceof BooleanType))
        scope.thr(`condition is not boolean at line ${ast.line.join('\n')}`)
    for(let s of ast.step)
        call(s,scope)
    call(ast.commands,scope)
    scope=scope.leave()
}
const C_ForeachStatement:check_visitor=(ast:ForeachStatement,scope,call)=>{
    scope=scope.enter()
    scope.set('while',new VoidType())
    call(ast.data,scope)
    let data_type=scope.get_sym(ast.data)
    let element:Type=new VoidType()
    if(data_type instanceof FixType){
        if(!(data_type.fix[data_type.fix.length-1] instanceof ArrayFix&&data_type.fix[data_type.fix.length-1] instanceof MapFix))
            scope.thr(`foreach can only be applied to array or map at line ${ast.line.join('\n')}`)
        data_type.fix.shift()
        element=data_type
    }
    scope.set(ast.iden,element)
    call(ast.commands,scope)
    scope=scope.leave()
}
const C_SwitchStatement:check_visitor=(ast:SwitchStatement,scope,call)=>{
    call(ast.condition,scope)
    let condition_type=scope.get_sym(ast.condition)
    for(let c of ast.case_list){
        call(c.condition,scope)
        let case_type=scope.get_sym(c.condition)
        if(type_merge(case_type,condition_type,scope) instanceof VoidType)
            scope.thr(`case type mismatch at line ${ast.line.join('\n')}`)
        call(c.commands,scope)
    }
    if(ast.default_)
        call(ast.default_,scope)
}
const C_TryStatement:check_visitor=(ast:TryStatement,scope,call)=>{
    scope=scope.enter()
    scope.set('throw',ast.catch_.type)
    call(ast.commands,scope)
    scope=scope.leave()
    scope=scope.enter()
    scope.set(ast.catch_.iden,ast.catch_.type)
    call(ast.catch_.command,scope)
    scope=scope.leave()
    if(ast.finally_)
        call(ast.finally_,scope)
}
export default new Map<any,check_visitor>([
    [Class,C_Class],
    [Module,C_Module],
    [Function,C_Function],
    [Interface,C_Interface],
    [Variable,C_Variable],
    [Enum,C_Enum],
    [Assign,C_Assign],
    [VarDeclaration,C_VarDeclaration],
    [Call,C_Call],
    [Return,C_Return],
    [Break,C_Break],
    [Continue,C_Continue],
    [Throw,C_Throw],
    [VM,C_VM],
    [Increment,C_Increment],
    [Decrement,C_Decrement],
    [IfStatement,C_IfStatement],
    [WhileStatement,C_WhileStatement],
    [DoWhileStatement,C_DoWhileStatement],
    [ForStatement,C_ForStatement],
    [ForeachStatement,C_ForeachStatement],
    [SwitchStatement,C_SwitchStatement],
    [TryStatement,C_TryStatement]
])
