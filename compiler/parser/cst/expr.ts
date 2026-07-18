import {Parser, TokenType} from '../../utils'
import Type from './identifier'
import Command from './command'
const $=Parser.cst

const Literal=$.o(
    TokenType.Number,TokenType.String,'true','false','null'
)
const Identifier=$.s(TokenType.Identifier)
const Primary=$.o(
    Identifier,Literal,$.s('(',$.ref(()=>Expr()),')'),$.w('[',$.ref(()=>Expr()),$.s(','),']'),
    $.w('{',$.s(Identifier,':',$.ref(()=>Expr())),$.s(','),'}'),
    $.s($.w('(',$.s(Identifier,':',Type),',',')'),'=>',$.ref(()=>Command))
)
const Postfix=$.s(
    Primary,
    $.l($.o($.s('[',$.ref(()=>Expr()),']'),$.w('(',$.ref(()=>Expr()),$.s(','),')'),$.s('.',TokenType.Identifier),'++','--'))
)
const Prefix=$.s(
    $.l($.o('~','!','-','&','*','++','--','new')),Postfix
)
const Multiplicative=$.s(
    Prefix,
    $.l($.o('*','/','%'),Prefix)
)
const Additive=$.s(
    Multiplicative,
    $.l($.o('+','-'),Multiplicative)
)
const Shift=$.s(
    Additive,
    $.l($.o('<<','>>'),Additive)
)
const Relational=$.s(
    Shift,
    $.l($.o('<','<=','>','>='),Shift)
)
const Equality=$.s(
    Relational,
    $.l($.o('==','!='),Relational)
)
const BitwiseAnd=$.s(
    Equality,
    $.l('&',Equality)
)
const BitwiseXor=$.s(
    BitwiseAnd,
    $.l('^',BitwiseAnd)
)
const BitwiseOr=$.s(
    BitwiseXor,
    $.l('|',BitwiseXor)
)
const LogicalAnd=$.s(
    BitwiseOr,
    $.l('&&',BitwiseOr)
)
const LogicalOr=$.s(
    LogicalAnd,
    $.l('||',LogicalAnd)
)
const Binary=LogicalOr
const Ternary=$.s(Binary,'?',Binary,':',Binary)
function Expr(){
    return $.o(Ternary,Binary)
}
export default Expr()
