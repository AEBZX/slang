import Expr from './expr'
import Type from './identifier'
import {Parser, TokenType} from '../../utils'
import Identifier from "./identifier";
const $=Parser.cst
const assign=$.s($.ref(()=>Expr),
    $.o('=','+=','-=','*=','/=','%=','<<=','>>=','&=','|=','^=','&&=','||='),
    $.ref(()=>Expr))
const basic_command=$.s($.o(
    assign,$.s('return',$.c($.ref(()=>Expr))),'break','continue',$.s('await',$.ref(()=>Expr)),$.s('throw',$.ref(()=>Expr)),
    $.s($.ref(()=>Expr),'++'),$.s($.ref(()=>Expr),'--'),$.s('vm',TokenType.String),$.s('var',Identifier,':',Type,$.c('=',$.ref(()=>Expr)))
),';')
const cond=$.s('(',$.ref(()=>Expr),')')
function commands(){
    return $.o(
        $.o(basic_command,block_command),
        $.s('{',$.l($.o(basic_command,block_command)),'}')
    )
}
let block_command=$.o(
    $.s('if',cond,$.ref(()=>commands()),$.c('else',$.ref(()=>commands()))),
    $.s('switch',cond,$.s('{',
        $.l($.s('case',$.ref(()=>Expr),'=>',$.ref(()=>commands()))),
        $.c('default',$.ref(()=>commands())),'}')),
    $.s('while',cond,$.ref(()=>commands())),
    $.s('do',$.ref(()=>commands()),'while',cond),
    $.s('for','(',$.s(basic_command),$.ref(()=>Expr),$.s(basic_command),')',$.ref(()=>commands())),
    $.s('for','(',TokenType.Identifier,':',$.ref(()=>Expr),')',$.ref(()=>commands())),
    $.s('try',$.ref(()=>commands()),'catch','(',Identifier,':',Type,')',$.ref(()=>commands()),$.c('finally',$.ref(()=>commands())))
)
export default commands()
