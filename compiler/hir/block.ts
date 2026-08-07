import {BlockType, Class, File, HClass, hir_visitor, HModule, HScope, HVariable, Module, Variable} from '../utils'
export const H_Module:hir_visitor=(node:Module,scope,call)=>{
    let id=scope.id()
    scope.set((node.type as BlockType).local.join('.'),id)
    scope=scope.enter()
    let children=node.children.map(i=>call(i)) as HModule[]
    scope=scope.leave()
    return new HModule(id,children)
}
export const H_Class:hir_visitor=(node:Class,scope,call)=>{
    let id=scope.id()
    scope.set((node.type as BlockType).local.join('.'),id)
    scope=scope.enter()
    let children=node.children.map(i=>call(i)) as HModule[]
    scope=scope.leave()
    return new HClass(id,children)
}
export const H_Variable:hir_visitor=(node:Variable,scope,call)=>{
    let id=scope.id()
    scope.set(node.name,id)
    return new HVariable(id,call(node.value))
}
export default new Map<any,hir_visitor>([
    [Module,H_Module],
    [Class,H_Class],
    [Variable,H_Variable],
])