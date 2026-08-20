import {GlobalConfig, ProjectConfig} from './config'
import {readdirSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync} from 'fs'
import c from '../index'
import * as path from 'path'
import * as process from 'process'
import { spawn } from 'child_process'
import {input,select} from '@inquirer/prompts'
import os from 'os'
import ajax from 'axios'
import {c as _compress,x as _decompress} from 'tar'
import lzma from 'lzma-native'
import {createHash} from 'crypto'
//lzma 压缩/解压(base64 交换格式为 .tar.xz;tar 库本身不支持 xz,需先解压为纯 tar)
function lzma_compress(buf:Buffer):Promise<string>{
    return new Promise((resolve)=>{
        lzma.compress(buf,{preset:9,synchronous:true},(res)=>{resolve(res.toString('base64'))})
    })
}
function lzma_decompress(str:string):Promise<Buffer>{
    return new Promise((resolve)=>{
        lzma.decompress(Buffer.from(str,'base64'),{synchronous:true},(res)=>{resolve(res)})
    })
}
async function compress(ignore:string,dir:string=process.cwd()):Promise<string>{
    const tar_file=path.join(dir,'ls.tar')
    _compress({gzip:false,cwd:dir,file:tar_file,filter:(p:string)=>{
        return !p.includes(ignore)&&!p.includes('ls.tar')
        },sync:true},['.'])
    let ret=await lzma_compress(readFileSync(tar_file))
    rmSync(tar_file)
    return ret
}
async function decompress(name:string,str:string,output:string){
    mkdirSync(output,{recursive:true})
    mkdirSync(path.join(output,name),{recursive:true})
    const plain=await lzma_decompress(str)
    writeFileSync(path.join(output,'ls.tar'),plain)
    _decompress({file:path.join(output,'ls.tar'),cwd:path.join(output,name),sync:true})
    rmSync(path.join(output,'ls.tar'))
}
export function compiler(global:GlobalConfig,project:ProjectConfig,dir:string=process.cwd()){
    let output=dir+'/'+project.output+'.sbin'
    //寻找目录下所有.sl文件
    const file: string[] = []
    const file_name:string[]=[]
    let walk=(dir:string)=>{
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name)
            if (e.isDirectory()&&!project.ignore.includes(e.name))
                walk(full)
            else if (e.isFile()&&e.name.endsWith('.sl')&&!project.ignore.includes(e.name.substring(0,e.name.length-4))) {
                //传入源码内容,而非文件路径
                file.push(readFileSync(full,'utf-8'))
                file_name.push(e.name)
            }
        }
    }
    walk(dir)
    let {BIN,POOL}=c(file,project.optimize,true,file_name)
    const write: Buffer[] = []
    write.push(Buffer.from('POOL_START','utf-8'))
    for (const [id, v] of POOL) {
        let type: number=typeof v=='number'?1:0
        let data: Buffer
        if (typeof v === 'number') {
            data = Buffer.alloc(8)
            data.writeDoubleLE(v, 0)
        } else
            data = Buffer.from(v, 'utf8')
        const head = Buffer.alloc(9)
        head.writeUInt32LE(id, 0)
        head.writeUInt8(type, 4)
        head.writeUInt32LE(data.length, 5)
        write.push(head, data)
    }
    write.push(Buffer.from('POOL_END','utf-8'))
    write.push(Buffer.from('CODE_START','utf-8'))
    for(let i of BIN){
        let data=Buffer.alloc(13)
        data.writeUInt8(i[0],0)
        data.writeUInt32LE(i[1],1)
        data.writeUInt32LE(i[2],5)
        data.writeUInt32LE(i[3],9)
        write.push(data)
    }
    write.push(Buffer.from('CODE_END','utf-8'))
    writeFileSync(output,Buffer.concat(write),{encoding:'utf8',flag:'w'})
    console.log('saved at '+output)
}
export function start(vm:string,file:string){
    file=path.resolve(file)
    spawn(vm, ['run',file], {
        stdio: 'ignore',
    }).unref()
}
export function run(global:GlobalConfig,project:ProjectConfig){
    compiler(global, project)
    start(project.vm,project.output+'.sbin')
}
export async function init(){
    let folder_name=path.basename(process.cwd())||'app'
    const name=await input({message:'项目名:',default:folder_name})
    const version=await input({message:'版本:',default:'1.0.0'})
    const level=await select({
        message: '选择优化等级:',
        choices: [
            { name: '关闭优化', value: 0 },
            { name: 'O1', value: 1, description: '基本优化' },
            { name: 'O2', value: 2, description: '激进优化' },
        ],
        default:2
    })
    //此处先放鸽子
    //从SPMServer获取VMList
    let vm_list:{version:string,isa:string}[]=[]
    if(global.server){
        let res=await ajax.get(global.server+'/api/list/vm')
        vm_list=res.data.data.map(i=>{return {version:i.version,isa:i.isa}})
    }
    const vm=await select({
        message: '选择虚拟机:',
        choices: vm_list.map(i=>{return {name:i.version+'('+i.isa+'指令集)',value:i.version}}),
        default:vm_list[0].version+'('+vm_list[0].isa+'指令集)'
    })
    //下载vm虚拟机
    let data=await ajax.post(global.server+'/api/download/vm',{params:{version:vm.split(' ')[0]}})
    writeFileSync(process.cwd()+'/vm.exe',Buffer.from(data.data,'base64'))
    const output=await input({message:'输出路径:(.sbin)',default:`${folder_name}`})
    const local=await input({message:'库目录:',default:'lib'})
    writeFileSync('slang.json',JSON.stringify({
        name:name,
        version:version,
        author:'',
        license:'',
        slang:'1.0.0',
        ignore:[],
        optimize:level,
        output:output,
        vm:os.type()=='Windows_NT'?'vm.exe':'vm',
        lib:{local:local,data:[]},
        lock:[]
    },null,4))
    mkdirSync(local,{recursive:true})
}
export function config(config:string,value:string){
    if(!['server','username','password','token'].includes(config)) throw new Error('Invalid config')
    let file=path.join(os.homedir(),'.slang','config.json')
    if(!existsSync(file)) {
        mkdirSync(path.dirname(file),{recursive:true})
        writeFileSync(file,JSON.stringify({server:'',username:'',password:''},null,4))
    }
    let data=JSON.parse(readFileSync(file,'utf-8'))
    //token 是 password 的别名
    if(config=='token')config='password'
    data[config]=value
    writeFileSync(file,JSON.stringify(data,null,4))
}
export async function install(global:GlobalConfig,project:ProjectConfig,name:string,version:string,dir:string=process.cwd()){
    console.log(`install ${name}@${version}`)
    if(!global.server)throw new Error('server not configured,run: slang config server <url>')
    if(!project.lib)project.lib={local:'lib',data:[]}
    if(project.lib.data.some(e=>e.name==name&&e.version!=version))
        throw new Error('Module already exists with different version')
    if(project.lib.data.some(e=>e.name==name))
        return
    let res=await ajax.post(global.server+'/api/download/module',{name,version})
    if(res.data.code!=200)throw new Error(`${res.data.code}:${res.data.message}`)
    await decompress(name,res.data.data,path.join(dir,project.lib.local))
    project.lib.data.push({name,version})
    writeFileSync(path.join(dir,'slang.json'),JSON.stringify(project,null,4))
    //继续下载他的依赖项
    let list=await ajax.get(global.server+'/api/list/module')
    let pkg=(list.data.data||[]).filter(i=>i.name==name)[0]
    let deps=pkg?pkg.version.filter(i=>i.version==version)[0]?.dependencies||[]:[]
    for(let dep of deps)
        await install(global,project,dep.name,dep.version,dir)
    console.log('done')
}
export function uninstall(global:GlobalConfig,project:ProjectConfig,name:string,dir:string=process.cwd()){
    console.log(`uninstall ${name} `)
    if(!project.lock)project.lock=[]
    if(!project.lib)project.lib={local:'lib',data:[]}
    project.lib.data=project.lib.data.filter(e=>e.name!=name)
    project.lock=project.lock.filter(e=>e.name!=name)
    let module_dir=path.join(dir,project.lib.local,name)
    if(existsSync(module_dir))rmSync(module_dir,{recursive:true,force:true})
    //列举所有依赖项
    let dependencies=(project.lock||[]).map(i=>i.dependencies)
        .map(i=>i.map(j=>j.name)).flat()
    let lib_dir=path.join(dir,project.lib.local)
    let _dependencies=existsSync(lib_dir)?readdirSync(lib_dir,{withFileTypes:true}).filter(i=>i.isDirectory())
        .map(i=>i.name):[]
    //找到_d里有d里没有的
    let toUninstall=_dependencies.filter(e=>!dependencies.includes(e))
    console.log(`remove ${toUninstall.join(' ')}`)
    toUninstall.forEach(e=>{uninstall(global,project,e,dir)})
    writeFileSync(path.join(dir,'slang.json'),JSON.stringify(project,null,4))
    console.log('uninstall done')
}
export async function publish(global:GlobalConfig,project:ProjectConfig,dir:string=process.cwd()){
    console.log('publishing...')
    if(!global.server)throw new Error('server not configured,run: slang config server <url>')
    if(!global.password)throw new Error('token not configured,run: slang config password <token>')
    let data=await compress(project.lib.local,dir)
    let res=await ajax.post(global.server+'/api/publish/module',{
        author:project.author,
        token:global.password,
        name:project.name,
        module:{
            version:project.version,
            slang:project.slang||'1.0.0',
            license:project.license,
            dependencies:project.lib.data||[],
            source:null,
            hex:createHash('sha256').update(Buffer.from(data,'base64')).digest('hex')
        },
        data
    })
    if(res.data.code!=200)throw new Error(`${res.data.code}:${res.data.message}`)
    console.log('publish done')
}
//上传vm
export async function pvm(global:GlobalConfig,path:string,isa:string,version:string,license:string){
    console.log('publishing vm...')
    let res=await ajax.post(global.server+'/api/publish/vm',{
        module:{
            version: version,
            isa,
            author: global.username,
            license: license,
            source:null,
            hex: createHash('sha256').update(readFileSync(path)).digest('hex')
        },data:readFileSync(path).toString('base64')
    })
    if(res.data.code!=200)throw new Error(`${res.data.code}:${res.data.message}`)
    console.log('publish done')
}
