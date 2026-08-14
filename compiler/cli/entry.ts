import {compiler,start,run,init} from './command'
import {Command} from 'commander'
import {readFileSync, writeFileSync} from 'fs'
import {DefaultGlobalConfig, GlobalConfig, ProjectConfig} from './config'
import * as process from 'node:process'
function readGlobal(){
    let data=readFileSync('~/slang/config.json','utf-8')
    if(!data){
        let config=DefaultGlobalConfig
        writeFileSync('~/slang/config.json',JSON.stringify(config,null,4))
        return config
    }
    return JSON.parse(data) as GlobalConfig
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
    .action(()=>{})
program.parse()