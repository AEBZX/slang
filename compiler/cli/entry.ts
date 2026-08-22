import {compiler,start,run,init,install,uninstall,pvm,publish,config as C} from './command'
import {Command} from 'commander'
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'fs'
import {DefaultGlobalConfig, GlobalConfig, ProjectConfig} from './config'
import * as process from 'node:process'
import * as os from 'node:os'
import * as path from 'node:path'
function readGlobal(){
    let file=path.join(os.homedir(),'.slang','config.json')
    if(!existsSync(file)){
        let config=DefaultGlobalConfig
        mkdirSync(path.dirname(file),{recursive:true})
        writeFileSync(file,JSON.stringify(config,null,4))
        return config
    }
    return JSON.parse(readFileSync(file,'utf-8')) as GlobalConfig
}
function readProject(){
    let data=readFileSync(process.cwd()+'/slang.json','utf-8')
    if(!data)throw new Error('project config file not found')
    return JSON.parse(data) as ProjectConfig
}
const program=new Command()
program.name('slang')
program.version('1.0.0')
program
    .command('compiler')
    .description('compile slang project')
    .action(()=>{
        compiler(readGlobal(),readProject())
    })
program
    .command('start')
    .description('start slang bin')
    .argument('[file]', 'sbin 文件')
    .action((file: string, options, command) => {
        start(readProject().vm,file)
    })
program
    .command('run')
    .description('run slang project')
    .action(()=>{
        run(readGlobal(),readProject())
    })
program
    .command('init')
    .description('init slang project')
    .action(async ()=>{
        //必须传 readGlobal():init 内部用 global.server 请求 VM 列表,
        //此前裸调 init() 无 global 参数,函数内 global 是 Node 全局对象,
        //global.server 恒 undefined → 从不请求 → vm_list 空 → select default 崩
        await init(readGlobal())
    })
program
    .command('install')
    .description('install slang package')
    .argument('<name>', 'package name')
    .argument('<version>', 'package version')
    .action(async (name: string, version: string) => {
        await install(readGlobal(),readProject(),name,version)
    })
program
    .command('uninstall')
    .description('uninstall slang package')
    .argument('<name>', 'package name')
    .action((name: string) => {
        uninstall(readGlobal(),readProject(),name)
    })
program
    .command('pvm')
    .description('compile slang vm')
    .argument('<path>', 'path')
    .argument('<isa>', 'isa')
    .argument('<version>', 'version')
    .argument('<license>', 'license')
    .action(async (path: string, isa: string, version: string, license: string) => {
        await pvm(readGlobal(),path,isa,version,license)
    })
program
    .command('publish')
    .description('publish slang package')
    .action(async ()=>{
        await publish(readGlobal(),readProject())
    })
program
    .command('config')
    .description('config slang')
    .argument('<config>', 'config name')
    .argument('<value>', 'config value')
    .action((config: string, value: string) => {
        C(config,value)
    })
try{
    await program.parseAsync()
}catch(e:any){
    console.error(e?.message||e)
    process.exit(1)
}