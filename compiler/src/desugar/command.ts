import {
    LogicAndAssign, LogicOrAssign, LogicAndExpression, LogicOrExpression,
    EqualExpression,
    AAssign,
    AddAssign,
    AddExpression, ArgumentsPostfix,
    Assign,
    AndAssign,
    OrAssign,
    ShlAssign,
    ShrAssign,
    AndExpression,
    OrExpression,
    XorExpression,
    XorAssign, BooleanLiteral, BooleanType,
    ExprCommand, Command, DoWhileStatement, ForeachStatement, ForStatement, IdentifierExpr, IfStatement,
    IndexPostfix, InequalExpression, LambdaExpression, LambdaType, ListCommand,
    ModAssign,
    MulAssign,
    MulExpression, NullLiteral, NumberLiteral, NumberType, PostfixExpression,
    Return,
    ShlExpression,
    ShrExpression,
    SubAssign,
    SubExpression, SwitchStatement,
    Throw, TryStatement,
    VarDecl, VoidType, WhileStatement, Expression, IncrementPostfix, Await, VM, ModExpression, DivExpression, DivAssign,
    ArrayType, MapType, LabelCommand, GotoCommand, Break, Continue
} from '../utils'
import {contains_throw, current_loop, desugar_cast, desugar_oper, no_bool_cond, pop_loop, push_loop, slang_desugar_visitor} from './tool'
import {slang_check_visitor} from "../check/tool";
const D_Assign:slang_desugar_visitor=(node:Assign,call)=>{
    node.data=call(node.data) as Expression
    node.value=call(node.value) as Expression
    if(node.oper!=null&&node.oper!='')
        return call(new ExprCommand(desugar_oper(node.oper,node.data,node.value)))
    if(node.cast!=null&&node.cast!='')
        node.value=desugar_cast(node.cast,node.value)
    if(node instanceof AAssign)return node
    if(node instanceof AddAssign)return call(new AAssign(node.data,new AddExpression(node.data,node.value)))
    if(node instanceof SubAssign)return call(new AAssign(node.data,new SubExpression(node.data,node.value)))
    if(node instanceof MulAssign)return call(new AAssign(node.data,new MulExpression(node.data,node.value)))
    if(node instanceof DivAssign)return call(new AAssign(node.data,new DivExpression(node.data,node.value)))
    if(node instanceof ModAssign)return call(new AAssign(node.data,new ModExpression(node.data,node.value)))
    if(node instanceof ShlAssign)return call(new AAssign(node.data,new ShlExpression(node.data,node.value)))
    if(node instanceof ShrAssign)return call(new AAssign(node.data,new ShrExpression(node.data,node.value)))
    if(node instanceof LogicAndAssign)return call(new AAssign(node.data,new LogicAndExpression(node.data,node.value)))
    if(node instanceof LogicOrAssign)return call(new AAssign(node.data,new LogicOrExpression(node.data,node.value)))
    if(node instanceof AndAssign)return call(new AAssign(node.data,new AndExpression(node.data,node.value)))
    if(node instanceof OrAssign)return call(new AAssign(node.data,new OrExpression(node.data,node.value)))
    if(node instanceof XorAssign)return call(new AAssign(node.data,new XorExpression(node.data,node.value)))
}
const D_VarDecl:slang_desugar_visitor=(node:VarDecl,call)=>{
    node.value=call(node.value) as Expression
    let _call=new AAssign(new IdentifierExpr(node.name),node.value)
    _call.oper=node.oper
    _call.cast=node.cast
    return call(_call)
}
const D_ExprCommandOrReturn:slang_desugar_visitor=(node:ExprCommand|Return,call)=>{
    node.data=call(node.data) as Expression
    return node
}
const D_Await:slang_desugar_visitor=(node:Await,call)=>{
    node.command=call(node.command)
    return node
}
const D_VM:slang_desugar_visitor=(node:VM,call)=>{
    node.param=node.param.map(call) as Expression[]
    return node
}
const D_Throw:slang_desugar_visitor=(node:Throw,call)=>{
    node.data=call(node.data) as Expression
    return node
}
const D_IfStatement:slang_desugar_visitor=(node:IfStatement,call)=>{
    node.condition=no_bool_cond(call(node.condition) as Expression)
    node.commands=call(node.commands)
    node.else_=call(node.else_)
    return node
}
const D_SwitchStatement:slang_desugar_visitor=(node:SwitchStatement,call)=>{
    let switch_id=0
    const name=`switch@${switch_id++}`
    const condition=call(node.condition) as Expression
    let body:Command=node.default_==null?new ListCommand([]):call(node.default_) as Command
    for(let i=node.case_list.length-1;i>=0;i--){
        const item=node.case_list[i]
        body=new IfStatement(
            new EqualExpression(new IdentifierExpr(name),call(item.condition) as Expression),
            call(item.commands) as Command,
            body)
    }
    return new ListCommand([
        call(new VarDecl(name,condition.type??new VoidType(),condition)) as Command,
        body
    ])
}
const D_DoWhileStatement:slang_desugar_visitor=(node:DoWhileStatement,call)=>{
    node.condition=no_bool_cond(call(node.condition) as Expression)
    const labels=push_loop()
    node.commands=call(node.commands)
    pop_loop()
    //do-while 先执行一遍再判条件
    return new ListCommand([
        new LabelCommand(labels.continue),
        node.commands,
        new IfStatement(node.condition,new GotoCommand(labels.continue),new GotoCommand(labels.break)),
        new LabelCommand(labels.break)
    ])
}
//while(cond){xxx}脱糖为:
//  while@n: if(cond){ xxx; goto while@n } else goto break@n; break@n:
//标签按循环嵌套分配唯一序号,break/continue 绑定最近一层循环
const D_WhileStatement:slang_desugar_visitor=(node:WhileStatement,call)=>{
    node.condition=no_bool_cond(call(node.condition) as Expression)
    const labels=push_loop()
    node.commands=call(node.commands)
    pop_loop()
    return new ListCommand([
        new LabelCommand(labels.continue),
        new IfStatement(node.condition,
            new ListCommand([node.commands,new GotoCommand(labels.continue)]),
            new GotoCommand(labels.break)),
        new LabelCommand(labels.break)
    ])
}
const D_Continue:slang_desugar_visitor=(node,call)=>{
    const loop=current_loop()
    return new GotoCommand(loop==null?'continue':loop.continue)
}
const D_Break:slang_desugar_visitor=(node,call)=>{
    const loop=current_loop()
    return new GotoCommand(loop==null?'break':loop.break)
}
const D_ForStatement:slang_desugar_visitor=(node:ForStatement,call)=>{
    node.init=node.init.map(i=>call(i)) as VarDecl[]
    node.condition=call(node.condition) as Expression
    node.step=node.step.map(i=>call(i))
    //body 交给 WhileStatement 的脱糖:那里先压入本层循环标签,break/continue 才绑得对
    return call(new ListCommand([
        ...node.init,
        new WhileStatement(node.condition,new ListCommand([node.commands,...node.step]))
    ]))
}
const D_ForeachStatement:slang_desugar_visitor=(node:ForeachStatement,call)=>{
    node.data=call(node.data) as Expression
    return call(
        new ForStatement(
            [
                new VarDecl('for',new NumberType(),new NumberLiteral('0')),
                new VarDecl(node.iden,node.iden_type,new NullLiteral(''))
            ],
            new InequalExpression(new IndexPostfix(node.data,new IdentifierExpr('for')),
                new NullLiteral('')),
            [new ExprCommand(new IncrementPostfix(new IdentifierExpr('for')))],
            new ListCommand([
                new AAssign(new IdentifierExpr(node.iden),new IndexPostfix(node.data,new IdentifierExpr('for'))),
                node.commands
            ])
        )
    )
}
const D_TryStatement:slang_desugar_visitor=(node:TryStatement,call)=>{
    node.commands=call(node.commands)
    node.catch_.command=call(node.catch_.command)
    node.finally_=call(node.finally_)
    return node
}
const D_ListCommand:slang_desugar_visitor=(node:ListCommand,call)=>{
    node.commands=node.commands.map(call)
    return node
}
export default new Map<any,slang_desugar_visitor>([
    [Assign,D_Assign],
    [VarDecl,D_VarDecl],
    [ExprCommand,D_ExprCommandOrReturn],
    [Return,D_ExprCommandOrReturn],
    [Throw,D_Throw],
    [IfStatement,D_IfStatement],
    [SwitchStatement,D_SwitchStatement],
    [DoWhileStatement,D_DoWhileStatement],
    [WhileStatement,D_WhileStatement],
    [ForStatement,D_ForStatement],
    [ForeachStatement,D_ForeachStatement],
    [TryStatement,D_TryStatement],
    [ListCommand,D_ListCommand],
    [Await,D_Await],
    [VM,D_VM],
    [Break,D_Break],
    [Continue,D_Continue]
])