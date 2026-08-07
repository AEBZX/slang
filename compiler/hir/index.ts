import expr from './expr'
import block from './block'
import command from './command'
import {HIR, File, Block, Module, Class, HBlock} from '../utils'
export default function (data:File[]):[number,HBlock[]]{
    let map=new Map([...expr,...block,...command])
    return HIR(data,map,(node,scope)=>{
        //所有Static都放到全局作用域
        let g=(name:string,data:Block)=>{
            name=name+'.'+data.name
            scope.global.set(name,scope.id())
            if(data instanceof Module||data instanceof Class||data instanceof File)
                data.children.filter(v=>v instanceof Module||v instanceof Class).forEach(v=>g(name,v))
        }
        data.forEach(v=>v.children.forEach(i=>g(i.name,i)))
    },(node,scope)=>{
        node.links.forEach(v=>{
            let id=scope.id()
            scope.set(v.as,id)
            scope.lnk(id,scope.get(v.module.join('.')))
        })
    })
}