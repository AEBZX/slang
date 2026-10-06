import {
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
    ArrayType, MapType
} from '../utils'
import {desugar_oper, no_bool_cond, slang_desugar_visitor} from './tool'
const D_Assign:slang_desugar_visitor=(node:Assign,call)=>{
    node.data=call(node.data) as Expression
    node.value=call(node.value) as Expression
    if(node.oper!=null&&node.oper!='')
        return call(new ExprCommand(desugar_oper(node.oper,node.data,node.value)))
    if(node instanceof AAssign)return node
    if(node instanceof AddAssign)return call(new AAssign(node.data,new AddExpression(node.data,node.value)))
    if(node instanceof SubAssign)return call(new AAssign(node.data,new SubExpression(node.data,node.value)))
    if(node instanceof MulAssign)return call(new AAssign(node.data,new MulExpression(node.data,node.value)))
    if(node instanceof DivAssign)return call(new AAssign(node.data,new DivExpression(node.data,node.value)))
    if(node instanceof ModAssign)return call(new AAssign(node.data,new ModExpression(node.data,node.value)))
    if(node instanceof ShlAssign)return call(new AAssign(node.data,new ShlExpression(node.data,node.value)))
    if(node instanceof ShrAssign)return call(new AAssign(node.data,new ShrExpression(node.data,node.value)))
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
    return call(
        new ListCommand([
            new ExprCommand(new ArgumentsPostfix(new IdentifierExpr('throw'),[],[node.data])),
            new AAssign(new IdentifierExpr('throw'),new BooleanLiteral('true'))
        ])
    )
}
const D_IfStatement:slang_desugar_visitor=(node:IfStatement,call)=>{
    node.condition=no_bool_cond(call(node.condition) as Expression)
    node.commands=call(node.commands)
    node.else_=call(node.else_)
    return node
}
const D_SwitchStatement:slang_desugar_visitor=(node:SwitchStatement,call)=>{
    node.condition=call(node.condition) as Expression
    for(let i of node.case_list){
        i.condition=call(i.condition) as Expression
        i.commands=call(i.commands)
    }
    node.default_=call(node.default_)
    return node
}
const D_DoWhileStatement:slang_desugar_visitor=(node:DoWhileStatement,call)=>{
    return call(new ListCommand([
        node.commands,
        new WhileStatement(node.condition,node.commands)]))
}
const D_WhileStatement:slang_desugar_visitor=(node:WhileStatement,call)=>{
    node.condition=no_bool_cond(call(node.condition) as Expression)
    node.commands=call(node.commands)
    return node
}
const D_ForStatement:slang_desugar_visitor=(node:ForStatement,call)=>{
    node.init=node.init.map(i=>call(i)) as VarDecl[]
    node.condition=call(node.condition) as Expression
    node.step=node.step.map(i=>call(i))
    node.commands=call(node.commands)
    return call(new ListCommand([
        ...node.init,
        new WhileStatement(node.condition,new ListCommand([node.commands,...node.step]))
    ]))
}
const D_ForeachStatement:slang_desugar_visitor=(node:ForeachStatement,call)=>{
    node.data=call(node.data) as Expression
    node.commands=call(node.commands)
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
    //先按 Throw 切分包裹、再脱糖:call 之后的树上 Throw 已被 D_Throw 换成 ListCommand,instanceof 扫不到
    const _do=(command:Command)=>{
        if(command instanceof ListCommand){
            let index=0
            let _if=-1
            for(let i of command.commands){
                //第一个 throw 之后的语句都要包进 if(throw);嵌套块交给递归
                if(i instanceof Throw){
                    _if=index
                    break
                }
                if(i instanceof Await)_do(i.command)
                if(i instanceof ListCommand)_do(i)
                index++
            }
            if(_if>-1){
                //throw 本身留在原位脱糖,其后语句截断进 if(throw){throw=false;...},不然会执行两遍
                const tail=command.commands.slice(_if+1)
                const cond=new IdentifierExpr('throw')
                cond.type=new BooleanType()
                command.commands.length=_if+1
                command.commands.push(new IfStatement(cond,
                    _do(new ListCommand([new AAssign(new IdentifierExpr('throw'),new BooleanLiteral('false')),...tail])),
                    new ListCommand([])))
            }
        }
        return command
    }
    _do(node.commands)
    node.commands=call(node.commands)
    node.catch_.command=call(node.catch_.command)
    node.finally_=call(node.finally_)
    return call(new ListCommand([
        new VarDecl('throw',new BooleanType(),new BooleanLiteral('false')),
        new VarDecl('catch',new LambdaType(null,new Map([[node.catch_.iden,node.catch_.type]])
                ,new VoidType(),false),
            new LambdaExpression(null,new Map([[node.catch_.iden,node.catch_.type]]),new VoidType(),node.catch_.command)),
        new VarDecl('finally',new LambdaType(null,new Map(),new VoidType(),false),
            new LambdaExpression(null,new Map(),new VoidType(),node.finally_)),
        node.commands
    ]))
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
    [VM,D_VM]
])