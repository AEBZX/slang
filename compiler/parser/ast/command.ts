import Type from './identifier'
import Expr from './expr'
import {ast_data, Parser, TokenType} from '../../utils'
const $=Parser.ast
function assign_command(){
    return $.ref(()=>$.s('AssignCommand',
        Expr(),
        $.o('=','+=','-=', '*=', '/=', '%=', '<<=', '>>=', '&&=', '||=','&=','|=','^='),
        Expr()
    ))
}
function basic_command(){
    return $.ref(()=>$.s('BasicCommand',$.o(
        assign_command(),
        $.s('ReturnCommand','return',$.c('ReturnData',Expr())),
        'break','continue',
        $.s('ThrowCommand','throw',Expr()),
        $.s('CallCommand',$.c('Await','await'),Expr()),
        $.s('VarCommand','var',TokenType.Identifier,':',Type(),$.c('Assign','=',Expr())),
        $.s('IncrementOrDecrement',Expr(),$.o('++','--')),
        $.s('VMCommand','vm',TokenType.String),
    ),';'))
}
function cond(){
    return $.ref(()=>$.s('Condition','(',Expr(),')'))
}
function block_command(){
    return $.ref(()=>$.o(
        $.s('IfStatement','if',cond(),command(),$.c('Choose','else',command())),
        $.s('SwitchStatement','switch',cond(),'{',
            $.l('CaseList',$.s('Case','case',Expr(),'=>',command())),
            $.c('Choose','default','=>',command()),'}'),
        $.s('ForStatement','for','(',$.l('InitCommand',basic_command()),Expr(),';',$.l('StepCommand',basic_command()),'}',command()),
        $.s('ForeachStatement','for','(',TokenType.Identifier,':',Expr(),')',command()),
        $.s('WhileStatement','while',cond(),command()),
        $.s('DoWhileStatement','do',command(),'while',cond(),';'),
        $.s('TryStatement','try',command(),'catch','(',TokenType.Identifier,':',Type(),')',command(),
            $.c('Choose','finally',command()))
    ))
}
export default function command(){
    return $.ref(()=>$.o(
        basic_command(),
        block_command(),
        $.s('Commands','{',$.l('CommandList',command()),'}')
    ))
}
const BasicCommand=(ast:ast_data)=>typeof ast.children[0]=='string'?
    (ast.children[0]=='break'?{
        type:'BreakCommand',
        comment:'',
        line:ast.line,
        children:[]
    }:{
        type:'ContinueCommand',
        comment:'',
        line:ast.line,
        children:[]
    }):ast.children[0]
const ReturnData=(ast:ast_data)=>{
    return {
        type:'NullLiteral',
        comment:'',
        line:ast.line,
        children:[]
    }
}
const Throw_VMCommand=(ast:ast_data)=>{
    ast.children=[ast.children[1]]
    return ast
}
const CallCommand=(ast:ast_data)=>{
    if(ast.children[0]!='await')ast.children[0]='unawait'
    return ast
}
const VarCommand=(ast:ast_data)=>{
    let name=ast.children[1]
    let type=ast.children[3]
    let value={
        type:'NullLiteral',
        comment:'',
        line:ast.line,
        children:[]
    }
    if((ast.children[ast.children.length-1] as ast_data).type!='Assign')
        value=ast.children[ast.children.length-1] as ast_data
    return {
        type:'VarCommand',
        comment:'',
        line:ast.line,
        children:[name,type,value]
    }
}
const IncrementOrDecrement=(ast:ast_data)=>{
    ast.children=[ast.children[0]]
    ast.type=ast.children[1]=='++'?'IncrementCommand':'DecrementCommand'
    return ast
}
const Condition=(ast:ast_data)=>ast.children[1] as ast_data
const IfStatement=(ast:ast_data)=>{
    let condition=ast.children[1]
    let command=ast.children[2]
    let else_=null
    if((ast.children[ast.children.length-1] as ast_data).type!='Choose')
        else_=ast.children[ast.children.length-1] as ast_data
    return {
        type:'IfStatement',
        comment:'',
        line:ast.line,
        children:[condition,command,else_]
    }
}
const SwitchStatement=(ast:ast_data)=>{
    let value=ast.children[1]
    let case_list=ast.children[3]
    let default_=null
    if((ast.children[ast.children.length-2] as ast_data).type!='Choose')
        default_=ast.children[ast.children.length-2] as ast_data
    return {
        type:'SwitchStatement',
        comment:'',
        line:ast.line,
        children:[value,case_list,default_]
    }
}
const Case=(ast:ast_data)=>{
    ast.children=[ast.children[1],ast.children[3]]
    return ast
}
const ForStatement=(ast:ast_data)=>{
    ast.children=[ast.children[2],ast.children[3],ast.children[5],ast.children[7]]
    return ast
}
const ForeachStatement=(ast:ast_data)=>{
    ast.children=[ast.children[2],ast.children[4],ast.children[6]]
    return ast
}
const WhileStatement=(ast:ast_data)=>{
    ast.children=[ast.children[1],ast.children[2]]
    return ast
}
const DoWhileStatement=(ast:ast_data)=>{
    ast.children=[ast.children[3],ast.children[1]]
    return ast
}
const TryStatement=(ast:ast_data)=>{
    let children=[ast.children[1],ast.children[4],ast.children[6],ast.children[8],null]
    if((ast.children[ast.children.length-1] as ast_data).type!='Choose')
        children[4]=ast.children[ast.children.length-1] as ast_data
    ast.children=children
    return ast
}
const Commands=(ast:ast_data)=>ast.children[1] as ast_data
export const CommandVisitors=[
    $.factory('BasicCommand',BasicCommand),
    $.factory('ReturnData',ReturnData),
    $.factory('Throw_VMCommand',Throw_VMCommand),
    $.factory('CallCommand',CallCommand),
    $.factory('VarCommand',VarCommand),
    $.factory('IncrementOrDecrement',IncrementOrDecrement),
    $.factory('Condition',Condition),
    $.factory('IfStatement',IfStatement),
    $.factory('SwitchStatement',SwitchStatement),
    $.factory('Case',Case),
    $.factory('ForStatement',ForStatement),
    $.factory('ForeachStatement',ForeachStatement),
    $.factory('WhileStatement',WhileStatement),
    $.factory('DoWhileStatement',DoWhileStatement),
    $.factory('TryStatement',TryStatement),
    $.factory('Commands',Commands),
]