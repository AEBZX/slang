import API from '../api'
import {Module, ModuleVersion, Result, VMConfig, VM, ModuleConfig} from '../model'
import {readFileSync, writeFileSync} from 'fs'
import {createHash} from 'crypto'
import {existsSync} from 'fs'
export default class NetImpl extends API{
    publishModule(author:string,token: string,name:string, module: ModuleVersion, data: Buffer){
        let config=this.getModuleConfig().data
        let user=this.getUserConfig().data
        let ok=false
        for(let i of user)
            if(i.username==author&&i.token==token) {
                ok = true
                break
            }
        if(!ok)return{
            message:'Unauthorized',
            data:null,
            code:401
        }
        //哈希值校验
        if(module.hex!=createHash('sha256').update(data).digest('hex'))return{
            message:'Hash mismatch',
            data:null,
            code:400
        }
        let pkg:Module=null
        for(let i of config)
            if(i.name==name) {
                pkg = i
                break
            }
        let source=''
        while(true){
            //随机32位16进制
            source = Math.random().toString(16).substring(2, 18)
            if(existsSync('data/'+source))continue
            break
        }
        module.source=source
        writeFileSync('data/'+source,data)
        if(pkg)pkg.version.push(module)
        config.push(pkg?pkg:{
            name:name,
            author:author,
            keywords:[],
            description:'',
            license:'',
            version:[module]
        })
        this.setModuleConfig(config)
        return {
            message:'Success',
            data:null,
            code:200
        }
    }
    publishVM(author:string,token: string, vm: VM, data: Buffer){
        let config=this.getVMConfig().data
        let user=this.getUserConfig().data
        let ok=false
        for(let i of user)
            if(i.username==author&&i.token==token) {
                ok = true
                break
            }
        if(!ok)return{
            message:'Unauthorized',
            data:null,
            code:401
        }
        if(vm.hex!=createHash('sha256').update(data).digest('hex'))return{
            message:'Hash mismatch',
            data:null,
            code:400
        }
        for(let i of config)
            if(i.version==vm.version)
                return{
                    message:'Version already exists',
                    data:null,
                    code:400
                }
        if(vm.author!=author)
            return{
                message:'Author mismatch',
                data:null,
                code:400
            }
        config.push(vm)
        this.setVMConfig(config)
        return {
            message:'Success',
            data:null,
            code:200
        }
    }
    listVM(){
        return {
            message:'Success',
            data:this.getVMConfig().data,
            code:200
        }
    }
    listModule(){
        return {
            message:'Success',
            data:this.getModuleConfig().data,
            code:200
        }
    }
    getModule(name: string, version: string){
        return {
            message:'Success',
            data:readFileSync('data/'+this.getModuleConfig().data.find(i=>i.name==name).version.find(i=>i.version==version).source),
            code:200
        }
    }
    getVM(version: string){
        return {
            message:'Success',
            data:readFileSync('data/'+this.getVMConfig().data.find(i=>i.version=version).source),
            code:200
        }
    }
}