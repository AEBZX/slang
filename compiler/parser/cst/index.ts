import {link,module_} from './block'
import {ASTStream, CSTStream, Parser} from '../../utils'
const $=Parser.cst
export default function (stream:CSTStream){
    let match=$.s($.l(link),module_)
    match.stream=stream
    if(!match.match())
        throw new Error('无法识别的文件在CST层面')
    return match.generate()
}