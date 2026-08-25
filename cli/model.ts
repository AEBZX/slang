export type GlobalConfig={
    server:string,
    username:string,
    password:string,
    token:string
}
export const DefaultGlobalConfig={
    server:'',
    username:'',
    password:'',
    token:''
} as GlobalConfig
export type ProjectConfig={
    name:string
    version:string
    author:string
    license:string
    ignore:string[]
    optimize:number
    output:string
    venv:{
        dir:string,
        compiler:string,
        vm:string,
        compiler_version:string,
        vm_version:string
    }
    dependency:{name:string,version:string}[]
    lib:{local:string,data:{name:string,version:string}[]}
    lock?:{name:string,dependencies:{name:string,version:string}[]}[]
}
export type ModuleVersion={
    version:string,
    dependencies:{
        name:string,
        version:string
    }[],
    source:string,
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
    source:string,
    hex:string
}
export type Config={
    host:string,
    port:number,
    username:string,
    password:string,
    email:string,
    token:string,
    smtp:string
}
export type CompilerChild={
    version:string,
    hex:string,
    source:string
}
export type Compiler={
    author:string,
    version:string,
    license:string,
    child:CompilerChild[]
}
export type CompilerConfig=Compiler[]
export type ModuleConfig=Module[]
export type VMConfig=VM[]
export type UserConfig=User[]
export type Result<T>={
    message:string
    data:T,
    code:number
}