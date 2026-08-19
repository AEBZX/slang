import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import APIImpl from './impl'
import API from './api'
import {Result} from './model'
import {input} from '@inquirer/prompts'
import fs from 'fs'
const _cors=cors()
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    message:{
        code:200,
        message:'请求过于频繁，请稍后再试',
        data:null
    },
    standardHeaders: true,
    legacyHeaders: false
})
let app=express()
let api:API=new APIImpl()
app.use(express.json())
app.use(_cors)
app.use(limiter)
app.use(express.raw({
    type: '*/*',
    limit: '1024mb'
}))
//检查是否存在配置文件
if(!fs.existsSync('./config.json')){
    const username = await input({message: '请输入用户名:',default:'Admin'})
    const password = await input({message: '请输入密码:',default:'password'})
    const host=await input({message: '请输入启动地址:',default:'0.0.0.0'})
    const port=parseInt(await input({message: '请输入启动端口号:',default:'2319'}))
    const email=await input({message: '请输入邮箱:',default:'email'})
    const smtp=await input({message: '请输入SMTP地址:',default:'smtp'})
    const token=await input({message: '请输入Token:',default:'token'})
    fs.writeFileSync('./config.json',JSON.stringify({
        host:host,
        port:port,
        username:username,
        password:password,
        email:email,
        token:token,
        smtp:smtp
    },null,4))
    fs.writeFileSync('./user.json',JSON.stringify([],null,4))
    fs.writeFileSync('./module.json',JSON.stringify([],null,4))
    fs.writeFileSync('./vm.json',JSON.stringify([],null,4))
}
let conf=api.getConfig().data
app.post('/api/download/vm',(req,res)=>{
    let {version}=req.body
    let data=api.getVM(version)
    res.send({
        message:data.message,
        data:data.data.toString('base64'),
        code:data.code
    })
})
app.post('/api/download/module',(req,res)=>{
    let {name,version}=req.body
    let data=api.getModule(name,version)
    res.send({
        message:data.message,
        data:data.data.toString('base64'),
        code:data.code
    })
})
app.get('/api/list/vm',(req,res)=>{
    res.send(api.listVM())
})
app.get('/api/list/module',(req,res)=>{
    res.send(api.listModule())
})
app.post('/api/publish/vm',(req,res)=>{
    let {author,token,module,data}=req.body
    let d=Buffer.from(data,'base64')
    res.send(api.publishVM(author,token,module,d))
})
app.post('/api/publish/module',(req,res)=>{
    let {author,token,name,module,data}=req.body
    let d=Buffer.from(data,'base64')
    res.send(api.publishModule(author,token,name,module,d))
})
app.get('/api/register',(req,res)=>{
    let {username,email}=req.body
    res.send(api.register(username,email))
})
app.listen(conf.port,conf.host,()=>{})