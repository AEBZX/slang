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
    username:string,
    password:string
}
export type UserConfig={
    admin:string,
    users:User[]
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
export type DataConfig=Data[]