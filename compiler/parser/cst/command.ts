import Expr,{_Expr} from './expr'
import Type from './identifier'
import {Parser, TokenType} from '../../utils'
import Identifier from "./identifier";
const $=Parser.cst
const assign=$.s($.ref(()=>_Expr()),
    $.o('=','+=','-=','*=','/=','%=','<<=','>>=','&=','|=','^=','&&=','||='),
    $.ref(()=>_Expr()))
const basic_command=$.s($.o(
    assign,$.s('return',$.c($.ref(()=>_Expr()))),'break','continue',$.s($.c('await'),$.ref(()=>_Expr())),$.s('throw',$.ref(()=>_Expr())),
    $.s($.ref(()=>_Expr()),'++'),$.s($.ref(()=>_Expr()),'--'),$.s('vm',TokenType.String)
    ,$.s('var',Identifier,':',Type,$.c('=',$.ref(()=>_Expr())))
),';')
const cond=$.s('(',$.ref(()=>_Expr()),')')
const _commands=()=>$.o(
        $.o(basic_command,block_command),
        $.s('{',$.l($.o(basic_command,block_command)),'}')
)
let block_command=$.o(
    $.s('if',cond,$.ref(_commands),$.c('else',$.ref(_commands))),
    $.s('switch',cond,$.s('{',
        $.l($.s('case',$.ref(()=>_Expr()),'=>',$.ref(_commands))),
        $.c('default',$.ref(_commands)),'}')),
    $.s('while',cond,$.ref(_commands)),
    $.s('do',$.ref(_commands),'while',cond),
    $.s('for','(',$.l(basic_command),$.ref(()=>_Expr()),$.l(basic_command),')',$.ref(_commands)),
    $.s('for','(',TokenType.Identifier,':',$.ref(()=>_Expr()),')',$.ref(_commands)),
    $.s('try',$.ref(_commands),'catch','(',Identifier,':',Type,')',$.ref(_commands),$.c('finally',$.ref(_commands)))
)
const commands=_commands()
export {_commands}
export default commands
