import {Command} from 'commander'
import * as process from 'node:process'
import {readdirSync} from 'node:fs'
import path from 'node:path'
import {readFileSync, writeFileSync} from 'fs'
import c from './index'
const program=new Command()
program.name('slang')
program.version('1.0.0')
program
    .command('compiler')
    .description('compile slang project')
    .option('--dir <dir>', 'project directory')
    .option('--ignore <ignore>', 'ignore file,use ; split')
    .option('--output <output>', 'output file')
    .option('--optimize <optimize>', 'optimize level')
    .action(({dir,_ignore,_output,optimize})=>{
        optimize=parseInt(optimize)
        let ignore=_ignore?.split(';')??[]
        let output=dir+'/'+_output+'.sbin'
        //寻找目录下所有.sl文件
        const file: string[] = []
        const file_name:string[]=[]
        let walk=(dir:string)=>{
            for (const e of readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, e.name)
                if (e.isDirectory()&&!ignore.includes(e.name))
                    walk(full)
                else if (e.isFile()&&e.name.endsWith('.sl')&&!ignore.includes(e.name.substring(0,e.name.length-4))) {
                    //传入源码内容,而非文件路径
                    file.push(readFileSync(full,'utf-8'))
                    file_name.push(e.name)
                }
            }
        }
        walk(dir)
        let {BIN,POOL}=c(file,optimize,true,file_name)
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
    })
try{
    await program.parseAsync()
}catch(e:any){
    console.error(e?.message||e)
    process.exit(1)
}