import {Parser, TokenType} from '../../utils'
import Type from './identifier'
import Command from './command'
import command from "./command";
const $=Parser.cst
function Literal(){
    return $.ref(()=>$.o(
        TokenType.Number,
        TokenType.String,
        'true','false','null'
    ))
}
function Primary(){
    return $.ref(()=>$.o(
        $.s('(',Expr(),')'),
        $.w('[',Expr(),',',']'),
        $.w('{',$.s(TokenType.Identifier,'=',$.ref(()=>Expr())),',','}'),
        $.s($.w('(',$.s(TokenType.Identifier,':',Type()),',',')'),':',Type(),'=>',command()),
        Literal(),
        TokenType.Identifier
    ))
}
function Postfix(){
    return $.ref(()=>$.s(
        Primary(),
        $.l($.o(
            '++','--',
            $.s('[',Expr(),']'),
            $.w('(',Expr(),',',')'),
            $.s('.',TokenType.Identifier)
        ))
    ))
}
function Prefix(){
    return $.ref(()=>$.s(
        $.l($.o('++','--','-','!','~','new')),
        Postfix()
    ))
}
function Multiplicative(){
    return $.ref(()=>$.s(
        Prefix(),
        $.l($.s($.o('*','/','%'),Prefix()))
    ))
}
function Additive(){
    return $.ref(()=>$.s(
        Multiplicative(),
        $.l($.s($.o('+','-'),Multiplicative()))
    ))
}
function Shift(){
    return $.ref(()=>$.s(
        Additive(),
        $.l($.s($.o('<<','>>'),Additive()))
    ))
}
function Relational(){
    return $.ref(()=>$.s(
        Shift(),
        $.l($.s($.o('<=','>=','<','>'),Shift()))
    ))
}
function Equality(){
    return $.ref(()=>$.s(
        Relational(),
        $.l($.s($.o('==','!='),Relational()))
    ))
}
function BitwiseAnd(){
    return $.ref(()=>$.s(
        Equality(),
        $.l($.s('&',Equality()))
    ))
}
function BitwiseXor(){
    return $.ref(()=>$.s(
        BitwiseAnd(),
        $.l($.s('^',BitwiseAnd()))
    ))
}
function BitwiseOr(){
    return $.ref(()=>$.s(
        BitwiseXor(),
        $.l($.s('|',BitwiseXor()))
    ))
}
function LogicalAnd(){
    return $.ref(()=>$.s(
        BitwiseOr(),
        $.l($.s('&&',BitwiseOr()))
    ))
}
function LogicalOr(){
    return $.ref(()=>$.s(
        LogicalAnd(),
        $.l($.s('||',LogicalAnd()))
    ))
}
function Binary(){
    return LogicalOr()
}
function Ternary(){
    return $.ref(()=>$.s(
        Binary(),
        '?',
        Expr(),
        ':',
        Expr()
    ))
}
export default function Expr(){
    return $.ref(()=>$.o(
        Binary(),
        Ternary()
    ))
}