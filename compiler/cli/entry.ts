import {compiler,start,run,init} from './command'
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
        start(readGlobal().vm,file)
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
    .action(()=>{
        init()
    })
await program.parseAsync()