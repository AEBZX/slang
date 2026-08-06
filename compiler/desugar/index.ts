import expr from './expr'
import command from './command'
import block from './block'
import {Desugar, File} from '../utils'
export default function (ast:File[]){
    let visit=new Map([...expr,...command,...block])
    return ast.map(x=>Desugar(x,visit))
}