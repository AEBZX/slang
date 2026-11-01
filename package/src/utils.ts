import {EmailData, Result} from './model.ts'
import Mail from 'nodemailer'
import SMTPTransport from 'nodemailer/lib/smtp-transport'
import crypto from 'crypto'
import {writeFileSync,readFileSync} from 'fs'
function email_send(EMailTool: Mail.Transporter<SMTPTransport.SentMessageInfo, SMTPTransport.Options>,
                    from: string, to: string, subject: string, content: string,fallback:(success:boolean)=>void) {
    EMailTool.sendMail({
        from: from,
        to: to,
        subject: subject,
        text: content
    }).then(r => fallback(true)).catch(e => fallback(false))
}
function result<T>(code:200|400|401|404|500|403,message:string='',data:T=null):Result<T>{
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
        message:'这边建议登录一下',
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
}
function sha256(str:string){
    return crypto.createHash('sha256').update(str).digest('hex')
}
function random(){
    return Math.random()+'';
}
function readConfig<T>(path:string){
    return JSON.parse(readFileSync(path,'utf-8')) as T
}
function writeConfig<T>(data:T,path:string){
    writeFileSync(path,JSON.stringify(data))
}