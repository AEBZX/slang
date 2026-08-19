import API from '../api'
import {Config, ModuleConfig, Result, User, UserConfig, VMConfig} from '../model'
import {readFileSync,writeFileSync} from 'fs'
import {} from '@inquirer/prompts'
export default class ConfigImpl extends API{
    getConfig() {
        return {
            data: JSON.parse(readFileSync('./config.json', 'utf-8')) as Config,
            code:200,
            message:'success'
        }
    }
    setConfig(config: Config){
        writeFileSync('./config.json', JSON.stringify(config, null, 4), 'utf-8')
        return {
            data: null,
            code: 200,
            message: 'success'
        }
    }
    getUserConfig() {
        return {
            data: JSON.parse(readFileSync('./user.json', 'utf-8')) as UserConfig,
            code:200,
            message:'success'
        }
    }
    setUserConfig(config:UserConfig){
        writeFileSync('./user.json', JSON.stringify(config, null, 4), 'utf-8')
        return {
            data: null,
            code: 200,
            message: 'success'
        }
    }
    getVMConfig() {
        return {
            data: JSON.parse(readFileSync('./vm.json', 'utf-8')) as VMConfig,
            code:200,
            message:'success'
        }
    }
    setVMConfig(config: VMConfig){
        writeFileSync('./vm.json', JSON.stringify(config, null, 4), 'utf-8')
        return {
            data: null,
            code: 200,
            message: 'success'
        }
    }
    getModuleConfig() {
        return {
            data: JSON.parse(readFileSync('./module.json', 'utf-8')) as ModuleConfig,
            code:200,
            message:'success'
        }
    }
    setModuleConfig(config: ModuleConfig){
        writeFileSync('./module.json', JSON.stringify(config, null, 4), 'utf-8')
        return {
            data: null,
            code: 200,
            message: 'success'
        }
    }
}