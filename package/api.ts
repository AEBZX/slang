import {Config, ModuleConfig, ModuleVersion, Result, UserConfig, VMConfig,VM} from './model'

export default abstract class API{
    getConfig():Result<Config>{return null}
    getUserConfig():Result<UserConfig>{return null}
    getModuleConfig():Result<ModuleConfig>{return null}
    getVMConfig():Result<VMConfig>{return null}
    setConfig(config:Config):Result<void>{return null}
    setUserConfig(config:UserConfig):Result<void>{return null}
    setModuleConfig(config:ModuleConfig):Result<void>{return null}
    setVMConfig(config:VMConfig):Result<void>{return null}
    register(username:string,email:string):Result<void>{return null}
    login(username:string,password:string):Result<void>{return null}
    publishModule(author:string,token:string,name:string,module:ModuleVersion,data:Buffer):Result<void>{return null}
    publishVM(author:string,token:string,vm:VM,data:Buffer):Result<void>{return null}
    listModule():Result<ModuleConfig>{return null}
    listVM():Result<VMConfig>{return null}
    getModule(name:string,version:string):Result<Buffer>{return null}
    getVM(version:string):Result<Buffer>{return null}
    verify(username:string,token:string):Result<boolean>{return null}
}