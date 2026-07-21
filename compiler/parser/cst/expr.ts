import {Parser, TokenType} from '../../utils'
import Type,{_Type} from './identifier'
import Command from './command'
const $=Parser.cst

const Literal=$.o(
    TokenType.Number,TokenType.String,'true','false','null'
)
const Identifier=$.s(TokenType.Identifier)
const UnaryOps=$.o('~','!','-','&','*','++','--','new')
const PostfixOps=$.o($.s('.',TokenType.Identifier),'++','--')
const MulOps=$.o('*','/','%')
const AddOps=$.o('+','-')
const ShiftOps=$.o('<<','>>')
const RelOps=$.o('<','<=','>','>=')

const _Expr=()=>{
    const fp=$.o(
        Identifier,Literal,
        $.s('(',$.ref(_Expr),')'),
        $.w('[',$.ref(_Expr),$.s(','),']'),
        $.w('{',$.s(Identifier,':',$.ref(_Expr)),$.s(','),'}'),
        $.s($.w('(',$.s(TokenType.Identifier,':',$.ref(_Type)),',',')'),'=>',$.ref(()=>Command))
    )
    const fpost=$.s(fp,$.l($.o(
        $.s('[',$.ref(_Expr),']'),
        $.w('(',$.ref(_Expr),$.s(','),')'),
        PostfixOps
    )))
    const fpre=$.s($.l(UnaryOps),fpost)
    const fmul=$.s(fpre,$.l(MulOps,fpre))
    const fadd=$.s(fmul,$.l(AddOps,fmul))
    const fshift=$.s(fadd,$.l(ShiftOps,fadd))
    const frel=$.s(fshift,$.l(RelOps,fshift))
    const feq=$.s(frel,$.l($.o('==','!='),frel))
    const fband=$.s(feq,$.l('&',feq))
    const fbxor=$.s(fband,$.l('^',fband))
    const fbor=$.s(fbxor,$.l('|',fbxor))
    const fland=$.s(fbor,$.l('&&',fbor))
    const flor=$.s(fland,$.l('||',fland))
    const fbin=flor
    const ftern=$.s(fbin,'?',fbin,':',fbin)
    return $.o(ftern,fbin)
}
const Expr=_Expr()
export {_Expr}
export default Expr
