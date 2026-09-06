import {
    Block,
    BlockType, Cast,
    Class,
    ClassType,
    File,
    Function,
    Interface,
    LambdaType,
    Module, Operation,
    Scope, Value,
    Variable
} from '../utils'
export default function symbol(data:File[],scope:Scope){
    //value 块是 literal 类型的扩展容器(operation/cast 归属),无名,不进全局符号表;
    //其注册走 Scope.operation/cast(以类型为键),故此处直接跳过
    let is_extension=(i:any)=>i instanceof Value||i instanceof Operation||i instanceof Cast
    //重名检测
    let _name=(d:Class|Module|Interface|File,prefix:string='')=>{
        for(let i of d.children){
            if(is_extension(i))continue
            let abs_name=prefix?prefix+'.'+i.name:i.name
            if(scope.global.data.get(abs_name)===i)continue
            //重名只按绝对路径检测,避免不同作用域的同名成员(如 I.f 与 B.f)误判
            let exists=scope.global.data.get(abs_name)
            if(exists){
                let block=exists
                //合并当作一个检查
                if(block instanceof Module&&i instanceof Module){
                    let m1=block.modifiers,m2=i.modifiers
                    if(m1.unstatic!=m2.unstatic||m1._async!=m2._async||m1._private!=m2._private)
                        scope.thr(`${block.name} and ${i.name} modifier not equal at line ${block.line.join('\n')}`)
                    for(let v of block.children)
                        if(!i.children.includes(v))
                            i.children.push(v)
                    scope.global.set(abs_name,i)
                    let block_type=new BlockType(abs_name.split('.'))
                    scope.global.sym(i,block_type)
                    i.type=block_type
                }else if(block instanceof Function&&i instanceof Function){
                    //函数重载:同名不同签名 → 收集进 overload 表,data 保留首个为代表
                    //(签名相同才是真重名,由 C_Function 在 check 层按参数判定;序号由 set_overload 编)
                    let idx=scope.global.get_overload(abs_name).length
                    scope.global.set_overload(abs_name,i)
                    //每个重载成员需唯一绝对路径/类型:首个沿用原名,后续用 原名+序号(f,f1)
                    //否则 type 都是 K.f → hir 按 type.local 注册槽,撞成同一槽(HUNG 根因)
                    let uniq=i.name+(idx>0?idx:'')
                    i.index=idx
                    let uniq_abs=prefix?prefix+'.'+uniq:uniq
                    scope.global.set(uniq_abs,i)
                    let block_type=new BlockType(uniq_abs.split('.'))
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
            //函数(含首个)都进重载组:同名后续由 exists 分支并入;单函数组仅代表,普通调用走代表
            if(i instanceof Function)
                scope.global.set_overload(abs_name,i)
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
            if(is_extension(i))continue
            if(!i.modifiers.unstatic){
                let static_name='name' in i?(name?name+'.'+i.name:i.name):name
                //函数重载:已注册同名 static 时收集而非覆盖
                //(type 由 _name 已设为唯一路径 K.f1,勿重置为 K.f 否则撞槽)
                let old=scope.global.data.get(static_name)
                if(old&&old!==i&&old instanceof Function&&i instanceof Function){
                    scope.global.set_overload(static_name,i)
                }else{
                    scope.global.set(static_name,i)
                    let block_type=new BlockType(static_name.split('.'))
                    scope.global.sym(i,block_type)
                    i.type=block_type
                }
            }
            if(i instanceof Class||i instanceof Interface||i instanceof File)
                _static(i,name)
        }
    }
    //link处理:只校验目标模块存在
    let link=()=>{
        for(let i of data){
            i.links.forEach(v=>{
                if(!scope.get(v.module.join('.')))
                    scope.thr(`${v.module.join('.')} not found at line ${i.line.join('\n')}`)
            })
        }
    }
    //链传递:implement 关系传递到 grandfather
    let chain=(father:string,child:string)=>{
        let set=scope.chain.get(father)
        if(!set) scope.chain.set(father,set=new Set())
        if(set.has(child)) return
        set.add(child)
        //找所有包含 child 的 grandfather
        for(const [k,v] of scope.chain){
            if(k!==father && v.has(child)){
                chain(k,child)
            }
        }
    }
    //预操作
    let _pre=(d:Class|Interface)=>{
        if(d.implement==null)return
        if(!(d.implement instanceof ClassType))
            scope.thr(`${d.name} implement ${d.implement} not found at line ${d.line.join('\n')}`)
        if((<ClassType>d.implement).local.length==0)return
        if(!scope.get((<ClassType>d.implement).local.join('.'))){
            if((<ClassType>d.implement).local.join('.')=='std.ObjectInterface')return
            scope.thr(`${d.name} implement ${d.implement} not found at line ${d.line.join('\n')}`)
            return
        }
        let impl=scope.get((<ClassType>d.implement).local.join('.'))
        if(!(impl instanceof Interface)){
            scope.thr(`${d.name} implement ${d.implement} is not interface at line ${d.line.join('\n')}`)
            return
        }
        chain((<ClassType>d.implement).local.join('.'),d.name)
    }
    //全局注册
    let _ft=(d:File|Class|Interface|Module)=>{
        for(let i of d.children) {
            if (i instanceof Function)
                scope.global.sym(i, new LambdaType(i.generic,i.params, i.return_type, false))
            if (i instanceof Class || i instanceof Interface || i instanceof Module || i instanceof File)
                _ft(i)
        }
    }
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