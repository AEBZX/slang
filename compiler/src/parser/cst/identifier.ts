import {TokenType} from '../../utils'
import {$} from '../../utils/lib/parser'
const NumberType=$.s('NumberType',$.d('number'))
const BooleanType=$.s('BooleanType',$.d('boolean'))
const VoidType=$.s('VoidType',$.d('void'))
const LambdaType=$.s('LambdaType',
    $.c($.r('GenericList')),
    $.t('(',$.w('ParamIdentifier',
        $.s('ParamData',TokenType.Identifier,$.d(':'),$.r('Type')),','),
        ')'),
    $.d('=>'),$.r('Type'))
const GenericType=$.s('GenericType',$.d('@'),TokenType.Identifier)
const BasicType=$.o('BasicType',
    $.r('NumberType'),
    $.r('LambdaType'),
    $.r('BooleanType'),
    $.r('VoidType'),
    $.t('(',$.r('Type'),')'),
    $.r('GenericType'),
    $.s('ClassType',
        TokenType.Identifier,
        $.l('ClassTypeData',$.s('ClassTypeItem',$.d('.'),TokenType.Identifier)),
        $.c($.d('<'),$.w('GenericType',$.r('Type'),','),$.d('>'))))
const Type=$.s('Type',$.r('BasicType'),$.l('TypePostfixList',
    $.o('TypePostfix',
        $.s('ArrayPostfix',$.d('['),$.d(']')),
        $.s('PointPostfix',$.d('*')),
        $.s('ReferencePostfix',$.d('&'))
    )
))
export default [
    NumberType,
    LambdaType,
    BooleanType,
    BasicType,
    VoidType,
    Type,
    GenericType
]