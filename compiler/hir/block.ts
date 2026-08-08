import {BlockType, Class, File, HClass, hir_visitor, HModule, HScope, HVariable, Module, Variable} from '../utils'
export const H_Module:hir_visitor=(node:Module,scope,call)=>{
    let id=scope.id()
    scope.set((node.type as BlockType).local.join('.'),id)
    scope=scope.enter()
    let children=node.children.map(i=>call(i,scope)) as HModule[]
    scope=scope.leave()
    return new HModule(id,children)
}
export const H_Class:hir_visitor=(node:Class,scope,call)=>{
    let id=scope.id()
    scope.set((node.type as BlockType).local.join('.'),id)
    scope=scope.enter()
    //this指向当前实例,分配id并注册,成员方法内可引用
    let this_id=scope.id()
    scope.set('this',this_id)
    //up指向外层类,成员内可引用外层
    let up_local=(node.type as BlockType).local
    if(up_local.length>1)
        scope.set('up',scope.get(up_local.slice(0,-1).join('.')))
    //预注册成员id:先分配成员id,供成员方法内this.x等解析
    let class_name=(node.type as BlockType).local.join('.')
    for(let i of node.children)
        if(i instanceof Variable){
            let mid=scope.id()
            scope.set(i.name,mid)
            scope.global.set(class_name+'.'+i.name,mid)
        }
    let children=node.children.map(i=>call(i,scope)) as HModule[]
    scope=scope.leave()
    //收集constructor的id,方便IR匹配
    let constructor_id=-1
    for(let i=0;i<node.children.length;i++)
        if(node.children[i].name=='constructor'&&children[i] instanceof HVariable)
            constructor_id=(children[i] as HVariable).name
    return new HClass(id,children,constructor_id,this_id)
}
export const H_Variable:hir_visitor=(node:Variable,scope,call)=>{
    //复用类预注册的成员id
    let id=scope.get(node.name)!=null?scope.get(node.name):scope.id()
    scope.set(node.name,id)
    //第一个static的main标记为入口
    let entry=node.name=='main'&&!node.modifiers.unstatic&&!scope.global.entry
    if(entry)scope.global.entry=true
    return new HVariable(id,call(node.value,scope),node.modifiers.unstatic,entry)
}
export default new Map<any,hir_visitor>([
    [Module,H_Module],
    [Class,H_Class],
    [Variable,H_Variable],
])