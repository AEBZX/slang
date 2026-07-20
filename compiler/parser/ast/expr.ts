import {ast_data, ast_visitor, Parser, TokenType} from '../../utils'
import Type from '../ast/identifier'
import Command from '../ast/command'
const $=Parser.ast
const NumberLiteral=$.s('NumberLiteral',TokenType.Number)
const StringLiteral=$.s('StringLiteral',TokenType.String)
const BooleanLiteral=$.s('BooleanLiteral',$.o('true','false'))
const NullLiteral=$.s('NullLiteral','null')
const Identifier=$.s('Identifier',TokenType.Identifier)
const Primary=$.o(
    NumberLiteral,
    StringLiteral,
    BooleanLiteral,
    NullLiteral,
    Identifier,
    $.s('ThesesPrimary','(',$.ref(()=>Expr),')'),
    $.w('ArrayLiteral','[',$.ref(()=>Expr),',',']'),
    $.w('MapLiteral','{',$.s('MapKeyData',Identifier,':',$.ref(()=>Expr)),',','}'),
    $.s('LambdaLiteral',$.w('LambdaParam','(',$.s('Param',Identifier,':',Type),',',')'),'=>',$.ref(()=>Command))
)
const Postfix=$.s('Postfix',Primary,$.l('FixOfPost',$.o(
    '++','--',$.s('MemberPostFix','.',TokenType.Identifier),
    $.w('CallPostfix','(',$.ref(()=>Expr),',',')'),
    $.s('ComputedPostfix','[',$.ref(()=>Expr),']')
)))
const Prefix=$.s('Prefix',$.l('FixOfPre',
        $.o('~','!','-','&','*','++','--','new')),
    Postfix)
const Multiplicative=$.s('Multiplicative',Prefix,$.l('Op',
    $.o('*','/','%'),Prefix))
const Additive=$.s('Additive',Multiplicative,$.l('Op',
    $.o('+','-'),Multiplicative))
const Shift=$.s('Shift',Additive,$.l('Op',
    $.o('<<','>>'),Additive))
const Relational=$.s('Relational',Shift,$.l('Op',
    $.o('<','<=','>','>='),Shift))
const Equality=$.s('Equality',Relational,$.l('Op',
    $.o('==','!='),Relational))
const BitwiseAnd=$.s('BitwiseAnd',Equality,$.l('Op',
    '&',Equality))
const BitwiseXor=$.s('BitwiseXor',BitwiseAnd,$.l('Op',
    '^',BitwiseAnd))
const BitwiseOr=$.s('BitwiseOr',BitwiseXor,$.l('Op',
    '|',BitwiseXor))
const LogicalAnd=$.s('LogicalAnd',BitwiseOr,$.l('Op',
    '&&',BitwiseOr))
const LogicalOr=$.s('LogicalOr',LogicalAnd,$.l('Op',
    '||',LogicalAnd))
const Binary=LogicalOr
const Ternary=$.s('Ternary',Binary,'?',$.ref(()=>Ternary),':',$.ref(()=>Ternary))
const Expr=$.o(Ternary,Binary)
export default Expr
const ThesesPrimaryVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>typeof i!='string')
    return ast
}
const ArrayLiteralVisitor=ThesesPrimaryVisitor
const MapLiteralVisitor=ArrayLiteralVisitor
const MapKeyDataVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!=':')
    return ast
}
const LambdaLiteralVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!='=>')
    return ast
}
const LambdaParamVisitor=MapLiteralVisitor
const ParamVisitor=MapKeyDataVisitor
const PostfixVisitor=(ast:ast_data)=>{
    let ls=(<ast_data>ast.children[1]).children
    for(let i=0;i<ls.length;i++){
        if(typeof ls[i]=='string')
            ls[i]={
                type:ls[i]=='++'?'IncrementPostfix':'DecrementPostfix',
                line:[],
                comment:'',
                children:[]
            }
    }
    ast.children.shift()
    ast.children.push(...ls)
    return ast
}
const MemberPostfixVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!='.')
    return ast
}
const CallPostfixVisitor=ThesesPrimaryVisitor
const ComputedPostfixVisitor=CallPostfixVisitor
const FixOfPreVisitor=(ast:ast_data)=>{
    let g=(type:string)=> {
        return {
            type,
            comment:'',
            line:[],
            children:[]
        }
    }
    for(let i of ast.children){
        if(i=='!')return g('NotPrefix')
        if(i=='-')return g('NegPrefix')
        if(i=='~')return g('ContraryPrefix')
        if(i=='&')return g('AddressPrefix')
        if(i=='*')return g('DereferencePrefix')
        if(i=='++')return g('IncrementPrefix')
        if(i=='--')return g('DecrementPrefix')
        if(i=='new')return g('NewPrefix')
    }
}
const PrefixVisitor=(ast:ast_data)=>{
    let ls=ast.children[0] as ast_data
    let array=ls.children
    return {
        type:ast.type,
        line:ls.line,
        comment:ls.comment,
        children:[ast.children[1],...array]
    }
}
const BinaryVisitor=ThesesPrimaryVisitor
const TernaryVisitor=BinaryVisitor
export const ExprVisitor=[
    $.factory('ThesesPrimary',ThesesPrimaryVisitor),
    $.factory('ArrayLiteral',ArrayLiteralVisitor),
    $.factory('MapLiteral',MapLiteralVisitor),
    $.factory('MapKeyData',MapKeyDataVisitor),
    $.factory('LambdaLiteral',LambdaLiteralVisitor),
    $.factory('LambdaParam',LambdaParamVisitor),
    $.factory('Param',ParamVisitor),
    $.factory('Postfix',PostfixVisitor),
    $.factory('MemberPostfix',MemberPostfixVisitor),
    $.factory('CallPostfix',CallPostfixVisitor),
    $.factory('ComputedPostfix',ComputedPostfixVisitor),
    $.factory('FixOfPre',FixOfPreVisitor),
    $.factory('Prefix',PrefixVisitor),
    $.factory('Multiplicative',BinaryVisitor),
    $.factory('Additive',BinaryVisitor),
    $.factory('Shift',BinaryVisitor),
    $.factory('Relational',BinaryVisitor),
    $.factory('Equality',BinaryVisitor),
    $.factory('BitwiseAnd',BinaryVisitor),
    $.factory('BitwiseXor',BinaryVisitor),
    $.factory('BitwiseOr',BinaryVisitor),
    $.factory('LogicalAnd',BinaryVisitor),
    $.factory('LogicalOr',BinaryVisitor),
    $.factory('Ternary',TernaryVisitor)
]