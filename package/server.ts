import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import APIImpl from './impl/index.ts'
import API from './api.ts'
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
export let app=express()
let api:API=new APIImpl()
app.use(express.json({limit:'1024mb'}))
app.use(_cors)
app.use(limiter)
app.use(express.raw({
    type: '*/*',
    limit: '1024mb'
}))
const cfg_dir=()=>process.env.SPM_CONFIG_DIR||'.'
//数据文件已统一到 data/ 子目录(impl/config.ts 读 dir()+'/data/config.json'),
//首次启动检查/写入必须与之一致,否则生成的文件永远不会被读到
if(!fs.existsSync(cfg_dir()+'/data/config.json')){
    const username = await input({message: '请输入用户名:',default:'Admin'})
    const password = await input({message: '请输入密码:',default:'password'})
    const host=await input({message: '请输入启动地址:',default:'0.0.0.0'})
    const port=parseInt(await input({message: '请输入启动端口号:',default:'2319'}))
    const email=await input({message: '请输入邮箱:',default:'email'})
    const smtp=await input({message: '请输入SMTP地址:',default:'smtp'})
    const token=await input({message: '请输入Token:',default:'token'})
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
let conf=api.getConfig().data
app.post('/api/download/vm',(req,res)=>{
    let {version}=req.body
    let data=api.getVM(version)
    if(data.code!==200){
        res.send(data)
        return
    }
    res.send({
        message:data.message,
        data:data.data.toString('base64'),
        code:data.code
    })
})
app.post('/api/download/module',(req,res)=>{
    let {name,version}=req.body
    let data=api.getModule(name,version)
    if(data.code!==200){
        res.send(data)
        return
    }
    res.send({
        message:data.message,
        data:data.data.toString('base64'),
        code:data.code
    })
})
app.post('/api/download/compiler',(req,res)=>{
    let {large_version,small_version}=req.body
    let data=api.getCompiler(large_version,small_version)
    if(data.code!==200){
        res.send(data)
        return
    }
    res.send({
        message:data.message,
        data:data.data,
        code:data.code
    })
})
app.get('/api/list/vm',(req,res)=>{
    res.send(api.listVM())
})
app.get('/api/list/module',(req,res)=>{
    res.send(api.listModule())
})
app.get('/api/list/compiler',(req,res)=>{
    res.send(api.listCompiler())
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
app.post('/api/publish/compiler/add',(req,res)=>{
    let {author,token,version,type,data}=req.body
    res.send(api.publishCompiler(author,token,version,type,data))
})
app.post('/api/publish/compiler/create',(req,res)=>{
    let {author,token,license,version}=req.body
    res.send(api.createCompiler(author,token,license,version))
})
app.post('/api/register',(req,res)=>{
    let {username,email}=req.body
    res.send(api.register(username,email))
})
app.post('/api/verify',(req,res)=>{
    let {username,token}=req.body
    res.send(api.verify(username,token))
})
app.get('/api/health',(req,res)=>{
    res.send({
        code:200,
        message:'is SPM Server',
        data:null
    })
})
app.use((err:any, req:any, res:any, next:any)=>{
    const code=err.status||err.statusCode||500
    res.status(code).send({code,message:err.message||'Internal error',data:null})
})
if(import.meta.url===pathToFileURL(process.argv[1]).href)
    app.listen(conf.port,conf.host,()=>{})