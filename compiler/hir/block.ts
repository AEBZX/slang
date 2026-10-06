import {slang_hir_visitor} from './tool'
import {Class, File, hir_visitor, HModule, HVariable, Module, Variable} from '../utils'
const H_File:slang_hir_visitor=(node:File,scope,call)=>{
    for(const i of node.links)
        scope.link_target.set(i.as,i.module.join('.'))
    return new HModule(null,node.children.map(call))
}
const H_Module:slang_hir_visitor=(node:Module,scope,call)=>{
    const id=scope.id()
    node.name=scope.path_(node.name)
    scope.set(node.name,id)
    return new HModule(id,node.children.map(call))
}
const H_Variable:slang_hir_visitor=(node:Variable,scope,call)=>{
    const id=scope.id()
    node.name=scope.path_(node.name)
    scope.set(node.name,id)
    return new HVariable(id,call(node.value),node.name.split('.')[node.name.split('.').length-1]=='main')
}
const H_Class:slang_hir_visitor=(node:Class,scope,call)=>{
    const id=scope.id()
    node.name=scope.path_(node.name)
    scope.set(node.name,id)
    return new HModule(id,node.children.map(call))
}
export default new Map<any,hir_visitor>([
    [File,H_File],
    [Module,H_Module],
    [Variable,H_Variable],
    [Class,H_Class]
])