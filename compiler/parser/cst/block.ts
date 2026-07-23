import {Parser, TokenType} from '../../utils'
const $=Parser.cst
import Type from './identifier'
import Command from './command'
import Expr from './expr'
export function link(){
    return $.ref(()=>$.s(
        $.s('link',TokenType.Identifier,$.l('.',TokenType.Identifier),'as',TokenType.Identifier),';'))
}
function modifier(){
    return $.ref(()=>$.l($.o(
        'public','private','async','sync','static','unstatic'
    )))
}
function function_(){
    return $.ref(()=>$.s(
        'function',Type(),$.w('(',$.s(TokenType.Identifier,':',Type()),',',')'),Command()))
}
function enum_(){
    return $.ref(()=>$.s('enum',$.w('{',TokenType.Identifier,',','}')))
}
function interface_(){
    return $.ref(()=>$.s('interface',$.c(
        'of',
        TokenType.Identifier,$.l('.',TokenType.Identifier)
    ),block()))
}
function variable(){
    return $.ref(()=>$.s('var',Type(),$.c('=',Expr())))
}
function class_(){
    return $.ref(()=>$.s('class',$.c(
        'of',
        TokenType.Identifier,$.l('.',TokenType.Identifier)
    ),block()))
}
export function module_(){
    return $.ref(()=>$.s('module',block()))
}
function block(){
    return $.ref(()=>$.s('{',$.l($.s(
        modifier(),TokenType.Identifier,':',$.o(function_(),variable(),interface_(),enum_(),class_(),module_())
    )),'}'))
}