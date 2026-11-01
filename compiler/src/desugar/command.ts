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
    ArrayType, MapType
} from '../utils'
import {contains_throw, desugar_cast, desugar_oper, no_bool_cond, slang_desugar_visitor} from './tool'
const D_Assign:slang_desugar_visitor=(node:Assign,call)=>{
    node.data=call(node.data) as Expression
    node.value=call(node.value) as Expression
    if(node.oper!=null&&node.oper!='')
        return call(new ExprCommand(desugar_oper(node.oper,node.data,node.value)))
    //cast 是 check 给赋值结果标的类型转换,套在右值上;
    //复合赋值要在展开前套,不然会转到 a+b 整体而不是写出来的 b
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
    return call(
        new ListCommand([
            new ExprCommand(new ArgumentsPostfix(new IdentifierExpr(cur_try.catch_name),[],[node.data])),
            new AAssign(new IdentifierExpr(cur_try.throw_name),new BooleanLiteral('true'))
        ])
    )
}
const D_IfStatement:slang_desugar_visitor=(node:IfStatement,call)=>{
    node.condition=no_bool_cond(call(node.condition) as Expression)
    node.commands=call(node.commands)
    node.else_=call(node.else_)
    return node
}
//switch 展开成 if-else 链:条件先存进临时变量,避免每个分支重复求值
let switch_id=0
const D_SwitchStatement:slang_desugar_visitor=(node:SwitchStatement,call)=>{
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
    //VarDecl 也得过一遍脱糖(它会被降成赋值),否则 HIR 里没有这个节点的 visitor
    return new ListCommand([
        call(new VarDecl(name,condition.type??new VoidType(),condition)) as Command,
        body
    ])
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
let try_id=0
//当前正在脱糖的 try 用到的名字(嵌套时保存/恢复)
let cur_try={throw_name:'throw',catch_name:'catch',finally_name:'finally'}
//这条语句里(递归,但不进 lambda 体)会不会抛:if/while/for 里的 throw 也算

const D_TryStatement:slang_desugar_visitor=(node:TryStatement,call)=>{
    //先按 Throw 切分包裹、再脱糖:call 之后的树上 Throw 已被 D_Throw 换成 ListCommand,instanceof 扫不到
    const _do=(command:Command)=>{
        if(command instanceof ListCommand){
            let index=0
            let _if=-1
            for(let i of command.commands){
                //第一个"会抛"的语句之后都要包进 if(throw);控制结构里的 throw 也算
                if(contains_throw(i)){
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
                const cond=new IdentifierExpr(cur_try.throw_name)
                cond.type=new BooleanType()
                command.commands.length=_if+1
                command.commands.push(new IfStatement(cond,
                    _do(new ListCommand([new AAssign(new IdentifierExpr(cur_try.throw_name),new BooleanLiteral('false')),...tail])),
                    new ListCommand([])))
            }
        }
        return command
    }
    //每个 try 用自己的一套名字:嵌套 try 才不会把外层的 catch/finally 覆盖掉
    const id=try_id++
    const throw_name=`throw@${id}`
    const has_catch=!node.no_catch
    //没有 catch 的 try 只负责跑 finally:throw 直接交给外层处理器,不要吞掉
    const catch_name=has_catch?`catch@${id}`:cur_try.catch_name
    const finally_name=`finally@${id}`
    //先进内层再恢复:内层用自己的名字,外层的不受影响
    const prev_try=cur_try
    cur_try={throw_name,catch_name,finally_name}
    _do(node.commands)
    node.commands=call(node.commands)
    node.catch_.command=new ListCommand([node.catch_.command,new ExprCommand(new ArgumentsPostfix(new IdentifierExpr(finally_name),[],[]))])
    node.finally_=call(node.finally_)
    node.commands=new ListCommand([node.commands,new ExprCommand(new ArgumentsPostfix(new IdentifierExpr(finally_name),[],[]))])
    //catch/finally 体是这次 call 里才脱糖的,那时还得看到自己的名字,所以最后才恢复
    const head:Command[]=[
        new VarDecl(throw_name,new BooleanType(),new BooleanLiteral('false'))
    ]
    if(has_catch)
        head.push(new VarDecl(catch_name,new LambdaType(null,new Map([[node.catch_.iden,node.catch_.type]])
                ,new VoidType(),false),
            new LambdaExpression(null,new Map([[node.catch_.iden,node.catch_.type]]),new VoidType(),node.catch_.command)))
    const built=call(new ListCommand([
        ...head,
        new VarDecl(finally_name,new LambdaType(null,new Map(),new VoidType(),false),
            new LambdaExpression(null,new Map(),new VoidType(),node.finally_)),
        node.commands
    ]))
    cur_try=prev_try
    return built
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