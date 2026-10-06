import Block from './block'
import Command from './command'
import Expr from './expr'
import {Assign, ASTTree, Desugar} from "../utils";
export default new Desugar().use(Block).use(Command).use(Expr).use((node:ASTTree, call)=>node)