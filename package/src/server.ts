import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import {input} from '@inquirer/prompts'
import fs from 'fs'
import * as path from 'path'
import {fileURLToPath, pathToFileURL} from 'url'
const __dirname=path.dirname(fileURLToPath(import.meta.url))
const _cors=cors()
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    message:{
        code:429,
        message:'请求过于频繁，请稍后再试',
        data:null
    },
    standardHeaders: true,
    legacyHeaders: false
})
let app=express()
app.use(express.json({limit:'1024mb'}))
app.use(_cors)
app.use(limiter)
app.use(express.raw({
    type: '*/*',
    limit: '1024mb'
}))
const cfg_dir=()=>process.env.SPM_CONFIG_DIR||'.'
if(!fs.existsSync(cfg_dir()+'/data/config.json')){
    const username = await input({message: '请输入用户名:',default:'Admin'})
    const password = await input({message: '请输入密码:',default:'asdfghjkl'})
    const host=await input({message: '请输入启动地址:',default:'0.0.0.0'})
    const port=parseInt(await input({message: '请输入启动端口号:',default:'2319'}))
    const email=await input({message: '请输入邮箱:',default:''})
    const smtp=await input({message: '请输入SMTP地址:',default:''})
    const token=await input({message: '请输入Token:',default:''})
    fs.mkdirSync(cfg_dir()+'/data',{recursive:true})
    fs.writeFileSync(cfg_dir()+'/data/config.json',JSON.stringify({
        host:host,
        port:port,
        username:username,
        password:password,
        email:email,
        token:token,
        smtp:smtp
    },null,4))
    fs.writeFileSync(cfg_dir()+'/data/user.json',JSON.stringify([],null,4))
    fs.writeFileSync(cfg_dir()+'/data/module.json',JSON.stringify([],null,4))
    fs.writeFileSync(cfg_dir()+'/data/vm.json',JSON.stringify([],null,4))
    fs.writeFileSync(cfg_dir()+'/data/compiler.json',JSON.stringify([],null,4))
}
app.use((err:any, req:any, res:any, next:any)=>{
    const code=err.status||err.statusCode||500
    res.status(code).send({code,message:err.message||'Internal error',data:null})
})
if(import.meta.url===pathToFileURL(process.argv[1]).href)
    app.listen(null,null,()=>{})