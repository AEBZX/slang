import {PeepholeScope} from '../utils/lib/tool'
import {ASTTree, Block, Class, HIRTree, Interface, Module} from '../utils'

export type slang_hir_visitor =(node:ASTTree, scope:HScope, call:(node:ASTTree)=>HIRTree)=>HIRTree
export class HScope extends PeepholeScope{
    public index:number=1
    public link:Map<string,string>=new Map()
    public symbol:Map<string,number>=new Map()
    public label:Map<string,number>=new Map()
    public global:HScope
    public parent:HScope
    public path=''
    constructor(parent:HScope,global:HScope,path:string='') {
        super(parent,global)
        this.path=path
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
        scope.global.symbol_set(scope.path, scope.global_id())
        if (i instanceof Class || i instanceof Interface || i instanceof Module)
            register(scope, i.children.filter(i => !i.modifiers.unstatic))
        scope = scope.leave()
    }
    const run=(path:string,_block:Block[])=>{
        for(const i of _block) {
            const _path = path == '' ? i.name : path + '.' + i.name
            scope.symbol_set(_path, scope.global_id())
            if (i instanceof Class || i instanceof Interface || i instanceof Module)
                run(_path, i.children.filter(i => !i.modifiers.unstatic))
        }
    }
    run('',block)
}