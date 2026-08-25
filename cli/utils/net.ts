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
    return check<string>(await ajax.post('/api/download/compiler',{large_version,small_version}))
}
async function list_vm(){
    return check<VMConfig>(await ajax.get('/api/list/vm'))
}
async function list_module(){
    return check<ModuleConfig>(await ajax.get('/api/list/module'))
}
async function list_compiler(){
    return check<CompilerConfig>(await ajax.get('/api/list/compiler'))
}
async function publish_vm(author:string,token:string,module:VM,data:Buffer){
    return check<void>(await ajax.post('/api/publish/vm',{author,token,module,data}))
}
async function publish_module(author:string,token:string,module:ModuleVersion,data:Buffer){
    return check<void>(await ajax.post('/api/publish/module',{author,token,module,data}))
}
async function publish_compiler(author:string,token:string,version:string,type:CompilerChild,data:string){
    return check<void>(await ajax.post('/api/publish/compiler/add',{author,token,version,type,data}))
}
async function create_compiler(author:string,token:string,license:string,version:string){
    return check<void>(await ajax.post('/api/publish/compiler/create',{author,token,license,version}))
}
async function register(username:string,email:string){
    return check<void>(await ajax.post('/api/register',{username,email}))
}
async function verify(username:string,token:string){
    if(((await ajax.get('/api/health')).data as Result<void>).message!='is SPM Server')return '不是SPM服务器'
    return check<boolean>(await ajax.post('/api/verify',{username,token}))?'':'用户不存在或者token配置不正确'
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