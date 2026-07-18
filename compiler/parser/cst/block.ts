import Expr from './expr'
import Type from './identifier'
import Command from './command'
import {Parser, TokenType} from '../../utils'
const $=Parser.cst
const modifier=$.l($.o('public','private','async','sync','static','unstatic'))
export const link=$.s('link',$.w('(',TokenType.Identifier,'.',')'),'as',TokenType.Identifier)
const function_=$.s('function',$.w('(',$.s(TokenType.Identifier,':',Type),',',')'),':',Type,Command)
const var_=$.s('var',Type,$.c('=',Expr),';')
const class_=$.s('class',$.c('of',$.s($.l(TokenType.Identifier,'.'),TokenType.Identifier)),'{',$.ref(()=>blocks()),'}')
const interface_=$.s('interface',$.c('implements',$.s($.l(TokenType.Identifier,'.'),TokenType.Identifier)),
    '{',$.ref(()=>blocks()),'}')
const enum_=$.s('enum',$.w('{',TokenType.Identifier,',','}'))
export const module_=$.s('module',$.w('(',TokenType.Identifier,'.',')'),'{',$.ref(()=>blocks()),'}')
function blocks(){
    return $.l($.o(
        $.s(modifier, $.o(function_, var_, class_, interface_, enum_)),
        link
    ))
}
export default blocks()
