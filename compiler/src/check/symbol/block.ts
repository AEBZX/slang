import {
    ASTTree, BooleanType,
    Cast, Class,
    ClassType, Enum,
    Interface,
    Module,
    NullLiteral, NumberType,
    Operation, StringType,
    Value,
    VarDecl,
    Variable,
    File,
    Function
} from '../../utils'
import {build_chain, resolve_named, set_first, slang_check_visitor, verify_generics,name} from '../tool'
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
    set_first(scope,name,ast)
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
    set_first(scope,name,ast)
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
        set_first(scope,name,ast)
        scope.global.set_overload(name,ast)
    }
}
const Build_Variable:slang_check_visitor=(ast:Variable,scope,call)=>{
    let name=scope.path==''?ast.name:`${scope.path}.${ast.name}`
    if(!ast.modifiers.unstatic&&!ast.modifiers._private)
        set_first(scope,name,ast)
}
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
    //登记进当前作用域:后一个同名声明才会在 c_name 里看到前一个
    scope.set(ast.name,ast)
    scope.set(full,ast)
    if(ast.implement instanceof ClassType){
        build_chain(scope,full,ast)
        call(ast.implement,2)
        const implement=resolve_named(scope,ast.implement.local.join('.'))
        if(!(implement instanceof Interface))
            scope.thr(`implement的类型${ast.implement.local.join('.')}不是Interface,在行${ast.line.join('\n')}`)
        else if(ast instanceof Class)
            //implements 的成员必须都实现:接口里声明了函数,类里就得有同名函数
            //(接口的 implements 是"继承接口",不能要求它自己实现)
            for(const m of implement.children)
                if(m instanceof Function
                    &&!ast.children.some(c=>c instanceof Function&&c.name==m.name))
                    scope.thr(`类${ast.name}没有实现接口成员${m.name},在行${ast.line.join('\n')}`)
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
//单独export build
export const Build=new Map<any,slang_check_visitor>([
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
export const Verify=new Map<any,slang_check_visitor>([
    [File,Verify_File],
    [Module,Verify_Module],
    [Class,Verify_ClassOrInterface],
    [Interface,Verify_ClassOrInterface],
    [Enum,Verify_Enum],
    [Value,Verify_Value],
    [Operation,Verify_Operation],
    [Cast,Verify_Cast],
    [Function,Verify_Function],
    [Variable,Verify_Variable]
])
