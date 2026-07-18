import Check from './lib/check'
import Desugar from './lib/desugar'
import IR from './lib/ir'
import Parser,{CSTStream,ASTStream,CSTRule_Ref} from './lib/parser'
import {tokens,asm,asm_command,asm_args,asm_type,bin,bin_command,ast_data,ast_visitor,cst_data,pre_token,TokenType} from './data'
export default {
    check:Check,
    desugar:Desugar,
    ir:IR,
    parser:Parser
}
export {
    tokens,asm,asm_command,asm_args,asm_type,bin,bin_command,ast_data,ast_visitor,cst_data,pre_token,TokenType,
    Check,Desugar,IR,Parser,ASTStream,CSTStream,CSTRule_Ref
}