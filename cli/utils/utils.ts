import lzma from 'lzma-native'
import {c as _compress,x as _decompress} from 'tar'
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {DefaultGlobalConfig, GlobalConfig, ProjectConfig} from '../model.ts'
import os from 'node:os'
export function lzma_compress(buf:Buffer):Promise<Buffer>{
    return new Promise((resolve)=>{
        lzma.compress(buf,{preset:9,synchronous:true},(res)=>{resolve(res)})
    })
}
export function lzma_decompress(str:Buffer):Promise<Buffer>{
    return new Promise((resolve)=>{
        lzma.decompress(str,{synchronous:true},(res)=>{resolve(res)})
    })
}
export async function compress(ignore:string[], dir:string=process.cwd()):Promise<Buffer>{
    const tar_file=path.join(dir,'ls.tar')
    _compress({gzip:false,cwd:dir,file:tar_file,filter:(p:string)=>{
            return !ignore.map(i=>p.includes(i)).includes(true)&&!p.includes('ls.tar')
        },sync:true},['.'])
    let ret=await lzma_compress(readFileSync(tar_file))
    rmSync(tar_file)
    return ret
}
export async function decompress(name:string,str:Buffer,output:string,verify:string){
    //hex 是压缩数据的 sha256(发布时 createHash('sha256').update(data) 对压缩后数据取哈希),
    //必须先对 str(压缩数据)校验,再解压
    if(!hash_verify(str,verify))throw new Error('文件校验失败')
    mkdirSync(output,{recursive:true})
    mkdirSync(path.join(output,name),{recursive:true})
    const plain=await lzma_decompress(str)
    writeFileSync(path.join(output,'ls.tar'),plain)
    _decompress({file:path.join(output,'ls.tar'),cwd:path.join(output,name),sync:true})
    rmSync(path.join(output,'ls.tar'))
}
export function hash_verify(data:Buffer|string,hex:string){
    return createHash('sha256').update(data).digest('hex')==hex
}
export function global_config():GlobalConfig{
    if(!existsSync(path.join(os.homedir(),'.slang','config.json')))
        writeFileSync(path.join(os.homedir(),'.slang','config.json'),JSON.stringify(DefaultGlobalConfig))
    return JSON.parse(readFileSync(path.join(os.homedir(),'.slang','config.json'),'utf-8')) as GlobalConfig
}
export function project_config(dir:string):ProjectConfig{
    return JSON.parse(readFileSync(path.join(dir,'slang.json'),'utf-8')) as ProjectConfig
}
export function verify(dir:string){
    if(!existsSync(path.join(dir,'slang.json')))
        throw new Error('不是Slang项目')
}
export function write_global_config(config:GlobalConfig){
    writeFileSync(path.join(os.homedir(),'.slang','config.json'),JSON.stringify(config,null,4))
}
export function write_project_config(dir:string,config:ProjectConfig){
    writeFileSync(path.join(dir,'slang.json'),JSON.stringify(config,null,4))
}
