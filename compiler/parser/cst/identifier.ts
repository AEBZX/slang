import {Parser, TokenType} from '../../utils'

const $=Parser.cst
const BasicType=$.o('number','string','boolean','void',$.s($.l(TokenType.Identifier,'.'),TokenType.Identifier))
const Type=$.s(
        $.o(
            $.s('(',$.ref(()=>Type),')'),
            $.s(BasicType, $.l('[]')),
            $.s(BasicType, $.l('{}')),
            $.s($.w('(', $.s(TokenType.Identifier,':',$.ref(()=>Type)), ',', ')'),'=>',$.ref(()=>Type)),
            BasicType
        ),$.l('*')
    )
export default Type
