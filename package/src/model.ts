import {Request,Response} from 'express'

export type EmailData={
    host:string,
    port:string,
    username:string,
    password:string,
}
export type Result<T>={
    message:string
    data:T,
    code:number
}
export type User={
    password:string,
    login:boolean,
    email:string
}
export type UserConfig={
    admin:string,
    users:Map<string,User>
}
export type Data={
    name:string,
    description:string,
    hash:string,
    local:string,
    author:string,
    version:string,
    license:string
}
export type Config={
    host:string
    port:string
    user:string
    password:string
    email:EmailData
}
export type DataConfig=Data[]
export type route=(res:Response,req:Request)=>void