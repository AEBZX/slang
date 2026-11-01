import {
    BooleanLiteral, VoidType, AAssign,
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
    //先按节点名找,找不到再退回序号
    const find=(name:string,index:number)=>{
        for(const v of data.children.values())
            if(v!=null&&typeof v=='object'&&(v as ast_data).type==name)
                return v as ast_data
        return to_ast_data(data,index)
    }
    const init:VarDecl[]=[]
    const Init=find('Init',0)
    if(Init!=null)
        for(const v of Init.children.values())
            if(typeof v=='object')
                init.push(tree(v) as VarDecl)
    const step:Command[]=[]
    const Step=find('Step',2)
    if(Step!=null)
        for(const v of Step.children.values())
            if(typeof v=='object')
                step.push(tree(v))
    //条件可以不写(for(var i=0;;i++)),缺省是恒真
    const Cond=find('Expression',1)
    //条件省略时序号会落到 Step 上,那不是条件
    const has_cond=Cond!=null&&Cond.type!='Step'&&Cond.type!='Init'
    const condition=has_cond?tree(Cond) as Expression:new BooleanLiteral('true')
    const body=find('Commands',3)
    return new ForStatement(init,condition,step,body==null?null:tree(body) as Command)
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
    //catch/finally 都是可选的,按节点名找(缺一个时序号会错位)
    const find=(name:string)=>{
        for(const v of data.children.values())
            if(v!=null&&typeof v=='object'&&(v as ast_data).type==name)
                return v as ast_data
        return null
    }
    const catch_data=find('CatchData')
    //没写 catch 就补一个空的(catch(e:void){}),这样 finally-only 的 try 也能脱糖
    const catch_=catch_data==null
        ?{iden:'e',type:new VoidType(),command:new ListCommand([])}
        :{iden:to_string(catch_data,0),type:tree_ast<Type>(catch_data,1,tree),command:tree_ast<Command>(catch_data,2,tree)}
    const finally_data=find('FinallyData')
    const finally_=finally_data==null?new ListCommand([]):tree_ast<Command>(finally_data,0,tree)
    const ret=new TryStatement(tree_ast(data,0,tree),catch_,finally_)
    ret.no_catch=catch_data==null
    return ret
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
    ['LogicAndAssign',G_Assign],
    ['LogicOrAssign',G_Assign],
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