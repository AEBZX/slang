export type ModuleVersion={
    version:string,
    slang:string,
    dependencies:{
        name:string,
        version:string
    }[],
    source:number,
    hex:string
}
export type Module={
    name:string,
    author:string,
    keywords:string[],
    description: string,
    license:string,
    version:ModuleVersion[]
}
export type User={
    email:string,
    token:string,
    username:string
}
export type VM={
    version:string,
    isa:string,
    author:string,
    license:string,
    source:number,
    hex:string
}
export type Config={
    host:string,
    port:number,
    username:string,
    email:string,
    token:string,
    smtp:string,
    password:string,
    local:string
}
export type ModuleConfig=Module[]
export type VMConfig=VM[]
export type UserConfig=User[]
export type Result<T>={
    message:string
    data:T,
    code:number
}