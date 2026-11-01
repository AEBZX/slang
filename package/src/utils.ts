import {Config, Data, DataConfig, EmailData, Result, UserConfig} from './model'
import nodemailer, {Mail, Transporter} from 'nodemailer'
import SMTPTransport from 'nodemailer/lib/smtp-transport'
import crypto, {createHash} from 'crypto'
import {writeFileSync,readFileSync} from 'fs'
import {v6} from 'uuid'
export function email_send(EMailTool: Transporter<SMTPTransport.SentMessageInfo>,
                    from: string, to: string, subject: string, content: string,
                    fallback: (success: boolean) => void) {
    EMailTool.sendMail({
        from: from,
        to: to,
        subject: subject,
        text: content
    }).then(r => fallback(true)).catch(e => fallback(false))
}
export function result<T>(code:200|400|401|404|500|403|409,message:string='',data:T=null):Result<T>{
    if(code==200)return {
        code:code,
        message:message,
        data:data
    }
    if(code==400)return {
        code:code,
        message:'你发了个啥',
        data:null
    }
    if(code==401)return {
        code:code,
        message:'用户名或者密码错了',
        data:null
    }
    if(code==404)return {
            code:code,
            message:'查无此物',
            data:null
        }
    if(code==403)return {
        code:code,
        message:'你貌似没有权限',
        data:null
    }
    if(code==500)return {
        code:code,
        message:'服务器坏了,此外重要重要在重要的提醒:如果你是在拉取东西报此错误且其他功能正常,那么说明服务端文件哈希校验不通过' +
            '也就是服务端已经不可信任,不要在进行任何请求!',
        data:null
    }
    if(code==409)return {
        code:code,
        message:'你的帅名被抢先注册了',
        data:null
    }
}
export function sha256(str:string|Buffer){
    return crypto.createHash('sha256').update(str).digest('hex')
}
//常数没有意义只是瞎打
export function random(){
    const max=1145149178
    const array = new Uint32Array(1)
    crypto.getRandomValues(array)
    const limit = Math.floor(0xFFFFFFFF / max) * max
    let x
    do {
        crypto.getRandomValues(array)
        x = array[0]
    } while (x >= limit)
    return x % max+''
}
export const cfg_dir=()=>process.env.SPM_CONFIG_DIR||'.'
export function readConfig<T>(path:string){
    return JSON.parse(readFileSync(path,'utf-8')) as T
}
export function writeConfig<T>(data:T,path:string){
    writeFileSync(path,JSON.stringify(data))
}
export const configPath=cfg_dir()+'/data/'+'config.json'
export const configVMPath=cfg_dir()+'/data/'+'vm.json'
export const configModulePath=cfg_dir()+'/data/'+'module.json'
export const configPluginPath=cfg_dir()+'/data/'+'plugin.json'
export const configUserPath=cfg_dir()+'/data/'+'user.json'
export const configCompilerPath=cfg_dir()+'/data/'+'compiler.json'
export function EmailBody():Transporter<SMTPTransport.SentMessageInfo>{
    const config=readConfig<Config>(configPath)
    return nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: true,
        auth: {
            user: config.email.username,
            pass: config.email.password
        }
    })
}
export function hashVerify(uuid:string,hash:string){
    const data=readFileSync(cfg_dir()+'/'+uuid)
    const _hash=sha256(data)
    return hash==_hash
}
export function save(file:Buffer|string,name:string,version:string,license:string,data:DataConfig){
    const id=v6()
    data.get(name).lists.set(version,{local:id,license:license,hash:sha256(file),buffer:typeof file!='string'})
    writeFileSync(cfg_dir()+'/'+id,file)
    return data
}
export function register(name:string,author:string,description:string,data:DataConfig){
    data.set(name,{author:author,description:description,lists:new Map()})
    return data
}
export function verify(name:string,token:string,data:UserConfig){
    if(!data.users.has(name))return 401
    if(data.users.get(name).password!=sha256(token))return 401
    return 200
}
export function exists(name:string,data:DataConfig,version:string=null){
    if(!data.has(name))return false
    if(version==null)return true
    return data.get(name).lists.has(version)
}
export function get(name:string,version:string,data:DataConfig){
    let file:string|Buffer
    const d=data.get(name).lists.get(version)
    if(d.buffer)file=readFileSync(cfg_dir()+'/data/'+d.local)
    else file=readFileSync(cfg_dir()+'/data/'+d.local,'utf-8')
    if(sha256(file)!=d.hash)return null
    return file
}