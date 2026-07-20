import Expr from './expr'
import Type from './identifier'
import Command from './command'
import {Parser, TokenType} from '../../utils'
const $=Parser.cst
const modifier=$.l($.o('public','private','async','sync','static','unstatic'))
export const link=$.s('link',$.w('(',TokenType.Identifier,'.',')'),'as',TokenType.Identifier)
const function_=$.s('function',$.w('(',$.s(TokenType.Identifier,':',Type),',',')'),':',Type,Command)
const var_=$.s('var',Type,$.c('=',Expr),';')
const class_=$.s('class',$.c('of',$.s($.l(TokenType.Identifier,'.'),TokenType.Identifier)),'{',$.ref(()=>_blocks()),'}')
const interface_=$.s('interface',$.c('implements',$.s($.l(TokenType.Identifier,'.'),TokenType.Identifier)),
    '{',$.ref(()=>_blocks()),'}')
const enum_=$.s('enum',$.w('{',TokenType.Identifier,',','}'))
export const module_=$.s('module','{',$.ref(()=>_blocks()),'}')
const _blocks=()=>$.l($.o(
        $.s(modifier,TokenType.Identifier, $.o(function_, var_, class_, interface_, enum_))
    ))
const blocks=_blocks()
export default blocks
