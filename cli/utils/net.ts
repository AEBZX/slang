import {
    Compiler,
    CompilerConfig,
    ModuleConfig,
    Result,
    VM,
    VMConfig,
    Module,
    ModuleVersion,
    CompilerChild
} from '../model.ts'
import ajax from './ajax.ts'
function check<T>(res:Result<T>){
    if(res.code!=200)throw new Error(res.message)
    return res.data
}
async function download_vm(version:string){
    return Buffer.from(check((await ajax.post('/api/download/vm',{version})).data) as string,'base64')
}
async function download_module(name:string,version:string){
    return Buffer.from(check((await ajax.post('/api/download/module',{name,version})).data) as string,'base64')
}
async function download_compiler(large_version:string,small_version:string){
    return check<string>((await ajax.post('/api/download/compiler',{large_version,small_version})).data)
}
async function list_vm(){
    return check<VMConfig>((await ajax.get('/api/list/vm')).data)
}
async function list_module(){
    return check<ModuleConfig>((await ajax.get('/api/list/module')).data)
}
async function list_compiler(){
    return check<CompilerConfig>((await ajax.get('/api/list/compiler')).data)
}
async function publish_vm(author:string,token:string,module:VM,data:Buffer){
    //服务端 publishVM 接收 base64 字符串(Buffer.from(data,'base64')),直接传 Buffer 会被 axios 序列化成 JSON 数组
    return check<void>((await ajax.post('/api/publish/vm',{author,token,module,data:data.toString('base64')})).data)
}
async function publish_module(name:string,author:string,token:string,module:ModuleVersion,data:Buffer){
    //注意:必须传 name,服务端 publishModule 的 body 需要 name 字段
    return check<void>((await ajax.post('/api/publish/module',{name,author,token,module,data:data.toString('base64')})).data)
}
async function publish_compiler(author:string,token:string,version:string,type:CompilerChild,data:string){
    return check<void>((await ajax.post('/api/publish/compiler/add',{author,token,version,type,data})).data)
}
async function create_compiler(author:string,token:string,license:string,version:string){
    return check<void>((await ajax.post('/api/publish/compiler/create',{author,token,license,version})).data)
}
async function register(username:string,email:string){
    return check<void>((await ajax.post('/api/register',{username,email})).data)
}
async function verify(username:string,token:string){
    let health=(await ajax.get('/api/health')).data as Result<void>
    if(health.message!='is SPM Server')return '不是SPM服务器'
    let res=(await ajax.post('/api/verify',{username,token})).data as Result<boolean>
    if(res.code!=200||!res.data)return '用户不存在或者token配置不正确'
    return ''
}
export default {
    download:{
        vm:download_vm,
        module:download_module,
        compiler:download_compiler
    },
    list:{
        vm:list_vm,
        module:list_module,
        compiler:list_compiler
    },
    publish:{
        vm:publish_vm,
        module:publish_module,
        compiler:publish_compiler,
        compiler_create:create_compiler
    },
    user:{
        register:register,
        verify:verify
    }
}