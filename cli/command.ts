import {ProjectConfig} from './model.ts'
import {
    verify,
    global_config,
    net,
    project_config,
    decompress,
    compress,
    write_project_config,
    write_global_config
} from './utils'
import {input, select} from '@inquirer/prompts'
import {existsSync, mkdirSync, readFileSync, rmdirSync, rmSync, write, writeFileSync} from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
async function init(){
    //默认为当前目录名
    const name=await input({message:'项目名',default:process.cwd().split('/').pop()||'$'})
    const version=await input({message:'版本号',default:'1.0.0'})
    const author=await input({message:'作者',default:global_config().username})
    const license=await input({message:'协议',default:'MIT'})
    const lib=await input({message:'库目录',default:'lib'})
    const optimize=await select({message:'优化级别',choices:[
            {
                name:'不优化',
                value:0
            },
            {
                name:'普通优化',
                value:1
            },
            {
                name:'激进优化',
                value:2
            }
        ],default:0})
    const output=await input({message:'输出文件(.sbin)',default:name})+'.sbin'
    const venv=await input({message:'虚拟环境目录',default:'venv'})
    let compiler_menu=(await net.list.compiler()).filter(i=>i.child.length!=0)
    let compiler_large_version=compiler_menu.map((item)=>item.version)
    const compiler=await select({message:'选择Slang版本',choices:compiler_large_version})
    //服务端 CompilerChild 无 date 字段,按列表顺序(服务端 push 顺序,新版本在后)
    let compiler_small_version=compiler_menu.find((item)=>item.version==compiler).child
        .map((item)=>item.version)
    const small=await select({message:'选择Slang小版本',choices:compiler_small_version})
    let vm_menu=await net.list.vm()
    const vm=await select({message:'选择虚拟机版本',choices:vm_menu.map((item)=>{
        return {name:`${item.version}(基于${item.isa}指令集)`,value:item.version}
    })})
    let _compiler=await net.download.compiler(compiler,small)
    let _vm=await net.download.vm(vm)
    if(createHash('sha256').update(_compiler).digest('hex')!=
        compiler_menu.find(i=>i.version==compiler).child
            .find(i=>i.version==small).hex)
        throw new Error('文件校验失败')
    if(createHash('sha256').update(_vm).digest('hex')!=
        vm_menu.find(i=>i.version==vm).hex)
        throw new Error('文件校验失败')
    mkdirSync(path.join(process.cwd(),venv))
    writeFileSync(path.join(process.cwd(),venv,'compiler.js'),_compiler,'utf-8')
    //+ 优先级高于 ==,必须加括号;Windows 下补 .exe 后缀
    writeFileSync(path.join(process.cwd(),venv,'vm'+(os.type()=='Windows_NT'?'.exe':'')),_vm)
    const write:ProjectConfig={
        name,
        version,
        author,
        license,
        ignore:[lib],
        dependency:[],
        optimize,
        output,
        venv:{
            dir:venv,
            compiler,
            vm,
            compiler_version:small,
            vm_version:vm
        },
        lib:{
            local:lib,
            data:[]
        }
    }
    writeFileSync(path.join(process.cwd(),'slang.json'),JSON.stringify(write,null,4),'utf-8')
}
async function install(name:string,version:string,d:boolean=true){
    verify(process.cwd())
    let config=project_config(process.cwd())
    let list=await net.list.module()
    if(!(list.find((item)=>item.name==name&&
    item.version.map(i=>i.version==version).includes(true))))
        throw new Error(`不存在${name}@${version}`)
    if(config.lib.data.find((item)=>item.name==name&&item.version==version))
        throw new Error(`${name}已安装`)
    let module=
        list.find((item)=>item.name==name)
            .version.find((item)=>item.version==version)
    if(!module)throw new Error(`不存在${name}@${version}`)
    //检查依赖是否冲突,以及需要安装的包
    let dependencies:{name:string,version:string}[]=[]
    for(let i of (module.dependencies||[])){
        if(config.lib.data.find((item)=>item.name==i.name&&item.version!=i.version))
            throw new Error(`依赖冲突${i.name}@${i.version}`)
        if(!config.lib.data.find((item)=>item.name==i.name))
            dependencies.push(i)
    }
    console.log(`install ${name}@${version}`)
    config.lib.data.push({
        name,
        version
    })
    if(!config.lock)config.lock=[]
    config.lock.push({
        name,
        dependencies:dependencies
    })
    if(d)config.dependency.push({name, version})
    for(let i of dependencies)
        await install(i.name,i.version,false)
    await decompress(name, await net.download.module(name, version), path.join(process.cwd(), config.lib.local),
        module.hex)
    write_project_config(process.cwd(), config)
}
async function uninstall(name:string){
    verify(process.cwd())
    let config=project_config(process.cwd())
    //寻找是否存在
    if(!config.dependency.find((item)=>item.name==name))
        throw new Error(`${name}未安装`)
    console.log(`uninstall ${name}`)
    //找到需要连带删除的(lock 可能不含该条目,如旧项目,需判空)
    let lock=config.lock?.find(i=>i.name==name)
    let dependencies:string[]=(lock?lock.dependencies:[]).map(i=>i.name).filter(i=>!config.dependency.find(j=>j.name==i))
        .filter(i=>!config.lock.map(j=>j.dependencies
            .find(k=>k.name==i)!=null).includes(true))
    for(let i of dependencies)
        await uninstall(i)
    config.dependency=config.dependency.filter((item)=>item.name!=name)
    config.lib.data=config.lib.data.filter((item)=>item.name!=name)
    config.lock=config.lock.filter((item)=>item.name!=name)
    rmdirSync(path.join(process.cwd(), config.lib.local, name))
    write_project_config(process.cwd(), config)
}
async function publish_module(){
    verify(process.cwd())
    let config=project_config(process.cwd())
    let global=global_config()
    let list=await net.list.module()
    if(list.find((item)=>item.name==config.name&&
    item.version.map(i=>i.version==config.version).includes(true)))
        throw new Error(`${config.name}@${config.version}已经存在`)
    console.log(`publish ${config.name}`)
    let data=await compress(config.ignore, process.cwd())
    //token 用全局配置里的 token(注册后由服务器发到邮箱,用户 config set token 配置)
    //旧 slang.json 可能没有 dependency 字段,默认空数组
    let deps = config.dependency || []
    await net.publish.module(config.name, global.username, global.token, {
        dependencies: deps, hex: createHash('sha256').update(data).digest('hex'),
        source: '', version: config.version
    },data)
}
async function publish_vm(local:string,version:string,isa:string,license:string){
    let config=global_config()
    let list=await net.list.vm()
    if(!existsSync(local))
        throw new Error(`${local}不存在`)
    if(list.find((item)=>item.version==version))
        throw new Error(`vm-${version}已经存在`)
    console.log(`publish ${local}`)
    let data:Buffer=readFileSync(local)
    await net.publish.vm(config.username,config.token,{
        version, isa, author: config.username, license,source:'',
        hex: createHash('sha256').update(data).digest('hex')
    },data)
}
async function create_compiler(license:string,version:string){
    let config=global_config()
    let list=await net.list.compiler()
    if(list.find((item)=>item.version==version))
        throw new Error(`compiler-${version}已经存在`)
    console.log(`create compiler ${version}`)
    await net.publish.compiler_create(config.username,config.token,license,version)
}
async function publish_compiler(local:string,large_version:string,small_version:string){
    let config=global_config()
    let list=await net.list.compiler()
    if(!existsSync(local))
        throw new Error(`${local}不存在`)
    if(!list.find((item)=>item.version==large_version))
        throw new Error(`compiler-${large_version}不存在`)
    if(list.find(item=>item.version==large_version).child.find(i=>i.version==small_version))
        throw new Error(`compiler-${large_version}.${small_version}已经存在`)
    console.log(`publish compiler ${large_version}.${small_version}`)
    let data=readFileSync(local,'utf-8')
    await net.publish.compiler(config.username,config.token,large_version,{
        version: small_version, hex: createHash('sha256').update(data).digest('hex'),
        source:''
    },data)
}
async function config_set(key:string,value:string){
    if(!['server','username','password','token'].includes(key))
        throw new Error('不存在的配置项')
    let config=global_config()
    config[key]=value
    write_global_config(config)
}
async function config_verify(){
    let config=global_config()
    let data=await net.user.verify(config.username,config.token)
    if(data!='')throw new Error(data)
}
async function register(username:string,email:string){
    let config=global_config()
    //服务端 register 返回 data:null,token 只通过邮箱发送,用户需 config set token <邮箱收到的token>
    await net.user.register(username,email)
    console.log('注册成功,token已发送到邮箱,请使用 config set token <token> 配置')
}
function compiler(cwd:string=process.cwd()){
    //读取虚拟环境运行:编译器是 init 时下载到 venv/compiler.js 的 JS 文件,用 node 执行
    let config=project_config(cwd)
    let venv=config.venv.dir||'venv'
    //编译时忽略 venv 目录(非源码),但保留 lib(标准库需参与编译)
    //slang.json 的 ignore 字段是给 publish 打包用的,不能直接用于编译
    let ignore=venv
    //output 传文件名(不含路径和后缀),compiler.js 会拼成 dir+'/'+output+'.sbin'
    let outName=config.output.replace(/\.sbin$/,'')
    spawnSync('node',[path.join(cwd,venv,'compiler.js')
        ,'compiler','--dir',cwd,'--ignore',ignore
            ,'--output',outName,'--optimize',config.optimize+''],{
        stdio: 'inherit',
        shell: true
    })
}
function run(cwd:string=process.cwd()){
    let config=project_config(cwd)
    let venv=config.venv.dir||'venv'
    //output 可能不带 .sbin 后缀(手写 slang.json 时),兼容处理
    let sbin=config.output.endsWith('.sbin')?config.output:config.output+'.sbin'
    //VM 是 init 时下载到 venv/vm(.exe) 的二进制,版本号字段不是路径
    spawnSync(path.join(cwd,venv,'vm'+(os.type()=='Windows_NT'?'.exe':'')),['run',path.join(cwd,sbin)],{
        stdio: 'inherit',
        shell: true
    })
}
function go(){
    compiler()
    run()
}
export default {
    init,
    install,
    uninstall,
    publish_module,
    publish_vm,
    create_compiler,
    publish_compiler,
    config_set,
    config_verify,
    register,
    compiler,
    run,
    go
}