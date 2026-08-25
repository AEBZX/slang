import API from '../api.ts'
import type {Result} from '../model'
import Crypto from 'crypto'
import Mail from 'nodemailer'
export default class UserImpl extends API{
    register(username:string,email:string){
        if(!username||!email)return{
            message:'Username and email required',
            data:null,
            code:400
        }
        //生成随机token
        const token = Crypto.createHash('sha256').update(Math.random().toString()).digest('hex')
        let config=this.getConfig().data
        let user=this.getUserConfig().data
        for(let i of user)if(i.username==username)return {
            message:'User already exists',
            data:null,
            code:400
        }
        for(let i of user)if(i.email==email)return {
            message:'Email already registered',
            data:null,
            code:400
        }
        const Email=Mail.createTransport({
            host: config.smtp,
            port: 465,
            secure: true,
            auth: {
                user: config.email,
                pass: config.token
            }
        })
        //SMTP 不可用时邮件发送失败不影响注册
        Email.sendMail({
            from: config.email,
            to: email,
            subject: 'SPM Registration',
            text: 'Your token is '+token
        }).catch(()=>{})
        user.push({
            email:email,
            username:username,
            token:token
        })
        this.setUserConfig(user)
        return {
            message:'Registration successful',
            data:null,
            code:200
        }
    }
    verify(username: string, token: string) {
        let user = this.getUserConfig().data
        for (let i of user) if (i.username == username && i.token == token) return {
            message: 'Verification successful',
            data: true,
            code: 200
        }
        return {
            message: 'Invalid username or token',
            data: false,
            code: 400
        }
    }
}