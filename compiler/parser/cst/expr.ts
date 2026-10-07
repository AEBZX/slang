import {TokenType} from '../../utils'
import {$} from '../../utils/lib/parser'
const NumberLiteral=$.s('NumberLiteral',TokenType.Number)
const StringLiteral=$.s('StringLiteral',TokenType.String)
const BooleanLiteral=$.s('BooleanLiteral',$.o('Boolean','true','false'))
const NullLiteral=$.s('NullLiteral',$.d('null'))
const Identifier=$.s('Identifier',TokenType.Identifier)
const ArrayExpression=$.o('ArrayExpression',$.t('[',$.w('ArrayExpression',$.r('Expression'),','),']'))
const MapExpression=$.o('MapExpression',$.t('[',
    $.w('MapExpression',$.s('MapData',TokenType.Identifier,$.d(':'),$.r('Expression')),',')
    ,']'))
const LambdaExpression=$.s('LambdaExpression',$.c($.r('GenericList')),
    $.t('(',$.w('ParamIdentifier',$.s('ParamData',TokenType.Identifier,$.d(':'),$.r('Type')),','),')'),
    $.d('=>'),$.r('Type'),$.r('Commands'))
const PrimaryExpression=$.o('PrimaryExpression',
    $.r('NumberLiteral'),
    $.r('StringLiteral'),
    $.r('BooleanLiteral'),
    $.r('NullLiteral'),
    $.r('Identifier'),
    $.r('LambdaExpression'),
    $.t('(',$.r('Expression'),')'),
    $.r('ArrayExpression'),
    $.r('MapExpression')
)
const PostfixExpression=$.s('PostfixExpression',
    $.r('PrimaryExpression'),$.l('PostfixList',
        $.o('PostfixData',$.s('IncrementPostfix',$.d('++')),
            $.s('DecrementPostfix',$.d('--')),
            $.s('MemberPostfix',$.d('.'),TokenType.Identifier),
            $.s('IndexPostfix',$.d('['),$.r('Expression'),$.d(']')),
            $.s('ArgumentsPostfix',$.c($.d('<'),$.w('GenericData',$.r('Type'),','),$.d('>'))
                ,$.d('('),$.w('Args',$.r('Expression'),','),$.d(')')))
    )
)
const IncrementPrefix=$.s('IncrementPrefix',$.d('++'))
const DecrementPrefix=$.s('DecrementPrefix',$.d('--'))
const NotPrefix=$.s('NotPrefix',$.d('!'))
const BitNotPrefix=$.s('BitNotPrefix',$.d('~'))
const MinusPrefix=$.s('MinusPrefix',$.d('-'))
const ReferencePrefix=$.s('ReferencePrefix',$.d('*'))
const AddressPrefix=$.s('AddressPrefix',$.d('&'))
const NewPrefix=$.s('NewPrefix',$.d('new'))
const TypePrefix=$.s('TypePrefix',$.d('('),$.r('Type'),$.d(')'))
const PrefixData=$.o('PrefixData',IncrementPrefix,DecrementPrefix,NotPrefix,BitNotPrefix,MinusPrefix
    ,ReferencePrefix,AddressPrefix,NewPrefix)
const PrefixDataWithCast=$.o('PrefixData',TypePrefix,IncrementPrefix,DecrementPrefix,NotPrefix,BitNotPrefix
    ,MinusPrefix,ReferencePrefix,AddressPrefix,NewPrefix)
const PrefixExpression=$.o('PrefixExpression',
    $.s('PrefixExpression',$.l('PrefixList',TypePrefix),$.r('PostfixExpression')),
    $.s('PrefixExpression',$.l('PrefixList',PrefixData),$.r('PostfixExpression')),
    $.s('PrefixExpression',$.l('PrefixList',PrefixDataWithCast),$.r('PostfixExpression'))
)
const MulExpression=$.s('MulExpression',
    $.r('PrefixExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('Mul',$.d('*')),
                $.s('Div',$.d('/')),
                $.s('Mod',$.d('%'))
            ),$.r('PrefixExpression'))
    )
)
const AddExpression=$.s('AddExpression',
    $.r('MulExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('Add',$.d('+')),
                $.s('Sub',$.d('-'))
            ),$.r('MulExpression'))
    )
)
const ShiftExpression=$.s('ShiftExpression',
    $.r('AddExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('Shl',$.d('<<')),
                $.s('Shr',$.d('>>'))
            ),$.r('AddExpression'))
    )
)
const RelationalExpression=$.s('RelationalExpression',
    $.r('ShiftExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('Less',$.d('<')),
                $.s('Greater',$.d('>')),
                $.s('LessEqual',$.d('<=')),
                $.s('GreaterEqual',$.d('>='))
            ),$.r('ShiftExpression'))
    )
)
const EqualExpression=$.s('EqualExpression',
    $.r('RelationalExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('Equal',$.d('==')),
                $.s('Inequal',$.d('!='))
            ),$.r('RelationalExpression'))
    )
)
const AndExpression=$.s('AndExpression',
    $.r('EqualExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('And',$.d('&'))),
            $.r('EqualExpression'))
    )
)
const XorExpression=$.s('XorExpression',
    $.r('AndExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('Xor',$.d('^'))),
            $.r('AndExpression'))
    )
)
const OrExpression=$.s('OrExpression',
    $.r('XorExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('Or',$.d('|'))),
            $.r('XorExpression'))
    )
)
const LogicAndExpression=$.s('LogicAndExpression',
    $.r('OrExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('LogicAnd',$.d('&&'))),
            $.r('OrExpression'))
    )
)
const LogicOrExpression=$.s('BinaryExpression',
    $.r('LogicAndExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('LogicOr',$.d('||'))),
            $.r('LogicAndExpression'))
    )
)
const TernaryExpression=$.s('TernaryExpression',
    $.r('BinaryExpression'),
    $.d('?'),
    $.r('Expression'),
    $.d(':'),
    $.r('Expression')
)
const Expression=$.o('Expression',
    $.r('TernaryExpression'),
    $.r('BinaryExpression')
)
export default [
    NumberLiteral,
    StringLiteral,
    BooleanLiteral,
    NullLiteral,
    Identifier,
    ArrayExpression,
    MapExpression,
    LambdaExpression,
    PrimaryExpression,
    PostfixExpression,
    PrefixExpression,
    MulExpression,
    AddExpression,
    ShiftExpression,
    RelationalExpression,
    EqualExpression,
    AndExpression,
    XorExpression,
    OrExpression,
    LogicAndExpression,
    LogicOrExpression,
    TernaryExpression,
    Expression
]