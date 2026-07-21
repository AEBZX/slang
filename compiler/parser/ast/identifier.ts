import {ast_data, Parser, TokenType} from '../../utils'
const $=Parser.ast
const BasicType=$.o('number','string','boolean','void',
    $.s('MemberType',$.l('Member',TokenType.Identifier,'.'),TokenType.Identifier))
const Type=$.s('Type',
    $.o(
        $.s('ThesesType','(',$.ref(()=>Type),')'),
        $.s('ArrayType',BasicType, $.l('[]')),
        $.s('MapType',BasicType, $.l('{}')),
        $.s('LambdaType',$.w('LambdaParamsType'
                ,'(', $.s('LambdaParamType',TokenType.Identifier,':',$.ref(()=>Type)), ',', ')'),'=>',$.ref(()=>Type)),
        BasicType
    ),$.l('PointFix','*')
)
export default Type
const MemberTypeVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!='.')
    return ast
}
const ThesesTypeVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>typeof i!='string')
    return ast
}
const ArrayTypeVisitor=ThesesTypeVisitor
const MapTypeVisitor=ArrayTypeVisitor
const LambdaParamTypeVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!=':')
    return ast
}
const LambdaParamsTypeVisitor=MapTypeVisitor
const LambdaTypeVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!='=>')
    return ast
}
const TypeVisitor=(ast:ast_data)=>{
    if(typeof ast.children[0]=='string')
        switch (ast.children[0]){
            case 'number':
                ast.children[0]={
                    type:'NumberType',
                    line:[],
                    comment:'',
                    children:[]
                }
                break
            case 'string':
                ast.children[0]={
                    type:'StringType',
                    line:[],
                    comment:'',
                    children:[]
                }
                break
            case 'boolean':
                ast.children[0]={
                    type:'BooleanType',
                    line:[],
                    comment:'',
                    children:[]
                }
                break
            case 'void':
                ast.children[0]={
                    type:'VoidType',
                    line:[],
                    comment:'',
                    children:[]
                }
                break
        }
    let ls=ast.children[1] as ast_data
    return {
        type:ast.type,
        line:ls.line,
        comment:ls.comment,
        children:[ast.children[0],...ls.children]
    }
}
export const IdentifierVisitor=[
    $.factory('MemberType',MemberTypeVisitor),
    $.factory('ThesesType',ThesesTypeVisitor),
    $.factory('ArrayType',ArrayTypeVisitor),
    $.factory('MapType',MapTypeVisitor),
    $.factory('LambdaParamType',LambdaParamTypeVisitor),
    $.factory('LambdaParamsType',LambdaParamsTypeVisitor),
    $.factory('LambdaType',LambdaTypeVisitor),
    $.factory('Type',TypeVisitor)
]