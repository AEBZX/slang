import {Block, BlockType, Class, File, Function, Interface, LambdaType, Module, Scope, Variable} from '../utils'
export default function symbol(data:File[],scope:Scope){
    //重名检测
    let _name=(d:Class|Module|Interface|File,prefix:string='')=>{
        //先注册本层所有 block(含成员),再递归一次子 block,避免重复处理
        for(let i of d.children){
            let abs_name=prefix?prefix+'.'+i.name:i.name
            //已被前序文件注册的推送副本(多文件同模块合并场景:后序文件的模块携带
            //前序文件的同一节点引用)直接跳过,否则重名检测误报 "is defined"
            if(scope.global.data.get(abs_name)===i)continue
            //重名只按绝对路径检测,避免不同作用域的同名成员(如 I.f 与 B.f)误判
            let exists=scope.global.data.get(abs_name)
            if(exists){
                let block=exists
                //合并当作一个检查
                if(block instanceof Module&&i instanceof Module){
                    //修饰符逐字段按值比较:modifiers 是每块 new 的新对象,引用比较恒不等,
                    //多文件同模块(如标准库 6 个文件都声明 public std:module)必然误报
                    let m1=block.modifiers,m2=i.modifiers
                    if(m1.unstatic!=m2.unstatic||m1._async!=m2._async||m1._private!=m2._private)
                        scope.thr(`${block.name} and ${i.name} modifier not equal at line ${block.line.join('\n')}`)
                    //并入旧子节点时按引用去重:同一模块被重复合并(block===i)时
                    //children.forEach(push) 会把自身子节点重复追加,children 翻倍
                    for(let v of block.children)
                        if(!i.children.includes(v))
                            i.children.push(v)
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
            //不在此处按身份跳过:本层首次注册的子模块仍需递归注册其成员;
            //推送副本进入 _name 后由其第一层循环的身份检查兜底(全部已注册→跳过)
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
    //link处理:只校验目标模块存在(别名按文件级在 check/index.ts visit 时注册,
    //保证别名只对当前文件可见且不污染其他文件)
    let link=()=>{
        for(let i of data){
            i.links.forEach(v=>{
                if(!scope.get(v.module.join('.')))
                    scope.thr(`${v.module.join('.')} not found at line ${i.line.join('\n')}`)
            })
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
            //默认实现的 std.ObjectInterface 找不到时跳过:未带标准库时类仍可编译;
            //显式 implements 的接口找不到仍报错
            if(d.implement.join('.')=='std.ObjectInterface')return
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
    //成员变量的值类型提前注册:check 的 C_Variable 在 visit 时才把节点 sym 成值类型,
    //跨文件引用(如 main 引用 std.file.const)若定义文件排在引用文件之后(合并 std 在
    //最后一个文件),会拿到 symbol 阶段的 BlockType → "[] can only be applied to fix type"
    let _vt=(d:File|Class|Interface|Module)=>{
        for(let i of d.children) {
            if(i instanceof Variable)
                scope.global.sym(i, i.t)
            if(i instanceof Class || i instanceof Interface || i instanceof Module || i instanceof File)
                _vt(i)
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
        _vt(i)
    for(let i of data)
        ls(i)
}