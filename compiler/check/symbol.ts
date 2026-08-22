import {Block, BlockType, Class, File, Function, Interface, LambdaType, Module, Scope} from '../utils'
export default function symbol(data:File[],scope:Scope){
    //重名检测
    let _name=(d:Class|Module|Interface|File,prefix:string='')=>{
        //先注册本层所有 block(含成员),再递归一次子 block,避免重复处理
        for(let i of d.children){
            let abs_name=prefix?prefix+'.'+i.name:i.name
            //重名只按绝对路径检测,避免不同作用域的同名成员(如 I.f 与 B.f)误判
            let exists=scope.global.data.get(abs_name)
            if(exists){
                let block=exists
                //合并当作一个检查
                if(block instanceof Module&&i instanceof Module){
                    if(block.modifiers!=i.modifiers)
                        scope.thr(`${block.name} and ${i.name} modifier not equal at line ${block.line.join('\n')}`)
                    block.children.forEach(v=>i.children.push(v))
                    scope.global.set(abs_name,i)
                    let block_type=new BlockType(abs_name.split('.'))
                    scope.global.sym(i,block_type)
                    i.type=block_type
                }else
                    scope.thr(`${i.name} is defined at line ${block.line.join('\n')}`)
                continue
            }
            //绝对路径注册到全局,相对名注册到当前作用域
            scope.global.set(abs_name,i)
            scope.set(i.name,i)
            let block_type=new BlockType(abs_name.split('.'))
            scope.global.sym(i,block_type)
            i.type=block_type
        }
        for(let j of d.children.filter(v=>v instanceof Class||
        v instanceof Interface||v instanceof Module||v instanceof File)) {
            let abs_name=prefix?prefix+'.'+j.name:j.name
            scope=scope.enter()
            scope.path=abs_name
            _name(j,abs_name)
            scope=scope.leave()
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
    //全局注册
    let _ft=(d:File|Class|Interface|Module)=>{
        for(let i of d.children) {
            if (i instanceof Function)
                scope.global.sym(i, new LambdaType(i.params, i.return_type, false))
            if (i instanceof Class || i instanceof Interface || i instanceof Module || i instanceof File)
                _ft(i)
        }
    }
    let ls=(d:Class|Interface|File|Module)=>{
        for(let i of d.children)
            if(i instanceof Class||i instanceof Interface)
                _pre(i)
        for(let i of d.children)
            if(i instanceof Class||i instanceof Interface||i instanceof File||i instanceof Module)
                ls(i)
    }
    for(let i of data)
        _name(i)
    link()
    for(let i of data)
        _static(i,'')
    for(let i of data)
        _ft(i)
    for(let i of data)
        ls(i)
}