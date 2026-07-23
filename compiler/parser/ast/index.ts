import {module_,link} from './block'
import {ASTStream,Parser} from '../../utils'
const $=Parser.ast
export default function (stream:ASTStream){
    let v=$.s('FileBlock',$.l('LinkList',link()),module_())
    v.stream=stream
    v.match()
    return v.generate()
}