import Type from './identifier'
import Expr from './expr'
import {Parser, TokenType} from '../../utils'
const $=Parser.cst
function assign_command(){
    return $.ref(()=>$.s(
        Expr(),
        $.o('=','+=','-=', '*=', '/=', '%=', '<<=', '>>=', '&&=', '||=','&=','|=','^='),
        Expr()
    ))
}
function basic_command(){
    return $.ref(()=>$.s($.o(
        assign_command(),
        $.s('return',$.c(Expr())),
        'break','continue',
        $.s('throw',Expr()),
        $.s($.c('await'),Expr()),
        $.s('var',TokenType.Identifier,':',Type(),$.c('=',Expr())),
        $.s(Expr(),$.o('++','--')),
        $.s('vm',TokenType.String),
    ),';'))
}
function cond(){
    return $.ref(()=>$.s('(',Expr(),')'))
}
function block_command(){
    return $.ref(()=>$.o(
        $.s('if',cond(),command(),$.c('else',command())),
        $.s('switch',cond(),'{',
            $.l($.s('case',Expr(),'=>',command())),
            $.c('default','=>',command()),'}'),
        $.s('for','(',$.l(basic_command()),Expr(),';',$.l(basic_command()),'}',command()),
        $.s('for','(',TokenType.Identifier,':',Expr(),')',command()),
        $.s('while',cond(),command()),
        $.s('do',command(),'while',cond(),';'),
        $.s('try',command(),'catch','(',TokenType.Identifier,':',Type(),')',command(),$.c('finally',command()))
    ))
}
export default function command(){
    return $.ref(()=>$.o(
        basic_command(),
        block_command(),
        $.s('{',$.l(command()),'}')
    ))
}
