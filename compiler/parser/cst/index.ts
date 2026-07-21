import {module_,link} from './block'
import {CSTStream,Parser} from '../../utils'
const $=Parser.cst
export default function (stream:CSTStream){
    let v=$.s($.l(link()),module_())
    v.stream=stream
    v.match()
    return v.generate()
}