import expr from './expr'
import command from './command'
import block from './block'
import {Desugar, File} from '../utils'
export default function (ast:File[]){
    return ast.map(x=>Desugar(x,{...expr,...command, ...block}))
}