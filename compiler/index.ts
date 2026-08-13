import {File,lexer} from './utils'
import parser from './parser'
import check from './check'
import desugar from './desugar'
import hir from './hir'
import ir from './ir'
import optimize from './optimize'
export default function (code:string[],optimize_level:number):number[]{
    let file:File[]=code.map(c=>parser(lexer(c)) as File)
    let scope=check(file)
    if(scope.error.length!=0){
        console.log(scope.error.join('\n'))
        throw new Error()
    }
    let _hir=hir(desugar(file) as File[])
    let {bin,pool}=optimize(ir(_hir[0],_hir[1]),optimize_level)
    let bytes:number[]=[]
    bytes.push(pool.size)
    for(let [id,v] of pool){
        bytes.push(id)
        if(typeof v=='number'){
            bytes.push(0,v)
        }else{
            bytes.push(1,v.length)
            for(let i=0;i<v.length;i++)bytes.push(v.charCodeAt(i))
        }
    }
    //命令段(操作数为任意int,槽号/池id全局递增,可能超byte)
    for(let c of bin)
        if(c!=null)for(let n of c)
            bytes.push(n)
    return bytes
}