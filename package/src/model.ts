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
    description:string,
    author:string,
    lists:Map<string,{
        local:string
        license:string
        hash:string
        buffer:boolean
    }>
}
export type DataConfig=Map<string,Data>
export type Config={
    host:string
    port:string
    user:string
    password:string
    email:EmailData
}
export type route=(res:Response,req:Request)=>void