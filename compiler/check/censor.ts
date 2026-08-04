import {check_visitor, Class, Module, Function, Variable, Enum, Interface, ClassType, Assign, type_merge, VoidType} from '../utils'
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
    let left=scope.get_sym(ast.data)
    let right=scope.get_sym(ast.value)
    if(type_merge(left,right,scope) instanceof VoidType)
        scope.thr(`${ast.data} is not assignable at line ${ast.line.join('\n')}`)
}
export default new Map<any,check_visitor>([
    [Class,C_Class],
    [Module,C_Module],
    [Function,C_Function],
    [Interface,C_Interface],
    [Variable,C_Variable],
    [Enum,C_Enum],
    [Assign,C_Assign]
])
