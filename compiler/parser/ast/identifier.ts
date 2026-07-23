import {ast_data, Parser, TokenType} from '../../utils'
const $=Parser.ast
function BasicType(){
    return $.ref(()=>$.o(
        'void','boolean','number','string',$.s('ClassType',TokenType.Identifier,$.l(
            'fix','.',TokenType.Identifier))
    ))
}
export default function Type(){
    return $.ref(()=> $.s('Type',
        $.o($.s('ThesesType','(',Type(),')'),BasicType(),
            $.s('LambdaType',$.w('LambdaParam','('
                ,$.s('ParamIdentifier',TokenType.Identifier,':',Type()),',',')'),'=>',Type())),
        $.l('TypeFix',$.o('[]','{}','*'))))
}
const ClassType=(ast:ast_data)=>{
    let child=[]
    for(let i of ast.children){
        if(typeof i=='string')child.push(i)
        else child.push(...(i as ast_data).children)
    }
    ast.children=child
    return ast
}
const ThesesType=(ast:ast_data)=>ast.children[1] as ast_data
const LambdaType=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!='=>')
    return ast
}
const LambdaParam=(ast:ast_data)=>{
    ast.children.pop()
    ast.children.shift()
    return ast
}
const ParamIdentifier=(ast:ast_data)=>{
    ast.children=[ast.children[0],ast.children[2]]
    return ast
}
export const TypeVisitors=[
    $.factory('ClassType',ClassType),
    $.factory('ThesesType',ThesesType),
    $.factory('LambdaType',LambdaType),
    $.factory('LambdaParam',LambdaParam),
    $.factory('ParamIdentifier',ParamIdentifier),
]