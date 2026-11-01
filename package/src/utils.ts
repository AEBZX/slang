import {Config, EmailData, Result} from './model'
import nodemailer, {Mail, Transporter} from 'nodemailer'
import SMTPTransport from 'nodemailer/lib/smtp-transport'
import crypto from 'crypto'
import {writeFileSync,readFileSync} from 'fs'
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
        message:'服务器坏了',
        data:null
    }
    if(code==409)return {
        code:code,
        message:'你的帅名被抢先注册了',
        data:null
    }

}
export function sha256(str:string){
    return crypto.createHash('sha256').update(str).digest('hex')
}
//常数没有意义只是瞎打
export function random(){
    return Math.floor(Math.random()*234512)+'';
}
export function readConfig<T>(path:string){
    return JSON.parse(readFileSync(path,'utf-8')) as T
}
export function writeConfig<T>(data:T,path:string){
    writeFileSync(path,JSON.stringify(data))
}
export const configPath=process.cwd()+'/data/'+'config.json'
export const configVMPath=process.cwd()+'/data/'+'vm.json'
export const configModulePath=process.cwd()+'/data/'+'module.json'
export const configPluginPath=process.cwd()+'/data/'+'plugin.json'
export const configUserPath=process.cwd()+'/data/'+'user.json'
export const configCompilerPath=process.cwd()+'/data/'+'compiler.json'
export const cfg_dir=()=>process.env.SPM_CONFIG_DIR||'.'
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
