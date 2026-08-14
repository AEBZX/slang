export type GlobalConfig={
    local:string
    default_optimize:number
    server:string
    vm:string
    vm_list:{version:string,local:string,name:string}[]
}
export const DefaultGlobalConfig={
    local:'~/.slang',
    default_optimize:2,
    server:'',
    vm:'~/slang/vm.exe',
    vm_list:[]
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
}