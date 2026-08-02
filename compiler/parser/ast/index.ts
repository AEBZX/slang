import expr from './expr'
import command from './command'
import identifier from './identifier'
import block from './block'
import {ast_data, Parser as $} from '../../utils'
export default function(data:ast_data){
    return $.generate(data,{...block,...expr,...command,...identifier})
}