import {Parser, TokenType} from '../../utils'

const $=Parser.cst
const BasicType=$.o('number','string','boolean','void',$.s($.l(TokenType.Identifier,'.'),TokenType.Identifier))
const _Type=()=>$.s(
        $.o(
            $.s('(',$.ref(_Type),')'),
            $.s(BasicType, $.l('[]')),
            $.s(BasicType, $.l('{}')),
            $.s($.w('(', $.s(TokenType.Identifier,':',$.ref(_Type)), ',', ')'),'=>',$.ref(_Type)),
            BasicType
        ),$.l('*')
    )
const Type=_Type()
export {_Type}
export default Type
