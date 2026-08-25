import type {
    Config,
    ModuleConfig,
    ModuleVersion,
    Result,
    UserConfig,
    VMConfig,
    VM,
    CompilerConfig,
    CompilerChild
} from './model.ts'

export default abstract class API{
    getConfig():Result<Config>{return null}
    getUserConfig():Result<UserConfig>{return null}
    getModuleConfig():Result<ModuleConfig>{return null}
    getVMConfig():Result<VMConfig>{return null}
    getCompilerConfig():Result<CompilerConfig>{return null}
    setConfig(config:Config):Result<void>{return null}
    setUserConfig(config:UserConfig):Result<void>{return null}
    setModuleConfig(config:ModuleConfig):Result<void>{return null}
    setVMConfig(config:VMConfig):Result<void>{return null}
    setCompilerConfig(config:CompilerConfig):Result<void>{return null}
    register(username:string,email:string):Result<void>{return null}
    login(username:string,password:string):Result<void>{return null}
    publishModule(author:string,token:string,name:string,module:ModuleVersion,data:Buffer):Result<void>{return null}
    publishVM(author:string,token:string,vm:VM,data:Buffer):Result<void>{return null}
    publishCompiler(author:string,token:string,version:string,type:CompilerChild,data:string):Result<void>{return null}
    createCompiler(author:string,token:string,license:string,version:string):Result<void>{return null}
    listModule():Result<ModuleConfig>{return null}
    listVM():Result<VMConfig>{return null}
    listCompiler():Result<CompilerConfig>{return null}
    getModule(name:string,version:string):Result<Buffer>{return null}
    getVM(version:string):Result<Buffer>{return null}
    getCompiler(large_version:string,small_version:string):Result<string>{return null}
    verify(username:string,token:string):Result<boolean>{return null}
}