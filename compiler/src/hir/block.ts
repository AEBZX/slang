import {slang_hir_visitor} from './tool'
import {Class, File, hir_visitor, HModule, HVariable, Module, Variable} from '../utils'
const H_File:slang_hir_visitor=(node:File,scope,call)=>{
    for(const i of node.links)
        scope.link_target.set(i.as,i.module.join('.'))
    return new HModule(null,node.children.map(i=>{
        scope.path=''
        return call(i)
    }))
}
const H_Module:slang_hir_visitor=(node:Module,scope,call)=>{
    const id=scope.id()
    const old=scope.path
    node.name=scope.path_(node.name)
    scope.set(node.name,id)
    scope=scope.enter()
    let children=node.children.map(call)
    scope=scope.leave()
    scope.path=old
    return new HModule(id,children)
}
const H_Variable:slang_hir_visitor=(node:Variable,scope,call)=>{
    const id=scope.id()
    const old=scope.path
    node.name=scope.path_(node.name)
    scope.set(node.name,id)
    const ret=new HVariable(id,call(node.value),node.name.split('.').pop()!.split('@')[0]=='main',!node.modifiers.unstatic)
    scope.path=old
    return ret
}
const H_Class:slang_hir_visitor=(node:Class,scope,call)=>{
    const id=scope.id()
    const old=scope.path
    node.name=scope.path_(node.name)
    scope.set(node.name,id)
    scope=scope.enter()
    let children=node.children.map(call)
    scope=scope.leave()
    scope.path=old
    return new HModule(id,children)
}
export default new Map<any,hir_visitor>([
    [File,H_File],
    [Module,H_Module],
    [Variable,H_Variable],
    [Class,H_Class]
])