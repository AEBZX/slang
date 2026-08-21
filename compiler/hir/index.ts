import expr from './expr'
import block from './block'
import command from './command'
import {HIR, File, Block, Module, Class, HBlock} from '../utils'
export default function (data:File[]):[number,HBlock[]]{
    let map=new Map([...expr,...block,...command])
    return HIR(data,map,(node,scope)=>{
        //预注册所有块(函数/类/模块/变量)的符号id:visit 按文件顺序执行,
        //引用方文件先被访问时目标块尚未注册,scope.get 返回 null → 调用目标为 null,
        //多文件/前向引用(如 main.sl 调用 mathlib.sl 的函数)在 VM 上静默失效或死循环
        //此前注册键为 name.name('fib.fib')且只递归 Module/Class,顶层函数引用解析不到
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
        })
    })
}