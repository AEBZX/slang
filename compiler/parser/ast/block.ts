import Expr from './expr'
import Type from './identifier'
import Command from './command'
import {ast_data, Parser, TokenType} from '../../utils'
const $=Parser.ast
const modifier=$.l('Modifier',$.o('public','private','async','sync','static','unstatic'))
export const link=$.s('Link','link',
    $.w('BlockName','(',TokenType.Identifier,'.',')'),'as',TokenType.Identifier)
const function_=$.s('Function','function',
    $.w('ParamIdentifier','(',$.s('Param',TokenType.Identifier,':',Type),',',')'),':',Type,Command)
const var_=$.s('Variable','var',Type,$.c('Assign','=',Expr),';')
const class_=$.s('Class','class',
    $.c('ClassOf','of',$.s('ClassName',$.l('Name',TokenType.Identifier,'.'),TokenType.Identifier)),'{',$.ref(()=>blocks),'}')
const interface_=$.s('Interface','interface',
    $.c('ClassOf','of',$.s('ClassName',$.l('Name',TokenType.Identifier,'.'),TokenType.Identifier)),
    '{',$.ref(()=>blocks),'}')
const enum_=$.s('Enum','enum',$.w('EnumData','{',TokenType.Identifier,',','}'))
export const module_=$.s('Module','module','{',$.ref(()=>blocks),'}')
const blocks=$.l('BlockList',$.o(
        $.s('Block',modifier,TokenType.Identifier, $.o(function_, var_, class_, interface_, enum_))
    ))
const BlockNameVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!='.')
    return ast
}
const LinkVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!='as'&&i!='link')
    return ast
}
const BlockVisitor_=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>typeof i!='string')
    return ast
}
const VariableVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!=':'&&i!='var'&&i!='='&&i!=';')
    if((ast.children[ast.children.length-1] as ast_data).type=='Assign')ast.children.shift()
    return ast
}
const ParamIdentifierVisitor=BlockVisitor_
const ParamVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!=':')
    return ast
}
const ClassOfVisitor=(ast:ast_data)=>{
    let ls=ast.children.shift()
    ast.children.push(...((ast.children[1] as ast_data).children[0] as ast_data).children)
    ast.children.push(ls)
    ast.children=ast.children.filter(i=>i!='of'&&i!='.')
    return ast
}
const EnumDataVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!='{'&&i!='}')
    return ast
}
const EnumVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!='enum')
    return ast
}
export const BlockVisitor=[
    $.factory('BlockName',BlockNameVisitor),
    $.factory('Link',LinkVisitor),
    $.factory('Function',BlockVisitor_),
    $.factory('Class',BlockVisitor_),
    $.factory('Interface',BlockVisitor_),
    $.factory('Variable',VariableVisitor),
    $.factory('ParamIdentifier',ParamIdentifierVisitor),
    $.factory('Param',ParamVisitor),
    $.factory('ClassOf',ClassOfVisitor),
    $.factory('EnumData',EnumDataVisitor),
    $.factory('Enum',EnumVisitor)
]