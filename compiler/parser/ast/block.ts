import {ast_data, Parser, TokenType} from '../../utils'
const $=Parser.ast
import Type from './identifier'
import Command from './command'
import Expr from './expr'
export function link(){
    return $.ref(()=>$.s('Linked',
        $.s('Link','link',TokenType.Identifier,$.l('fix','.',TokenType.Identifier),'as',TokenType.Identifier),';'))
}
function modifier(){
    return $.ref(()=>$.l('Modifier',$.o(
        'public','private','async','sync','static','unstatic'
    )))
}
function function_(){
    return $.ref(()=>$.s('FunctionBlock',
        'function',Type(),$.w('Params','(',$.s('ParamIdentifier',
            TokenType.Identifier,':',Type()),',',')'),Command()))
}
function enum_(){
    return $.ref(()=>$.s('EnumBlock','enum',$.w('EnumData','{',TokenType.Identifier,',','}')))
}
function interface_(){
    return $.ref(()=>$.s('InterfaceBlock','interface',$.c('Of',
        'of',
        TokenType.Identifier,$.l('fix','.',TokenType.Identifier)
    ),block()))
}
function variable(){
    return $.ref(()=>$.s('VarBlock','var',Type(),$.c('Assign','=',Expr())))
}
function class_(){
    return $.ref(()=>$.s('ClassBlock','class',$.c('Of',
        'of',
        TokenType.Identifier,$.l('fix','.',TokenType.Identifier)
    ),block()))
}
export function module_(){
    return $.ref(()=>$.s('ModuleBlock','module',block()))
}
function block(){
    return $.ref(()=>$.s('Blocks','{',$.l('BlockList',$.s('Block',
        modifier(),TokenType.Identifier,':',$.o(function_(),variable(),interface_(),enum_(),class_(),module_())
    )),'}'))
}
const Link=(ast:ast_data)=>{
    let name=[ast.children[1],...(ast.children[2] as ast_data).children.filter(i=>i!='.')]
    let link=ast.children[4]
    ast.children=[{type:'BlockName',children:name,comment:'',line:ast.line},link]
    return ast
}
const Linked=(ast:ast_data)=>{
    ast.children.pop()
    return ast
}
const ParamIdentifier=(ast:ast_data)=>{
    ast.children=[ast.children[0],ast.children[2]]
    return ast
}
const Params=(ast:ast_data)=>{
    ast.children.shift()
    ast.children.pop()
    return ast
}
const FunctionBlock=(ast:ast_data)=>{
    ast.children.shift()
    return ast
}
const EnumData=Params
const EnumBlock=(ast:ast_data)=>{
    (ast.children[1] as ast_data).type='EnumBlock'
    return ast.children[1] as ast_data
}
const InterfaceBlock=(ast:ast_data)=>{
    let command=ast.children[ast.children.length-1]
    let of=[]
    if((ast.children[ast.children.length-2] as ast_data).type=='fix'){
        of.push(ast.children[1])
        of.push(...(ast.children[2] as ast_data).children)
    }
    ast.children=[{type:'Of',children:of,comment:'',line:ast.line},command]
    return ast
}
const ClassBlock=InterfaceBlock
const ModuleBlock=(ast:ast_data)=>{
    ast.children.shift()
    return ast
}
const Blocks=(ast:ast_data)=>{
    return ast.children[1] as ast_data
}
const BlockList=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!=':')
    return ast
}
const VarBlock=(ast:ast_data)=>{
    ast.children.shift()
    if((ast.children[ast.children.length-1] as ast_data).type=='Assign')
        ast.children[ast.children.length-1]=null
    else ast.children=ast.children.filter(i=>i!='=')
    return ast
}
export const BlockVisitor=[
    $.factory('Link',Link),
    $.factory('Linked',Linked),
    $.factory('ParamIdentifier',ParamIdentifier),
    $.factory('Params',Params),
    $.factory('FunctionBlock',FunctionBlock),
    $.factory('EnumData',EnumData),
    $.factory('EnumBlock',EnumBlock),
    $.factory('InterfaceBlock',InterfaceBlock),
    $.factory('ClassBlock',ClassBlock),
    $.factory('ModuleBlock',ModuleBlock),
    $.factory('Blocks',Blocks),
    $.factory('BlockList',BlockList),
    $.factory('VarBlock',VarBlock)
]