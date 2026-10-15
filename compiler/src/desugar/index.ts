import Block from './block'
import Command from './command'
import Expr from './expr'
import {ASTTree, Desugar, Expression} from '../utils'
import {expr_desugar} from './tool'
//兜底:脱糖表里没登记的节点。表达式仍要过一遍 oper/cast,
//否则 check 打在叶子节点(标识符、字面量)上的 cast 会被直接丢掉
export default new Desugar().use(Block).use(Command).use(Expr)
    .use((node:ASTTree,call)=>node instanceof Expression?expr_desugar(node,node):node)
