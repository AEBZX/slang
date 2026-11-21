import {slang_hir_visitor,register} from './tool'
import {Module, File, HModule, Class, Variable, Interface, HVariable} from '../utils'
const H_File:slang_hir_visitor=(node:File,scope,call)=>{
    scope=scope.enter()
    for(const link of node.links)
        scope.link_set(link.as,link.module.join('.'))
    //提前注册
    register(scope,node.children)
    const module=node.children.map(call)
    scope=scope.leave()
    return new HModule(scope.global_id(),module)
}
const H_Module:slang_hir_visitor=(node:Module,scope,call)=>{
    scope=scope.enter()
    register(scope,node.children)
    scope.symbol_set('up',scope.symbol_get(node.name))
    const block=node.children.map(call)
    scope=scope.leave()
    //register在上一轮已经在作用域注册
    return new HModule(scope.symbol_get(node.name),block)
}
const H_Class_Interface:slang_hir_visitor=(node:Class|Interface,scope,call)=>{
    scope=scope.enter()
    register(scope,node.children)
    const block=node.children.map(call)
    scope=scope.leave()
    return new HModule(scope.symbol_get(node.name),block)
}
const H_Variable:slang_hir_visitor=(node:Variable,scope,call)=>{
    scope=scope.enter()
    const value=call(node.value)
    scope=scope.leave()
    return new HVariable(scope.symbol_get(node.name),value)
}