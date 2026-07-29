import {Parser as $, TokenType} from '../utils'
const NumberLiteral=$.s('NumberLiteral',TokenType.Number)
const StringLiteral=$.s('StringLiteral',TokenType.String)
const BooleanLiteral=$.s('BooleanLiteral',$.o('true','false'))
const NullLiteral=$.s('NullLiteral','null')
const Identifier=$.s('Identifier',TokenType.Identifier)
const ArrayExpression=$.t('[',$.w('ArrayExpression',$.r('Expression'),','),']')
const MapExpression=$.t('{',
    $.w('MapExpression',$.s('MapData',TokenType.Identifier,':',$.r('Expression')),',')
    ,'}')
const LambdaExpression=$.s('LambdaExpression',
    $.t('(',$.w('ParamIdentifier',$.s('ParamData',TokenType.Identifier,':',$.r('Type')),','),')'),
    $.d('=>'),$.r('Type'),$.r('Commands'))
const PrimaryExpression=$.o('PrimaryExpression',
    $.r('NumberLiteral'),
    $.r('StringLiteral'),
    $.r('BooleanLiteral'),
    $.r('NullLiteral'),
    $.r('Identifier'),
    $.t('(',$.r('Expression'),')'),
    $.r('ArrayExpression'),
    $.r('MapExpression'),
    $.r('LambdaExpression')
)
const PostfixExpression=$.s('PostfixExpression',
    $.r('PrimaryExpression'),$.l('PostfixList',
        $.o('PostfixData',$.s('IncrementPostfix',$.d('++')),
            $.s('DecrementPostfix',$.d('--')),
            $.s('MemberPostfix',$.d('.'),TokenType.Identifier),
            $.s('IndexPostfix',$.d('['),$.r('Expression'),$.d(']')),
            $.t('(',$.w('ArgumentsPostfix',$.r('Expression'),','),')')
            )
    )
)
const PrefixExpression=$.s('PrefixExpression',
    $.l('PrefixList',$.o('PrefixData',
        $.s('IncrementPrefix',$.d('++')),
        $.s('DecrementPrefix',$.d('--')),
        $.s('NotPrefix',$.d('!')),
        $.s('BitNotPrefix',$.d('~')),
        $.s('MinusPrefix',$.d('-')),
        $.s('ReferencePrefix',$.d('&')),
        $.s('AddressPrefix',$.d('*'))
    )),
    $.r('PostfixExpression')
)
const MultiplicativeExpression=$.s('MultiplicativeExpression',
    $.r('PrefixExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('Multiplicative',$.d('*')),
                $.s('Divide',$.d('/')),
                $.s('Mod',$.d('%'))
            ),$.r('PrefixExpression'))
    )
)
const AdditiveExpression=$.s('AdditiveExpression',
    $.r('MultiplicativeExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('Additive',$.d('+')),
                $.s('Subtract',$.d('-'))
            ),$.r('MultiplicativeExpression'))
    )
)
const ShiftExpression=$.s('ShiftExpression',
    $.r('AdditiveExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('LeftShift',$.d('<<')),
                $.s('RightShift',$.d('>>'))
            ),$.r('AdditiveExpression'))
    )
)
const RelationalExpression=$.s('RelationalExpression',
    $.r('ShiftExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('Less',$.d('<')),
                $.s('Greater',$.d('>')),
                $.s('LessEqual',$.d('<=')),
                $.s('GreaterEqual',$.d('>=')),
                $.s('Instanceof',$.d('instanceof'))
            ),$.r('ShiftExpression'))
    )
)
const EqualityExpression=$.s('EqualityExpression',
    $.r('RelationalExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('Equal',$.d('==')),
                $.s('NotEqual',$.d('!=')),
                $.s('StrictEqual',$.d('===')),
                $.s('StrictNotEqual',$.d('!=='))
            ),$.r('RelationalExpression'))
    )
)
const BitwiseAndExpression=$.s('BitwiseAndExpression',
    $.r('EqualityExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('BitwiseAnd',$.d('&'))),
            $.r('EqualityExpression'))
    )
)
const BitwiseXorExpression=$.s('BitwiseXorExpression',
    $.r('BitwiseAndExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('BitwiseXor',$.d('^'))),
            $.r('BitwiseAndExpression'))
    )
)
const BitwiseOrExpression=$.s('BitwiseOrExpression',
    $.r('BitwiseXorExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('BitwiseOr',$.d('|'))),
            $.r('BitwiseXorExpression'))
    )
)
const LogicalAndExpression=$.s('LogicalAndExpression',
    $.r('BitwiseOrExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('LogicalAnd',$.d('&&'))),
            $.r('BitwiseOrExpression'))
    )
)
const LogicalOrExpression=$.s('BinaryExpression',
    $.r('LogicalAndExpression'),$.l('OperList',
        $.s('OperData',
            $.o('Oper',$.s('LogicalOr',$.d('||'))),
            $.r('LogicalAndExpression'))
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
    MultiplicativeExpression,
    AdditiveExpression,
    ShiftExpression,
    RelationalExpression,
    EqualityExpression,
    BitwiseAndExpression,
    BitwiseXorExpression,
    BitwiseOrExpression,
    LogicalAndExpression,
    LogicalOrExpression,
    TernaryExpression,
    Expression
]