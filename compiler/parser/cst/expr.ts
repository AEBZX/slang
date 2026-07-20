import {Parser, TokenType} from '../../utils'
import Type from './identifier'
import Command from './command'
const $=Parser.cst

const Literal=$.o(
    TokenType.Number,TokenType.String,'true','false','null'
)
const Identifier=$.s(TokenType.Identifier)
const _Primary=()=>$.o(
    Identifier,Literal,$.s('(',$.ref(()=>_Expr()),')'),$.w('[',$.ref(()=>_Expr()),$.s(','),']'),
    $.w('{',$.s(Identifier,':',$.ref(()=>_Expr())),$.s(','),'}'),
    $.s($.w('(',$.s(Identifier,':',Type),',',')'),'=>',$.ref(()=>Command))
)
const _Postfix=()=>$.s(
    _Primary(),
    $.l($.o($.s('[',$.ref(()=>_Expr()),']'),$.w('(',$.ref(()=>_Expr()),$.s(','),')'),$.s('.',TokenType.Identifier),'++','--'))
)
const Prefix=$.s(
    $.l($.o('~','!','-','&','*','++','--','new')),_Postfix()
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
const _Expr=()=>$.o(Ternary,Binary)
const Expr=_Expr()
export default Expr
