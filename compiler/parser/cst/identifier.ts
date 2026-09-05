import {Parser as $, TokenType} from '../../utils'
const NumberType=$.s('NumberType',$.d('number'))
const BooleanType=$.s('BooleanType',$.d('boolean'))
const StringType=$.s('StringType',$.d('string'))
const VoidType=$.s('VoidType',$.d('void'))
const LambdaType=$.s('LambdaType',
    $.t('(',$.w('ParamIdentifier',$.s('ParamData',TokenType.Identifier,':',$.r('Type')),','),')'),
    '=>',$.r('Type'))
const GenericType=$.s('GenericType',TokenType.Identifier)
const BasicType=$.o('BasicType',$.r('NumberType'),$.r('LambdaType'),
    $.r('BooleanType'),$.r('StringType'),$.r('VoidType'),$.t('(',$.r('Type'),')'),
    $.s('ClassType',$.w('ClassTypeData',TokenType.Identifier,$.d('.')),$.c($.d('<'),$.w('GenericType',$.r('Type'),','),$.d('>'))))
const Type=$.s('Type',$.r('BasicType'),$.l('TypePostfixList',
    $.o('TypePostfix',
        $.s('MapPostfix',$.d('{'),$.d('}')),
        $.s('ArrayPostfix',$.d('['),$.d(']')),
        $.s('PointPostfix',$.d('*'))
    )
))
export default [
    NumberType,
    LambdaType,
    BooleanType,
    StringType,
    BasicType,
    VoidType,
    Type,
    GenericType
]