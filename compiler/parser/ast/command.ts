import {
    AAssign,
    AddAssign,
    ast_data,
    ast_generate, BitAndAssign, BitOrAssign, BitShlAssign,
    BitShrAssign, BitXorAssign, Break, Call, Case, Continue, Decrement,
    DivAssign, DoWhileStatement,
    Expression, ForeachStatement, ForStatement, IfStatement, Increment, ListCommand, ModAssign,
    MulAssign, Return, slang_ast_generate,
    SubAssign, SwitchStatement, Throw, TryStatement, VarDeclaration, VM, WhileStatement
} from '../../utils'
const G_Assign:slang_ast_generate=(data,tree)=>{
    const g=(left:Expression,right:Expression,operator:string)=>{
        switch (operator) {
            case '=':
                return new AAssign(left,right)
            case '+=':
                return new AddAssign(left,right)
            case '-=':
                return new SubAssign(left,right)
            case '*=':
                return new MulAssign(left,right)
            case '/=':
                return new DivAssign(left,right)
            case '%=':
                return new ModAssign(left,right)
            case '&=':
                return new BitAndAssign(left,right)
            case '|=':
                return new BitOrAssign(left,right)
            case '^=':
                return new BitXorAssign(left,right)
            case '<<=':
                return new BitShlAssign(left,right)
            case '>>=':
                return new BitShrAssign(left,right)
        }
    }
    let left=tree(data.children.get(0) as ast_data)
    let right=tree(data.children.get(1) as ast_data)
    const op:Record<string,string>={
        'AAssign':'=','AddAssign':'+=','SubAssign':'-=','MulAssign':'*=',
        'DivAssign':'/=','ModAssign':'%=','BitAndAssign':'&=','BitOrAssign':'|=',
        'BitXorAssign':'^=','BitShlAssign':'<<=','BitShrAssign':'>>='
    }
    return g(left,right,op[data.type])
}
const G_VarDeclaration:slang_ast_generate=(data,tree)=>{
    let name=(data.children.get(0) as ast_data).children.get(0) as string
    let type=tree(data.children.get(1) as ast_data)
    let value=data.children.has(2)?tree(data.children.get(2) as ast_data):null
    return new VarDeclaration(name,type,value)
}
const G_Call:slang_ast_generate=(data,tree)=>{
    let await_=data.children.get(0)=='await'
    let expr=data.children.get(await_?1:0) as ast_data
    return new Call(tree(expr),await_)
}
const G_Return:slang_ast_generate = (data, tree) => {
    let ret=data.children.has(0)?tree(data.children.get(0) as ast_data):null
    return new Return(ret)
}
const G_Break:slang_ast_generate=(data,tree)=>new Break()
const G_Continue:slang_ast_generate=(data,tree)=>new Continue()
const G_Throw:slang_ast_generate=(data,tree)=>new Throw(tree(data.children.get(0) as ast_data))
const G_VM:slang_ast_generate=(data,tree)=>new VM(data.children.get(0) as string)
const G_Increment:slang_ast_generate=(data,tree)=>new Increment(tree(data.children.get(0) as ast_data))
const G_Decrement:slang_ast_generate=(data,tree)=>new Decrement(tree(data.children.get(0) as ast_data))
const G_Condition:slang_ast_generate=(data,tree)=>tree(data.children.get(0) as ast_data)
const G_IfStatement:slang_ast_generate=(data,tree)=>new IfStatement(
    tree(data.children.get(0) as ast_data),
    tree(data.children.get(1) as ast_data),
    data.children.has(2)?tree(data.children.get(2) as ast_data):null
)
const G_WhileStatement:slang_ast_generate=(data,tree)=>new WhileStatement(
    tree(data.children.get(0) as ast_data),
    tree(data.children.get(1) as ast_data)
)
const G_DoWhileStatement:slang_ast_generate=(data,tree)=>new DoWhileStatement(
    tree(data.children.get(0) as ast_data),
    tree(data.children.get(1) as ast_data)
)
const G_ForStatement:slang_ast_generate=(data,tree)=>{
    let init=[]
    let Init=data.children.get(0) as ast_data
    for(let [k,v] of Init.children)
        if(typeof v=='object')
            init.push(tree(v))
    let step=[]
    let Step=data.children.get(2) as ast_data
    for(let [k,v] of Step.children)
        if(typeof v=='object')
            step.push(tree(v))
    return new ForStatement(init,tree(data.children.get(1) as ast_data),step,
        tree(data.children.get(3) as ast_data))
}
const G_ForeachStatement:slang_ast_generate=(data,tree)=>new ForeachStatement(
    (data.children.get(0) as ast_data).children.get(0) as string,
    tree(data.children.get(1) as ast_data),
    tree(data.children.get(2) as ast_data)
)
const G_SwitchStatement:slang_ast_generate=(data,tree)=>{
    let cond=tree(data.children.get(0) as ast_data)
    let list=data.children.get(1) as ast_data
    let cases:Case[]=[]
    for(let [k,v] of list.children)
        if(typeof v=='object')
            cases.push(new Case(tree(v.children.get(0) as ast_data),tree(v.children.get(1) as ast_data)))
    return new SwitchStatement(cond,cases,data.children.has(2)?tree(data.children.get(2) as ast_data):null)
}
const G_TryStatement:slang_ast_generate=(data,tree)=>{
    return new TryStatement(
        tree(data.children.get(0) as ast_data),
        {
            iden:data.children.get(1) as string,
            type:tree(data.children.get(2) as ast_data),
            command:tree(data.children.get(3) as ast_data)
        },
        data.children.has(4)?tree(data.children.get(4) as ast_data):null
    )
}
const G_Commands:slang_ast_generate=(data,tree)=>{
    let commands=[]
    for(let [k,v] of data.children)
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
    ['BitAndAssign',G_Assign],
    ['BitOrAssign',G_Assign],
    ['BitXorAssign',G_Assign],
    ['BitShlAssign',G_Assign],
    ['BitShrAssign',G_Assign],
    ['VarDeclaration',G_VarDeclaration],
    ['Call',G_Call],
    ['Return',G_Return],
    ['Break',G_Break],
    ['Continue',G_Continue],
    ['Throw',G_Throw],
    ['VM',G_VM],
    ['Increment',G_Increment],
    ['Decrement',G_Decrement],
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