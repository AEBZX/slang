import {
    AAssign,
    AddAssign, AndAssign, ast_data, Await, Break, Case, Command, Continue,
    DivAssign, DoWhileStatement, ExprCommand,
    Expression, ForeachStatement, ForStatement, IfStatement, ListCommand,
    ModAssign,
    MulAssign, OrAssign, Return, ShlAssign, ShrAssign,
    slang_ast_generate,
    SubAssign, SwitchStatement, Throw, TryStatement, Type, VarDecl, VM, WhileStatement, XorAssign
} from '../../utils'
import {AssignMap, to_ast_data, to_string, tree_ast} from "./tool";

const G_Assign:slang_ast_generate=(data,tree)=>{
    const g=(left:Expression,right:Expression,operator:string)=>
        new (AssignMap.get(operator))(left,right)
    const left=tree_ast<Expression>(data,0,tree)
    const right=tree_ast<Expression>(data,1,tree)
    return g(left,right,data.type)
}
const G_VarDecl:slang_ast_generate=(data,tree)=>{
    const name=to_string(to_ast_data(data,0),0)
    const type=tree_ast<Type>(data,1,tree)
    const value=tree_ast<Expression>(data,2,tree)
    return new VarDecl(name,type,value)
}
const G_Return:slang_ast_generate = (data, tree) => {
    return new Return(tree_ast(data,0,tree))
}
const G_Break:slang_ast_generate=(data,tree)=>new Break()
const G_Continue:slang_ast_generate=(data,tree)=>new Continue()
const G_Await:slang_ast_generate=(data, tree)=>new Await(tree_ast(data,0,tree))
const G_ExprCommand:slang_ast_generate=(data, tree)=>new ExprCommand(tree_ast(data,0,tree))
const G_Throw:slang_ast_generate=(data,tree)=>new Throw(tree_ast<Expression>(data,0,tree))
const G_VM:slang_ast_generate=(data,tree)=> {
    const str=to_string(data,0)
    let param:Expression[]=[]
    for(const v of to_ast_data(data,1).children.values())
        param.push(tree_ast<Expression>(v as ast_data,0,tree))
    return new VM(str,param)
}
const G_Condition:slang_ast_generate=(data,tree)=>tree(data.children.get(0) as ast_data)
const G_IfStatement:slang_ast_generate=(data,tree)=>new IfStatement(
    tree_ast(data,0,tree),
    tree_ast(data,1,tree),
    tree_ast(data,2,tree)
)
const G_WhileStatement:slang_ast_generate=(data,tree)=>new WhileStatement(
    tree_ast(data,0,tree),
    tree_ast(data,1,tree)
)
const G_DoWhileStatement:slang_ast_generate=(data,tree)=>new DoWhileStatement(
    tree_ast(data,0,tree),
    tree_ast(data,1,tree)
)
const G_ForStatement:slang_ast_generate=(data,tree)=>{
    let init:VarDecl[]=[]
    const Init=to_ast_data(data,0)
    for(const v of Init.children.values())
        if(typeof v=='object')
            init.push(tree(v) as VarDecl)
    let step:Command[]=[]
    const Step=to_ast_data(data,2)
    for(const v of Step.children.values())
        if(typeof v=='object')
            step.push(tree(v))
    return new ForStatement(init,tree_ast(data,1,tree),step,
        tree_ast(data,3,tree))
}
const G_ForeachStatement:slang_ast_generate=(data,tree)=>new ForeachStatement(
    to_string(to_ast_data(data,0),0),
    tree_ast(data,1,tree),
    tree_ast(data,2,tree)
)
const G_SwitchStatement:slang_ast_generate=(data,tree)=>{
    const cond=tree_ast<Expression>(data,0,tree)
    const list=data.children.get(1) as ast_data
    let cases:Case[]=[]
    for(const v of list.children.values())
        if(typeof v=='object')
            cases.push(new Case(tree_ast(v,0,tree),tree_ast(v,1,tree)))
    return new SwitchStatement(cond,cases,tree_ast(data,2,tree))
}
const G_TryStatement:slang_ast_generate=(data,tree)=>{
    return new TryStatement(
        tree_ast(data,0,tree),
        {
            iden:to_string(data,1),
            type:tree_ast(data,2,tree),
            command:tree_ast(data,3,tree)
        },
       tree_ast(data,4,tree)
    )
}
const G_Commands:slang_ast_generate=(data,tree)=>{
    let commands=[]
    for(const v of data.children.values())
        if(typeof v=='object')
            commands.push(tree(v))
    return new ListCommand(commands)
}
export default new Map([
    ['AAssign',G_Assign],
    ['AddAssign',G_Assign],
    ['SubAssign',G_Assign],
    ['MulAssign',G_Assign],
    ['DivAssign',G_Assign],
    ['ModAssign',G_Assign],
    ['AndAssign',G_Assign],
    ['OrAssign',G_Assign],
    ['XorAssign',G_Assign],
    ['ShlAssign',G_Assign],
    ['ShrAssign',G_Assign],
    ['VarDecl',G_VarDecl],
    ['Return',G_Return],
    ['Break',G_Break],
    ['Continue',G_Continue],
    ['Await',G_Await],
    ['ExprCommand',G_ExprCommand],
    ['Throw',G_Throw],
    ['VM',G_VM],
    ['IfStatement',G_IfStatement],
    ['WhileStatement',G_WhileStatement],
    ['DoWhileStatement',G_DoWhileStatement],
    ['ForStatement',G_ForStatement],
    ['ForeachStatement',G_ForeachStatement],
    ['SwitchStatement',G_SwitchStatement],
    ['TryStatement',G_TryStatement],
    ['Commands',G_Commands],
    ['Condition',G_Condition]
])