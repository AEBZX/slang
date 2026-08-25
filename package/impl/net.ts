import API from '../api.ts'
import type {Module, ModuleVersion, Result, VMConfig, VM, ModuleConfig, CompilerConfig, CompilerChild} from '../model'
import {readFileSync, writeFileSync} from 'fs'
import {createHash} from 'crypto'
import {existsSync} from 'fs'
import {mkdirSync} from 'fs'
//数据目录:默认 cwd;测试用 SPM_CONFIG_DIR 隔离
const dir=()=>process.env.SPM_CONFIG_DIR||'.'
export default class NetImpl extends API{
    publishModule(author:string,token: string,name:string, module: ModuleVersion, data: Buffer){
        let config=this.getModuleConfig().data
        if(!this.verify(author,token).data)return{
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
        if(pkg&&pkg.author!=author)return{
            message:'Author mismatch',
            data:null,
            code:400
        }
        if(pkg&&pkg.version.some(i=>i.version==module.version))return{
            message:'Version already exists',
            data:null,
            code:400
        }
        let source=''
        while(true){
            //随机32位16进制
            source = Math.random().toString(16).substring(2, 18)
            if(existsSync(dir()+'/data/'+source))continue
            break
        }
        module.source=source
        mkdirSync(dir()+'/data',{recursive:true})   //首次发布时创建数据目录
        writeFileSync(dir()+'/data/'+source,data)
        //已有 pkg 追加版本;新 pkg 才 push(此前 pkg 存在时也 push,列表出现重复模块)
        if(pkg)
            pkg.version.push(module)
        else
            config.push({
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
        if(!this.verify(author,token).data)return{
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
        let source=''
        while(true){
            source = Math.random().toString(16).substring(2, 18)
            if(existsSync(dir()+'/data/'+source))continue
            break
        }
        vm.source=source
        mkdirSync(dir()+'/data',{recursive:true})
        writeFileSync(dir()+'/data/'+source,data)
        config.push(vm)
        this.setVMConfig(config)
        return {
            message:'Success',
            data:null,
            code:200
        }
    }
    publishCompiler(author:string,token: string, version: string, compiler:CompilerChild, data: string){
        let config=this.getCompilerConfig().data
        if(!this.verify(author,token).data)return{
            message:'Unauthorized',
            data:null,
            code:401
        }
        if(compiler.hex!=createHash('sha256').update(data).digest('hex'))return{
            message:'Hash mismatch',
            data:null,
            code:400
        }
        //先找大版本(Compiler),不检查子版本号与父版本号的匹配
        let parent=config.find(i=>i.version==version)
        if(!parent)return{
            message:'Compiler version not found',
            data:null,
            code:404
        }
        if(parent.author!=author)
            return{
                message:'Author mismatch',
                data:null,
                code:400
            }
        //检查该大版本下是否已存在相同小版本
        if(parent.child.some(i=>i.version==compiler.version))
            return{
                message:'Version already exists',
                data:null,
                code:400
            }
        let source=''
        while(true){
            source = Math.random().toString(16).substring(2, 18)
            if(existsSync(dir()+'/data/'+source))continue
            break
        }
        compiler.source=source
        compiler.date=Date.now()
        mkdirSync(dir()+'/data',{recursive:true})
        writeFileSync(dir()+'/data/'+source,data)
        parent.child.push(compiler)
        this.setCompilerConfig(config)
        return {
            message:'Success',
            data:null,
            code:200
        }
    }
    createCompiler(author: string, token: string,license:string, version: string) {
        let config=this.getCompilerConfig().data
        if(!this.verify(author,token).data)return{
            message:'Unauthorized',
            data:null,
            code:401
        }
        if(config.some(i=>i.version==version))return{
            message:'Version already exists',
            data:null,
            code:400
        }
        config.push({
            version:version,
            license:license,
            author:author,
            child:[]
        })
        this.setCompilerConfig(config)
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
    listCompiler(){
        return {
            message:'Success',
            data:this.getCompilerConfig().data,
            code:200
        }
    }
    getModule(name: string, version: string){
        const pkg=this.getModuleConfig().data.find(i=>i.name==name)
        if(!pkg)return{message:'Module not found',data:null,code:404}
        const ver=pkg.version.find(i=>i.version==version)
        if(!ver)return{message:'Version not found',data:null,code:404}
        try{
            return {
                message:'Success',
                data:readFileSync(dir()+'/data/'+ver.source),
                code:200
            }
        }catch{
            return{message:'Data file missing',data:null,code:500}
        }
    }
    getVM(version: string){
        const vm=this.getVMConfig().data.find(i=>i.version==version)
        if(!vm)return{message:'VM not found',data:null,code:404}
        try{
            return {
                message:'Success',
                data:readFileSync(dir()+'/data/'+vm.source),
                code:200
            }
        }catch{
            return{message:'Data file missing',data:null,code:500}
        }
    }
    getCompiler(large_version:string,small_version:string){
        const config=this.getCompilerConfig().data
        const parent=config.find(i=>i.version==large_version)
        if(!parent)return{message:'Compiler not found',data:null,code:404}
        const compiler=parent.child.find(i=>i.version==small_version)
        if(!compiler)return{message:'Compiler not found',data:null,code:404}
        return {
            message:'Success',
            data:readFileSync(dir()+'/data/'+compiler.source,'utf-8'),
            code:200
        }
    }
}