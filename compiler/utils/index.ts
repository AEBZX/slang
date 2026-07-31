import Check,{Checker,Scope,check_visitor} from './lib/check'
import Desugar,{DesugarVisitor,desugar_visitor} from './lib/desugar'
import IR,{ASMFactory,BinFactory} from './lib/ir'
import Parser from './lib/parser'
import {tokens,token,asm,asm_command,asm_args,asm_type,bin,bin_command,ast_data,ast_rule,ast_rule_param,pre_token,TokenType} from './data'
export default {
    check:Check,
    desugar:Desugar,
    ir:IR,
    parser:Parser
}
export {
    tokens,token,asm,asm_command,asm_args,asm_type,bin,bin_command,ast_data,ast_rule,ast_rule_param,pre_token,TokenType,
    Checker,Scope,check_visitor,DesugarVisitor,desugar_visitor,IR,ASMFactory,BinFactory,Parser,Check
}