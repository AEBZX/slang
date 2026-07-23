import {Parser, TokenType} from '../../utils'
const $=Parser.cst
function BasicType(){
    return $.ref(()=>$.o(
        'void','boolean','number','string',$.s(TokenType.Identifier,$.l('.',TokenType.Identifier))
    ))
}
export default function Type(){
    return $.ref(()=> $.s(
            $.o($.s('(',Type(),')'),BasicType(),$.s($.w('(',$.s(TokenType.Identifier,':',Type()),',',')'),'=>',Type())),
            $.l($.o('[]','{}','*'))))
}