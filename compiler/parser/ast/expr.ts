import {Parser, ast_data, TokenType} from '../../utils'
const $=Parser.ast
function Literal(){
    return $.ref(()=>$.o(
        $.s('NumberLiteral',TokenType.Number),
        $.s('StringLiteral',TokenType.String),
        $.s('BooleanLiteral',$.o('true','false')),
        $.s('NullLiteral','null')
    ))
}
function Primary(){
    return $.ref(()=>$.o(
        $.s('ThesesExpr','(',Expr(),')'),
        $.w('ArrayExpr','[',Expr(),',',']'),
        $.w('MapExpr','{',$.s('MapKey',TokenType.Identifier,'=',$.ref(()=>Expr())),',','}'),
        $.s('IdentifierExpr',TokenType.Identifier),
        Literal()
    ))
}
function Postfix(){
    return $.ref(()=>$.s(
        'PostfixExpr',
        Primary(),
        $.l('PostfixData',$.o(
            $.s('IncrementPostfix','++'),
            $.s('DecrementPostfix','--'),
            $.s('ComputedPostfix','[',Expr(),']'),
            $.w('CallPostfix','(',Expr(),',',')'),
            $.s('MemberPostfix','.',TokenType.Identifier)
        ))
    ))
}
function Prefix(){
    return $.ref(()=>$.s(
        'PrefixExpr',
        $.l('PrefixData',$.o(
            $.s('IncrementPrefix','++'),
            $.s('DecrementPrefix','--'),
            $.s('NegatePrefix','-'),
            $.s('NotPrefix','!'),
            $.s('BitwiseNotPrefix','~'),
            $.s('NewPrefix','new')
        )),
        Postfix()
    ))
}
function Multiplicative(){
    return $.ref(()=>$.s(
        'MultiplicativeExpr',
        Prefix(),
        $.l('Oper',$.s('BinaryData',$.o('*','/','%'),Prefix()))
    ))
}
function Additive(){
    return $.ref(()=>$.s(
        'AdditiveExpr',
        Multiplicative(),
        $.l('Oper',$.s('BinaryData',$.o('+','-'),Multiplicative()))
    ))
}
function Shift(){
    return $.ref(()=>$.s(
        'ShiftExpr',
        Additive(),
        $.l('Oper',$.s('BinaryData',$.o('<<','>>'),Additive()))
    ))
}
function Relational(){
    return $.ref(()=>$.s(
        'RelationalExpr',
        Shift(),
        $.l('Oper',$.s('BinaryData',$.o('<=','>=','<','>'),Shift()))
    ))
}
function Equality(){
    return $.ref(()=>$.s(
        'EqualityExpr',
        Relational(),
        $.l('Oper',$.s('BinaryData',$.o('==','!='),Relational()))
    ))
}
function BitwiseAnd(){
    return $.ref(()=>$.s(
        'BitwiseAndExpr',
        Equality(),
        $.l('Oper',$.s('BinaryData','&',Equality()))
    ))
}
function BitwiseXor(){
    return $.ref(()=>$.s(
        'BitwiseXorExpr',
        BitwiseAnd(),
        $.l('Oper',$.s('BinaryData','^',BitwiseAnd()))
    ))
}
function BitwiseOr(){
    return $.ref(()=>$.s(
        'BitwiseOrExpr',
        BitwiseXor(),
        $.l('Oper',$.s('BinaryData','|',BitwiseXor()))
    ))
}
function LogicalAnd(){
    return $.ref(()=>$.s(
        'LogicalAndExpr',
        BitwiseOr(),
        $.l('Oper',$.s('BinaryData','&&',BitwiseOr()))
    ))
}
function LogicalOr(){
    return $.ref(()=>$.s(
        'LogicalOrExpr',
        LogicalAnd(),
        $.l('Oper',$.s('BinaryData','||',LogicalAnd()))
    ))
}
function Binary(){
    return LogicalOr()
}
function Ternary(){
    return $.ref(()=>$.s(
        'TernaryExpr',
        Binary(),
        '?',
        Expr(),
        ':',
        Expr()
    ))
}
function Expr(){
    return $.ref(()=>$.o(Binary(),Ternary()))
}
const ThesesExpr=(ast:ast_data)=>ast.children[1]
const ArrayExpr=(ast:ast_data)=>{
    ast.children.pop()
    ast.children.shift()
    return ast
}
const MapExpr=ArrayExpr
const MapKey=(ast:ast_data)=>{
    ast.children=[ast.children[0],ast.children[1]]
    return ast
}
const ComputedPostfix=(ast:ast_data)=>{
    ast.children=[ast.children[1]]
    return ast
}
const CallPostfix=ArrayExpr
const MemberPostfix=(ast:ast_data)=>ComputedPostfix