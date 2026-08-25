import API from '../api.ts'
import type {CompilerConfig, Config, ModuleConfig, Result, User, UserConfig, VMConfig} from '../model'
import {readFileSync,writeFileSync} from 'fs'
import {} from '@inquirer/prompts'
//数据目录:默认 cwd;测试可用 SPM_CONFIG_DIR 隔离(进程 worker 不支持 chdir)
const dir=()=>process.env.SPM_CONFIG_DIR||'.'
export default class ConfigImpl extends API{
    getConfig() {
        return {
            data: JSON.parse(readFileSync(dir()+'/data/config.json', 'utf-8')) as Config,
            code:200,
            message:'success'
        }
    }
    setConfig(config: Config){
        writeFileSync(dir()+'/data/config.json', JSON.stringify(config, null, 4), 'utf-8')
        return {
            data: null,
            code: 200,
            message: 'success'
        }
    }
    getUserConfig() {
        return {
            data: JSON.parse(readFileSync(dir()+'/data/user.json', 'utf-8')) as UserConfig,
            code:200,
            message:'success'
        }
    }
    setUserConfig(config:UserConfig){
        writeFileSync(dir()+'/data/user.json', JSON.stringify(config, null, 4), 'utf-8')
        return {
            data: null,
            code: 200,
            message: 'success'
        }
    }
    getVMConfig() {
        return {
            data: JSON.parse(readFileSync(dir()+'/data/vm.json', 'utf-8')) as VMConfig,
            code:200,
            message:'success'
        }
    }
    setVMConfig(config: VMConfig){
        writeFileSync(dir()+'/data/vm.json', JSON.stringify(config, null, 4), 'utf-8')
        return {
            data: null,
            code: 200,
            message: 'success'
        }
    }
    getModuleConfig() {
        return {
            data: JSON.parse(readFileSync(dir()+'/data/module.json', 'utf-8')) as ModuleConfig,
            code:200,
            message:'success'
        }
    }
    setModuleConfig(config: ModuleConfig){
        writeFileSync(dir()+'/data/module.json', JSON.stringify(config, null, 4), 'utf-8')
        return {
            data: null,
            code: 200,
            message: 'success'
        }
    }
    getCompilerConfig() {
        return {
            data: JSON.parse(readFileSync(dir()+'/data/compiler.json', 'utf-8')) as CompilerConfig,
            code:200,
            message:'success'
        }
    }
    setCompilerConfig(config: CompilerConfig){
        writeFileSync(dir()+'/data/compiler.json', JSON.stringify(config, null, 4), 'utf-8')
        return {
            data: null,
            code: 200,
            message: 'success'
        }
    }
}