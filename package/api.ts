import {Config, ModuleConfig, ModuleVersion, Result, UserConfig, VMConfig} from './model'

export default abstract class API{
    init():Result<void>{return null}
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
    publishModule(token:string,module:ModuleVersion,data:Buffer):Result<void>{return null}
    publishVM(token:string,vm:VMConfig,data:Buffer):Result<void>{return null}
    listModule():Result<ModuleConfig>{return null}
    listVM():Result<VMConfig>{return null}
    getModule(name:string,version:string):Result<Buffer>{return null}
    getVM(name:string,version:string):Result<Buffer>{return null}
    verify(username:string,token:string):Result<boolean>{return null}
}