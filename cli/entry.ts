import command from './command.ts'
import {Command} from 'commander'
import {fileURLToPath, pathToFileURL} from 'node:url'

export function build_command(){
    let c=new Command()
    //版本标志避开 --version:commander 15 顶层 --version 会拦截所有子命令的同名 option
    c.version('1.0.0', '-V, --ver')
    c.name('slang')
    c.description('slang工具链')
    c.command('init')
        .description('初始化slang项目')
        .action(command.init)
    c.command('compiler')
        .description('编译slang项目')
        .action(()=>command.compiler())
    c.command('run')
        .description('运行slang项目')
        .action(()=>command.run())
    c.command('go')
        .description('编译并运行slang项目')
        .action(command.go)
    c.command('install')
        .option('--name <name>', '库名')
        .option('--version <version>', '版本号')
        .description('安装库')
        .action(async (options:{name:string,version:string})=>{
            await command.install(options.name, options.version)
        })
    c.command('uninstall')
        .argument('<name>','库名')
        .description('卸载库')
        .action(async (name:string)=>{
            await command.uninstall(name)
        })
    //publish 子命令组
    let publish=c.command('publish').description('发布')
    publish.command('module')
        .description('发布模块')
        .action(command.publish_module)
    publish.command('vm')
        .description('发布vm')
        .option('--path <path>', 'vm文件路径')
        .option('--license <license>', '许可证')
        .option('--isa <isa>','指令集')
        .option('--version <version>','版本')
        .action(async (options:{path:string,license:string,isa:string,version:string})=>{
            //publish_vm(local,version,isa,license) —— 与函数签名顺序一致,不能按 option 声明顺序传
            await command.publish_vm(options.path, options.version, options.isa, options.license)
        })
    publish.command('compiler')
        .description('发布编译器')
        .option('--path <path>','compiler文件路径')
        .option('--large <large>', '所属编译器大版本')
        .option('--small <small>','编译器版本')
        .action(async (options:{path:string,large:string,small:string})=>{
            await command.publish_compiler(options.path, options.large, options.small)
        })
    //create 子命令组
    let create=c.command('create').description('创建')
    create.command('compiler')
        .description('创建编译器大版本')
        .option('--license <license>', '许可证')
        .option('--version <version>', '版本号')
        .action(async (options:{license:string,version:string})=>{
            await command.create_compiler(options.license, options.version)
        })
    //config 子命令组
    let config=c.command('config').description('配置')
    config.command('set')
        .description('设置配置')
        .argument('<key>', '配置键')
        .argument('<value>', '配置值')
        .action(async (key:string,value:string)=>{
            await command.config_set(key,value)
        })
    config.command('verify')
        .description('校验配置')
        .action(command.config_verify)
    c.command('register')
        .description('注册账号')
        .option('--username <username>', '用户名')
        .option('--email <email>', '邮箱')
        .action(async (options:{username:string,email:string})=>{
            await command.register(options.username, options.email)
        })
    return c
}

//直接运行时才解析参数;被 import(如测试)时不执行
if(import.meta.url===pathToFileURL(process.argv[1]).href)
    build_command().parse()
