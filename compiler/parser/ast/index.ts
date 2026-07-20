import {BlockVisitor,link,module_} from './block'
import Command,{CommandVisitor} from './command'
import Expr,{ExprVisitor} from './expr'
import Identifier,{IdentifierVisitor} from './identifier'
import {ASTStream,Parser} from '../../utils'
const $=Parser.ast
export default function (stream:ASTStream){
    let v=$.s('File',$.o(link,module_))
    v.stream=stream
    return $.visit(v.generate(),[...CommandVisitor,...ExprVisitor,...IdentifierVisitor,...BlockVisitor])
}