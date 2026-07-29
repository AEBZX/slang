import {Parser as $, TokenType} from '../utils'
const NumberType=$.s('NumberType',$.d('number'))
const BooleanType=$.s('BooleanType',$.d('boolean'))
const StringType=$.s('StringType',$.d('string'))
const LambdaType=$.s('LambdaType',
    $.t('(',$.w('ParamIdentifier',$.s('ParamData',TokenType.Identifier,':',$.r('Type')),','),')'),
    '=>',$.r('Type'))
const BasicType=$.o('BasicType',$.r('NumberType'),$.r('LambdaType'),
    $.r('BooleanType'),$.r('StringType'),$.t('(',$.r('Type'),')'))
const Type=$.s('Type',$.r('BasicType'),$.l('TypePostfixList',
    $.o('TypePostfix',
        $.s('MapPostfix','{}'),
        $.s('ArrayPostfix','[]'),
        $.s('PointPostfix','*')
    )
))
export default [
    NumberType,
    LambdaType,
    BooleanType,
    StringType,
    BasicType,
    Type
]