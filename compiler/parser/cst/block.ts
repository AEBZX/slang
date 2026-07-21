import {Parser, TokenType} from '../../utils'
const $=Parser.cst
import Type from './identifier'
import Command from './command'
import Expr from './expr'
import command from "./command";
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
        'function',Type(),$.w('(',$.s(TokenType.Identifier,':',Type()),',',')'),command()))
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
        modifier(),TokenType.Identifier,':',$.o(function_())
    )),'}'))
}