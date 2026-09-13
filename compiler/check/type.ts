//round:类型检查
import {BlockType, Class, ClassType, Enum, File, Function, Interface, LambdaType, Module} from '../utils'
import {slang_check_visitor} from './tool'
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