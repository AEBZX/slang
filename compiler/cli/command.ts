import {GlobalConfig, ProjectConfig} from './config'
import {readdirSync, writeFileSync, readdir, readFileSync, existsSync, rmdirSync, rmSync} from 'fs'
import c from '../index'
import * as path from 'path'
import * as process from 'process'
import { spawn } from 'child_process'
import {input,select,confirm} from '@inquirer/prompts'
import os from 'os'
import ajax from 'axios'
import {c as _compress,x as _decompress} from 'tar'
import lzma from 'lzma-native'
import {createHash} from 'crypto'
function compress(ignore:string){
    writeFileSync(process.cwd()+'/'+'ls.tar',Buffer.from(''),{flag:'w'})
    const stream=_compress({gzip:false,cwd:process.cwd(),file:'ls.tar',filter:(path)=>{
        return !path.includes(ignore)
        },sync:true},['.'])
    let ret=''
    lzma.compress(readFileSync(process.cwd()+'/ls.tar'),{preset:9,synchronous:true},(res)=>{
        ret=res.toString('base64')
        rmSync(process.cwd()+'/'+'ls.tar')
    })
    return ret
}
function decompress(name:string,str:string,output:string){
    writeFileSync(output+'/ls.tar.xz',Buffer.from(str,'base64'))
    _decompress({file:output+'/ls.tar.xz',cwd:output+'/'+name,sync:true})
    rmSync(output+'/ls.tar.xz')
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
    const vm:string='vm.exe'
    const output=await input({message:'输出路径:(.sbin)',default:`${folder_name}`})
    const local=await input({message:'库目录:',default:'lib'})
    writeFileSync('slang.json',JSON.stringify({
        name:name,
        version:version,
        author:'',
        license:'',
        ignore:[],
        optimize:level,
        output:output,
        vm:vm,
        lib:{local:local,data:[]}
    },null,4))
}
export function config(config:string,value:string){
    if(!['server','username','token'].includes(config)) throw new Error('Invalid config')
    if(!existsSync(path.join(os.homedir(),'.slang','config.json')))
        writeFileSync(path.join(os.homedir(),'.slang','config.json'),JSON.stringify({server:'',username:'',token:''},null,4))
    let data=JSON.parse(readFileSync(path.join(os.homedir(),'.slang','config.json'),'utf-8'))
    data[config]=value
    writeFileSync(path.join(os.homedir(),'.slang','config.json'),JSON.stringify(data,null,4))
}
export function install(global:GlobalConfig,project:ProjectConfig,name:string,version:string){
    console.log(`install ${name}@${version}`)
    //检查是否存在
    let self:ProjectConfig=JSON.parse(readFileSync(process.cwd()+'/slang.json','utf-8'))
    if(self.lib.data.some(e=>e.name==name&&e.version!=version))
        throw new Error('Module already exists with different version')
    if(self.lib.data.some(e=>e.name==name))
        return
    ajax.post(global.server+'/api/download/module',{name,version}).then((res)=>{
        if(res.data.code!=200)throw new Error(`${res.data.code}:${res.data.message}`)
        decompress(name,res.data.data,process.cwd()+'/'+project.lib.local)
        //继续下载他的依赖项
        ajax.get(global.server+'/api/list/module').then((res)=>{
            let deps=res.data.data.filter(i=>i.name==name)[0].version.filter(i=>i.version==version)[0]
                .dependencies
            deps.forEach(i=>install(global,project,i.name,i.version))
        })
    })
    console.log('done')
}
export function uninstall(global:GlobalConfig,project:ProjectConfig,name:string){
    console.log(`uninstall ${name} `)
    project.lib.data=project.lib.data.filter(e=>e.name!=name)
    project.lock=project.lock.filter(e=>e.name!=name)
    rmdirSync(process.cwd()+'/'+project.lib.local+'/'+name)
    //列举所有依赖项
    let dependencies=project.lock.map(i=>i.dependencies)
        .map(i=>i.map(j=>j.name)).flat()
    let _dependencies=readdirSync(project.lib.local,{withFileTypes:true}).filter(i=>i.isDirectory())
        .map(i=>i.name)
    //找到_d里有d里没有的
    let toUninstall=_dependencies.filter(e=>!dependencies.includes(e))
    console.log(`remove ${toUninstall.join(' ')}`)
    toUninstall.forEach(e=>{uninstall(global,project,e)})
    writeFileSync('slang.json',JSON.stringify(project,null,4))
    console.log('uninstall done')
}
export function publish(global:GlobalConfig,project:ProjectConfig){
    console.log('publishing...')
    let data=compress(project.lib.local)
    ajax.post(global.server+'/api/publish/module',{
        author:project.author,
        token:global.password,
        name:project.name,
        module:{
            version:project.version,
            license:project.license,
            dependencies:project.lib.data,
            source:null,
            hex:createHash('sha256').update(Buffer.from(data,'base64')).digest('hex')
        },
        data
    })
        .then((res)=>{
        if(res.data.code!=200)throw new Error(`${res.data.code}:${res.data.message}`)
        console.log('publish done')
    })
}
//上传vm
export function pvm(global:GlobalConfig,path:string,isa:string,version:string,license:string){
    console.log('publishing vm...')
    ajax.post(global.server+'/api/publish/vm',{
        module:{
            version: version,
            isa,
            author: global.username,
            license: license,
            source:null,
            hex: createHash('sha256').update(readFileSync(path,'binary')).digest('hex')
        },data:readFileSync(path).toString('base64')
    })
        .then((res)=>{
        if(res.data.code!=200)throw new Error(`${res.data.code}:${res.data.message}`)
        console.log('publish done')
    })
}