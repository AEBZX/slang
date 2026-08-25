import {File,lexer} from './utils'
import parser from './parser'
import check from './check'
import desugar from './desugar'
import hir from './hir'
import ir from './ir'
import optimize from './optimize'
import * as process from 'node:process'
export default function (code:string[],optimize_level:number,output:boolean=false,file_name:string[]=[]){
    let index=0
    let global_start=performance.now()
    if(output)console.log('compiler:parser')
    let parser_start=performance.now()
    let file:File[]=code.map(c=>{
        let file_start=performance.now()
        let ret=parser(lexer(c)) as File
        file_start = performance.now()-file_start
        if(output)console.log(`   parser:${file_name[index++]} ${performance.now() - file_start}ms`)
        return ret
    })
    parser_start=performance.now()-parser_start
    if(output)console.log(`parser OK:${parser_start}ms`)
    if(output)console.log('compiler:check')
    let check_start=performance.now()
    let scope=check(file)
    check_start=performance.now()-check_start
    if(output)console.log(`check OK:${check_start}ms,${scope.error.length} errors:`)
    if(scope.error.length!=0){
        //库函数不得 process.exit:测试/嵌入场景会直接杀掉宿主进程(worker 异常终止挂起)。
        //抛错由调用方处理(CLI 层 cli.ts 已 catch 并退出)
        throw new Error(scope.error.join('\n'))
    }
    if(output)console.log('compiler:desugar and hir')
    let desugar_start=performance.now()
    let _hir=hir(desugar(file) as File[])
    desugar_start=performance.now()-desugar_start
    if(output)console.log(`desugar and hir OK:${desugar_start}ms`)
    if(output)console.log('compiler:ir')
    let ir_start=performance.now()
    let {bin,pool}=optimize(ir(_hir[0],_hir[1]),optimize_level)
    ir_start=performance.now()-ir_start
    if(output)console.log(`ir OK:${ir_start}ms`)
    global_start=performance.now()-global_start
    if(output)console.log(`compiler OK:${global_start}ms`)
    return {BIN:bin,POOL:pool}
}