import Check,{Scope,check_visitor} from './lib/check'
import Desugar,{desugar_visitor} from './lib/desugar'
import IR from './lib/ir'
import Parser,{CSTStream,ASTStream,CSTRule_Ref,ASTRule_Ref} from './lib/parser'
import {AstNode} from './lib/ast-node'
import {tokens,token,asm,asm_command,asm_args,asm_type,bin,bin_command,ast_data,ast_visitor,cst_data,pre_token,TokenType} from './data'
export default {
    check:Check,
    desugar:Desugar,
    ir:IR,
    parser:Parser
}
export {
    tokens,asm,asm_command,asm_args,asm_type,bin,bin_command,ast_data,ast_visitor,cst_data,pre_token,TokenType,
    Check,Desugar,IR,Parser,ASTStream,CSTStream,CSTRule_Ref,ASTRule_Ref,token,Scope,AstNode,
    check_visitor,desugar_visitor
}