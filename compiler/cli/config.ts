export type GlobalConfig={
    server:string,
    username:string,
    password:string
}
export const DefaultGlobalConfig={
    server:'',
    username:'',
    password:''
} as GlobalConfig
export type ProjectConfig={
    name:string
    version:string
    author:string
    license:string
    ignore:string[]
    optimize:number
    output:string
    vm:string
    lib:{local:string,data:{name:string,version:string}[]}
    lock:{name:string,dependencies:{name:string,version:string}[]}[]
}