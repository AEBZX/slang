import {ASTTree} from '../utils'

export type slang_desugar_visitor=(node:ASTTree,call:(node:ASTTree)=>ASTTree)=>ASTTree