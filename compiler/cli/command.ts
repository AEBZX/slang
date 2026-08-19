import {GlobalConfig, ProjectConfig} from './config'
import {readdirSync,writeFileSync,readFileSync} from 'fs'
import c from '../index'
import * as path from 'path'
import * as process from 'process'
import { spawn } from 'child_process'
import {input,select,confirm} from '@inquirer/prompts'
export function compiler(global:GlobalConfig,project:ProjectConfig,dir:string=process.cwd()){
    let output=dir+'/'+project.output+'.sbin'
    //寻找目录下所有.sl文件
    const file: string[] = []
    const file_name:string[]=[]
    let walk=(dir:string)=>{
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name)
            if (e.isDirectory()&&!project.ignore.includes(e.name))
                walk(full)
            else if (e.isFile()&&e.name.endsWith('.sl')&&!project.ignore.includes(e.name.substring(0,e.name.length-4))) {
                //传入源码内容,而非文件路径
                file.push(readFileSync(full,'utf-8'))
                file_name.push(e.name)
            }
        }
    }
    walk(dir)
    let {BIN,POOL}=c(file,project.optimize,true,file_name)
    const write: Buffer[] = []
    write.push(Buffer.from('POOL_START','utf-8'))
    for (const [id, v] of POOL) {
        let type: number=typeof v=='number'?1:0
        let data: Buffer
        if (typeof v === 'number') {
            data = Buffer.alloc(8)
            data.writeDoubleLE(v, 0)
        } else
            data = Buffer.from(v, 'utf8')
        const head = Buffer.alloc(9)
        head.writeUInt32LE(id, 0)
        head.writeUInt8(type, 4)
        head.writeUInt32LE(data.length, 5)
        write.push(head, data)
    }
    write.push(Buffer.from('POOL_END','utf-8'))
    write.push(Buffer.from('CODE_START','utf-8'))
    for(let i of BIN){
        let data=Buffer.alloc(13)
        data.writeUInt8(i[0],0)
        data.writeUInt32LE(i[1],1)
        data.writeUInt32LE(i[2],5)
        data.writeUInt32LE(i[3],9)
        write.push(data)
    }
    write.push(Buffer.from('CODE_END','utf-8'))
    writeFileSync(output,Buffer.concat(write),{encoding:'utf8',flag:'w'})
    console.log('saved at '+output)
}
export function start(vm:string,file:string){
    file=path.resolve(file)
    spawn(vm, ['run',file], {
        stdio: 'ignore',
    }).unref()
}
export function run(global:GlobalConfig,project:ProjectConfig){
    compiler(global, project)
    start(project.vm,project.output+'.sbin')
}
export async function init(){
    let folder_name=path.basename(process.cwd())||'app'
    const name=await input({message:'项目名:',default:folder_name})
    const version=await input({message:'版本:',default:'1.0.0'})
    const level=await select({
        message: '选择优化等级:',
        choices: [
            { name: '关闭优化', value: 0 },
            { name: 'O1', value: 1, description: '基本优化' },
            { name: 'O2', value: 2, description: '激进优化' },
        ],
        default:2
    })
    //此处先放鸽子
    const vm:string='vm.exe'
    const output=await input({message:'输出路径:(.sbin)',default:`${folder_name}`})
    const local=await input({message:'库目录:',default:'lib'})
    writeFileSync('slang.json',JSON.stringify({
        name:name,
        version:version,
        author:'',
        license:'',
        ignore:[],
        optimize:level,
        output:output,
        vm:vm,
        lib:{local:local,data:[]}
    },null,4))
}