import {Block, BlockType, Class, File, Interface, Module, Scope} from '../utils'
export default function symbol(data:File[],scope:Scope){
    //重名检测
    let _name=(d:Class|Module|Interface|File)=>{
        for(let i of d.children){
            if(scope.data.get(i.name)){
                let block=scope.data.get(i.name)
                //合并当作一个检查
                if(block instanceof Module&&i instanceof Module){
                    if(block.modifiers!=i.modifiers)
                        scope.thr(`${block.name} and ${i.name} modifier not equal at line ${block.line.join('\n')}`)
                    block.children.forEach(v=>i.children.push(v))
                    scope.set(i.name,i)
                    let block_type=new BlockType(i.name.split('.'))
                    scope.sym(i,block_type)
                    i.type=block_type
                }else
                    scope.thr(`${i.name} is defined at line ${block.line.join('\n')}`)
                continue
            }
            scope.set(i.name,i)
            let block_type=new BlockType(i.name.split('.'))
            scope.sym(i,block_type)
            i.type=block_type
            for(let j of d.children.filter(v=>v instanceof Class||
            v instanceof Interface||v instanceof Module||v instanceof File)) {
                scope=scope.enter()
                _name(j)
                scope=scope.leave()
            }
        }
    }
    //扫描所有static
    let _static=(d:Class|Module|Interface|File,name:string)=>{
        if('name' in d)
            name=name?name+'.'+d.name:d.name
        for(let i of d.children){
            if(!i.modifiers.unstatic){
                let static_name='name' in i?(name?name+'.'+i.name:i.name):name
                scope.global.set(static_name,i)
                let block_type=new BlockType(static_name.split('.'))
                scope.global.sym(i,block_type)
                i.type=block_type
            }
            if(i instanceof Class||i instanceof Interface||i instanceof File)
                _static(i,name)
        }
    }
    //link处理
    let link=()=>{
        for(let i of data){
            scope=scope.enter()
            i.links.forEach(v=>{
                if(!scope.get(v.module.join('.')))
                    scope.thr(`${v.module.join('.')} not found at line ${i.line.join('\n')}`)
                else scope.set(v.as,scope.get(v.module.join('.')))
            })
            scope=scope.leave()
        }
    }
    let chain=(father:string,child:string)=>{
        scope.chain.set(father,[...(scope.chain.get(father)||[]),child])
        //如果child是father的子,那么也是grandfather的子
        let has=false,grand_father=''
        scope.chain.forEach((v,k)=>{
            if(k!=father&&v.includes(child)){
                has=true
                grand_father=k
            }
        })
        if(has)
            chain(grand_father,child)
    }
    //预操作
    let _pre=(d:Class|Interface)=>{
        if(d.implement.length==0)return
        if(!scope.get(d.implement.join('.'))){
            scope.thr(`${d.name} implement ${d.implement} not found at line ${d.line.join('\n')}`)
            return
        }
        let impl=scope.get(d.implement.join('.'))
        if(!(impl instanceof Interface)){
            scope.thr(`${d.name} implement ${d.implement} is not interface at line ${d.line.join('\n')}`)
            return
        }
        chain(d.implement.join('.'),d.name)
    }
    for(let i of data)
        _name(i)
    link()
    for(let i of data)
        _static(i,'')
    let ls=(d:Class|Interface|File|Module)=>{
        for(let i of d.children)
            if(i instanceof Class||i instanceof Interface)
                _pre(i)
        for(let i of d.children)
            if(i instanceof Class||i instanceof Interface||i instanceof File||i instanceof Module)
                ls(i)
    }
    for(let i of data)
        ls(i)
}