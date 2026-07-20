import Expr from './expr'
import Type from './identifier'
import {ast_data, Parser, TokenType} from '../../utils'
const $=Parser.ast
const assign=$.s('AssignCommand',$.ref(()=>Expr),
    $.o('=','+=','-=','*=','/=','%=','<<=','>>=','&=','|=','^=','&&=','||='),
    $.ref(()=>Expr))
const basic_command=$.s('BasicCommand',$.o(
    assign,$.s('Return','return',$.c('ReturnValue',$.ref(()=>Expr))),'break','continue'
    ,$.s('Call',$.c('Await','await'),$.ref(()=>Expr)),$.s('Throw','throw',$.ref(()=>Expr))
    ,$.s('Increment',$.ref(()=>Expr),'++'),$.s('Decrement',$.ref(()=>Expr),'--')
    ,$.s('VM','vm',TokenType.String),$.s('Var','var',TokenType.Identifier,':',Type,$.c('Assign','=',$.ref(()=>Expr)))
),';')
const cond=$.s('Cond','(',$.ref(()=>Expr),')')
let block_command=$.o(
    $.s('IfStatement','if',cond,$.ref(()=>commands),$.c('Else','else',$.ref(()=>commands))),
    $.s('SwitchStatement','switch',cond,$.s('{',
        $.l('CaseList',$.s('Case','case',$.ref(()=>Expr),'=>',$.ref(()=>commands))),
        $.c('Default','default',$.ref(()=>commands)),'}')),
    $.s('WhileStatement','while',cond,$.ref(()=>commands)),
    $.s('DoWhileStatement','do',$.ref(()=>commands),'while',cond),
    $.s('ForStatement','for','(',$.l('Init',basic_command),$.ref(()=>Expr),$.l('Step',basic_command),')',$.ref(()=>commands)),
    $.s('ForeachStatement','for','(',TokenType.Identifier,':',$.ref(()=>Expr),')',$.ref(()=>commands)),
    $.s('TryStatement','try',$.ref(()=>commands),'catch','(',TokenType.Identifier,':',Type,')',$.ref(()=>commands),
        $.c('Finally','finally',$.ref(()=>commands)))
)
const commands=$.o(
    $.o(basic_command,block_command),
    $.s('Commands','{',$.l('CommandList',$.o(basic_command,block_command)),'}')
)
export default commands
const ReturnVisitor=(ast:ast_data)=>{
    if((ast.children[1] as ast_data).type=='ReturnValue'){
        return {
            type:ast.type,
            line:ast.line,
            comment:'',
            children:[]
        }
    }
    return {
        type:ast.type,
        line:ast.line,
        comment:'',
        children:[ast.children[1]]
    }
}
const CallVisitor=(ast:ast_data)=>{
    if((ast.children[0] as ast_data).type=='Await'){
        return {
            type:'Call',
            line:ast.line,
            comment:'',
            children:[ast.children[1]]
        }
    }
    return ast
}
const ThrowVisitor=(ast:ast_data)=>{
    return {
        type:ast.type,
        line:ast.line,
        comment:'',
        children:[ast.children[1]]
    }
}
const IncrementVisitor=(ast:ast_data)=>{
    return {
        type:ast.type,
        line:ast.line,
        comment:'',
        children:[ast.children[0]]
    }
}
const DecrementVisitor=IncrementVisitor
const VMVisitor=ThrowVisitor
const VarVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!=':'&&i!='='&&i!='var')
    if((ast.children[ast.children.length-1] as ast_data).type=='Assign')ast.children.shift()
    return ast
}
const CondVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>typeof i!='string')
    return ast
}
const StatementVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>typeof i!='string')
    return ast
}
const CaseVisitor=StatementVisitor
const IfStatementVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!='if'&&i!='('&&i!=')'&&(i as ast_data).type!='Else')
    return ast
}
const SwitchStatementVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!='switch'&&i!='('&&i!=')'&&i!='{'&&i!='}'&&(i as ast_data).type!='Default'&&
    i!='default')
    return ast
}
const ForeachVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!='for'&&i!='('&&i!=')'&&i!=':')
    return ast
}
const TryVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!='try'&&i!='catch'&&i!='finally'&&i!=':'&&i!='('&&i!=')')
    return ast
}
const BasicCommandVisitor=(ast:ast_data)=>{
    ast.children=ast.children.filter(i=>i!=';')
    return ast
}
const CommandsVisitor=(ast:ast_data)=>{
    return ast.children[1] as ast_data
}
export const CommandVisitor=[
    $.factory('Return',ReturnVisitor),
    $.factory('Call',CallVisitor),
    $.factory('Throw',ThrowVisitor),
    $.factory('Increment',IncrementVisitor),
    $.factory('Decrement',DecrementVisitor),
    $.factory('VM',VMVisitor),
    $.factory('Var',VarVisitor),
    $.factory('Cond',CondVisitor),
    $.factory('IfStatement',IfStatementVisitor),
    $.factory('SwitchStatement',SwitchStatementVisitor),
    $.factory('ForeachStatement',ForeachVisitor),
    $.factory('TryStatement',TryVisitor),
    $.factory('Case',CaseVisitor),
    $.factory('WhileStatement',StatementVisitor),
    $.factory('DoWhileStatement',StatementVisitor),
    $.factory('ForStatement',StatementVisitor),
    $.factory('Case',CaseVisitor),
    $.factory('BasicCommand',BasicCommandVisitor),
    $.factory('Commands',CommandsVisitor)
]