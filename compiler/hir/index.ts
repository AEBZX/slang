import expr from './expr'
import block from './block'
import command from './command'
import {HIR, File, Block, Module, Class, HBlock} from '../utils'
export default function (data:File[]):[number,HBlock[]]{
    let map=new Map([...expr,...block,...command])
    return HIR(data,map,(node,scope)=>{
        //预注册所有块(函数/类/模块/变量)的符号id:visit 按文件顺序执行
        let walk=(path:string,data:Block)=>{
            let abs=path?path+'.'+data.name:data.name
            let id=scope.id()
            scope.global.set(abs,id)
            //H_Variable 以普通名复用(H_Class/H_Module 以点路径复用,顶层两者相同)
            scope.global.set(data.name,id)
            if(data instanceof Module||data instanceof Class||data instanceof File)
                data.children.forEach(i=>walk(abs,i))
        }
        node.forEach(v=>v.children.forEach(i=>walk('',i)))
    },(node,scope)=>{
        node.links.forEach(v=>{
            let id=scope.id()
            scope.set(v.as,id)
            scope.lnk(id,scope.get(v.module.join('.')))
            scope.link_target.set(v.as,v.module.join('.'))
        })
    })
}