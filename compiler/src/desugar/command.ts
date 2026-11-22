import {de_cond, de_operation, de_ref, slang_desugar_visitor} from './tool'
import {
    AAssign,
    Assign,
    Expression,
    Await,
    IdentifierExpr,
    ReferencePrefix,
    ReferenceType,
    VarDecl,
    VM,
    Command,
    Return,
    ExprCommand,
    Throw,
    Continue,
    GotoCommand,
    Break,
    IfStatement,
    WhileStatement,
    DoWhileStatement,
    ListCommand,
    LabelCommand,
    ForStatement,
    ForeachStatement,
    NumberType,
    NumberLiteral,
    InequalExpression,
    IndexPostfix,
    NullLiteral,
    IncrementPostfix,
    IncrementPrefix,
    SwitchStatement,
    Delete,
    Case,
    EqualExpression,
    AddAssign,
    AddExpression,
    SubAssign,
    SubExpression,
    MulAssign,
    MulExpression,
    DivAssign,
    DivExpression,
    ModAssign,
    ModExpression,
    AndAssign,
    ShrAssign,
    ShlExpression,
    ShrExpression,
    ShlAssign,
    XorExpression,
    XorAssign,
    OrExpression,
    OrAssign, AndExpression
} from '../utils'
const D_Assign:slang_desugar_visitor=(node:Assign,call)=>{
    node.data=call(node.data) as Expression
    node.value=call(node.value) as Expression
    if(node.oper!=null)
        return de_operation(node,node.oper,node.data,node.value)
    if(node instanceof AddAssign)node.value=new AddExpression(node.data,node.value)
    if(node instanceof SubAssign)node.value=new SubExpression(node.data,node.value)
    if(node instanceof MulAssign)node.value=new MulExpression(node.data,node.value)
    if(node instanceof DivAssign)node.value=new DivExpression(node.data,node.value)
    if(node instanceof ModAssign)node.value=new ModExpression(node.data,node.value)
    if(node instanceof AndAssign)node.value=new AndExpression(node.data,node.value)
    if(node instanceof OrAssign)node.value=new OrExpression(node.data,node.value)
    if(node instanceof XorAssign)node.value=new XorExpression(node.data,node.value)
    if(node instanceof ShlAssign)node.value=new ShlExpression(node.data,node.value)
    if(node instanceof ShrAssign)node.value=new ShrExpression(node.data,node.value)
    return new AAssign(node.data,node.value)
}
const D_VarDecl:slang_desugar_visitor=(node:VarDecl,call)=>{
    //如果是需要处理ref需要撤销de_ref
    const is_ref=node.value.type instanceof ReferenceType&&node.value.type.literal=='call'
    node.value=call(node.value) as Expression
    //operation
    if(node.oper!=null){
        const ret=de_operation(node,node.oper,new IdentifierExpr(node.name),node.value)
        if(ret instanceof Expression)return call(new ExprCommand(de_ref(ret)))
        if(ret instanceof VarDecl)return new AAssign(new IdentifierExpr(ret.name),ret.value)
    }
    if(is_ref)node.value=(node.value as ReferencePrefix).expr
    return new AAssign(new IdentifierExpr(node.name),node.value)
}
const D_Await:slang_desugar_visitor=(node:Await,call)=>{
    node.command=call(node.command) as Command
    return node
}
const D_Return:slang_desugar_visitor=(node:Return,call)=>{
    const is_ref=node.data.type instanceof ReferenceType&&node.data.type.literal=='call'
    node.data=call(node.data) as Expression
    if(is_ref)node.data=(node.data as ReferencePrefix).expr
    return node
}
const D_ExprCommand:slang_desugar_visitor=(node:ExprCommand,call)=>{
    node.data=call(node.data) as Expression
    return new AAssign(new IdentifierExpr(';Im air'),node.data)
}
const D_Throw:slang_desugar_visitor=(node:Throw,call)=>{
    node.data=call(node.data) as Expression
    return node
}
const D_Continue:slang_desugar_visitor=(node:Continue,call)=>{
    return new GotoCommand('continue')
}
const D_Break:slang_desugar_visitor=(node:Break,call)=>{
    return new GotoCommand('break')
}
const D_VM:slang_desugar_visitor=(node:VM,call)=>{
    node.param=node.param.map(call) as Expression[]
    return node
}
const D_Delete:slang_desugar_visitor=(node:Delete,call)=>{
    const is_ref=node.expr.type instanceof ReferenceType&&node.expr.type.literal=='call'
    node.expr=call(node.expr) as Expression
    if(is_ref)node.expr=(node.expr as ReferencePrefix).expr
    return node
}
const D_If:slang_desugar_visitor=(node:IfStatement,call)=>{
    node.condition=call(de_cond(node.condition)) as Expression
    node.commands=call(node.commands) as Command
    node.else_=call(node.else_) as Command
    return node
}
const D_While:slang_desugar_visitor=(node:WhileStatement,call)=>{
    return call(new ListCommand([
        new LabelCommand('while'),
        node.commands,
        new LabelCommand('continue'),
        new IfStatement(node.condition,new GotoCommand('while'),null),
        new LabelCommand('break')
    ]))
}
const D_DoWhile:slang_desugar_visitor=(node:DoWhileStatement,call)=>{
    return call(new ListCommand([
        node.commands,
        new WhileStatement(node.condition,node.commands)
    ]))
}
const D_For:slang_desugar_visitor=(node:ForStatement,call)=>{
    return call(new ListCommand([
        ...node.init,
        new WhileStatement(node.condition,
            new ListCommand([
                node.commands,
                ...node.step
            ])
        )
    ]))
}
const D_Foreach:slang_desugar_visitor=(node:ForeachStatement,call)=>{
    return call(new ForStatement(
        [new VarDecl('for@index',new NumberType(),new NumberLiteral('0'))],
        new InequalExpression(new IndexPostfix(node.data,new IdentifierExpr('for@index')),new NullLiteral(null)),
        [new IncrementPrefix(new IdentifierExpr('for@index'))],
        new ListCommand([
            new VarDecl(node.iden,node.iden_type,new IndexPostfix(node.data,new IdentifierExpr('for@index'))),
            node.commands
        ])
    ))
}
const D_Switch:slang_desugar_visitor=(node:SwitchStatement,call)=>{
    const build=(index:number)=>{
        if(index==node.case_list.length)return node.default_
        const cast_list=node.case_list[index]
        return new IfStatement(new EqualExpression(node.condition,cast_list.condition),
            cast_list.commands,build(index+1))
    }
    return call(build(0))
}
const D_ListCommand:slang_desugar_visitor=(node:ListCommand,call)=>{
    node.commands=node.commands.map(call) as Command[]
    return node
}
export default new Map<any,slang_desugar_visitor>([
    [Assign,D_Assign],
    [VarDecl,D_VarDecl],
    [Await,D_Await],
    [Return,D_Return],
    [ExprCommand,D_ExprCommand],
    [Throw,D_Throw],
    [Continue,D_Continue],
    [Break,D_Break],
    [VM,D_VM],
    [Delete,D_Delete],
    [IfStatement,D_If],
    [WhileStatement,D_While],
    [DoWhileStatement,D_DoWhile],
    [ForStatement,D_For],
    [ForeachStatement,D_Foreach],
    [SwitchStatement,D_Switch],
    [ListCommand,D_ListCommand]
])