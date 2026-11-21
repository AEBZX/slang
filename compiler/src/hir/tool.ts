import {PeepholeScope} from '../utils/lib/tool'
import {ASTTree, Block, Class, Expression, HIRTree, IdentifierExpr, Interface, MemberPostfix, Module} from '../utils'
export type slang_hir_visitor =(node:ASTTree, scope:HScope, call:(node:ASTTree)=>HIRTree)=>HIRTree
export class HScope extends PeepholeScope{
    public index:number=1
    public link:Map<string,string>=new Map()
    public symbol:Map<string,number>=new Map()
    public unstatic_mark:number[]=[]
    public label:Map<string,number>=new Map()
    public global:HScope
    public parent:HScope
    public path=''
    constructor(parent:HScope,global:HScope,path:string='') {
        super(parent,global)
        this.path=path
    }
    mark(id:number){
        this.unstatic_mark.push(id)
    }
    get_mark(id:number):boolean{
        return this.unstatic_mark.includes(id)||this?.parent?.get_mark(id)
    }
    label_set(name:string,id:number){
        this.label.set(name,id)
    }
    label_get(name:string):number{
        return this.label.get(name)||this?.parent?.label_get(name)
    }
    link_set(path:string,target:string){
        this.link.set(path,target)
    }
    link_get(path:string):string{
        return this.link.get(path)||this?.parent?.link_get(path)
    }
    symbol_set(name:string,id:number){
        this.symbol.set(name,id)
    }
    symbol_get(name:string):number{
        return this.symbol.get(name)||this?.parent?.symbol_get(name)||this?.global?.symbol_get(name)
    }
    id(){
        return this.index++
    }
    global_id(){
        return this.global.id()
    }
    enter():HScope{
        return new HScope(this,this.global,this.path)
    }
    leave():HScope{
        return this.parent
    }
}
//分别在全局和当前作用域进行注册
export function register(scope:HScope,block:Block[]){
    for(const i of block) {
        scope = scope.enter()
        scope.path = scope.path == '' ? i.name : scope.path + '.' + i.name
        const id=scope.global_id()
        scope.global.symbol_set(scope.path,id)
        if(i.modifiers.unstatic)
            scope.global.mark(id)
        if (i instanceof Class || i instanceof Interface || i instanceof Module)
            register(scope, i.children)
        scope = scope.leave()
    }
    const run=(path:string,_block:Block[])=>{
        for(const i of _block) {
            const _path = path == '' ? i.name : path + '.' + i.name
            const id=scope.global_id()
            scope.symbol_set(_path, id)
            if(i.modifiers.unstatic)
                scope.mark(id)
            if (i instanceof Class || i instanceof Interface || i instanceof Module)
                run(_path, i.children)
        }
    }
    run('',block)
}
//如果是a.b.c.d.(...)的形式返回这个链,否则返回null
export function member_visit(member:Expression):string[]{
    if(!(member instanceof MemberPostfix||member instanceof IdentifierExpr))return null
    if(member instanceof MemberPostfix&&!(member.expr instanceof MemberPostfix||member.expr instanceof IdentifierExpr))return null
    if(member instanceof IdentifierExpr)return [member.name]
    return [...member_visit(member.expr),member.name]
}