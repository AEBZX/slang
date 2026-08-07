import block from './block'
import command from './command'
import expr from './expr'
import identifier from './identifier'
import {Parser as $, token} from '../../utils'
export default function(code:token[]){
    return $.run('File',[...block,...expr,...command,...identifier],code)
}