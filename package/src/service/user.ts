import {route, UserConfig} from '../model'
import {configUserPath, email_send, EmailBody, random, readConfig, result, sha256, writeConfig} from '../utils'
const UserRegister:route=(res,req)=>{
    const {username,email} = req.body as {username:string,email:string}
    const user_config=readConfig<UserConfig>(configUserPath)
    if(user_config.users.has(username))return result(409)
    const token=sha256(random())
    email_send(EmailBody(),'SPMServer',email,'你的token',
        `这是你的token,不要随便告诉其他人除非你喜欢被盗号,:${token}`,(success:boolean)=>{
            if(success){
                user_config.users.set(username,{password:sha256(token),login:false,email:email})
                res.send(result(200,'注册成功',{}))
            }
            if(!success)res.send(result(500))
        })
    return null
}
export default new Map<string,route>([
    ['/user/register',UserRegister]
])