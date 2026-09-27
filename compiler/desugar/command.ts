import {
    AAssign,
    AddAssign,
    AdditiveExpression, ArgumentsPostfix,
    Assign,
    BitAndAssign,
    BitOrAssign,
    BitShlAssign,
    BitShrAssign,
    BitwiseAndExpression,
    BitwiseOrExpression,
    BitwiseXorExpression,
    BitXorAssign, BooleanLiteral, BooleanType,
    Call, Command, Decrement, DoWhileStatement, ForeachStatement, ForStatement, IdentifierExpr, IfStatement,
    Increment, IndexPostfix, InequalityExpression, LambdaExpression, LambdaType, ListCommand,
    ModAssign,
    MulAssign,
    MultiplicativeExpression, NullLiteral, NumberLiteral, NumberType, PostfixExpression,
    Return,
    ShiftLeftExpression,
    ShiftRightExpression,
    SubAssign,
    SubtractiveExpression, SwitchStatement,
    Throw, TryStatement,
    VarDeclaration, VoidType, WhileStatement
} from '../utils'
import {desugar_oper, no_bool_cond, slang_desugar_visitor} from './tool'
const D_Assign:slang_desugar_visitor=(node:Assign,call)=>{
    node.data=call(node.data)
    node.value=call(node.value)
    if(node.oper!=null&&node.oper!='')
        return call(new Call(desugar_oper(node.oper,node.data,node.value),false))
    if(node instanceof AAssign)return node
    if(node instanceof AddAssign)return call(new AAssign(node.data,new AdditiveExpression(node.data,node.value)))
    if(node instanceof SubAssign)return call(new AAssign(node.data,new SubtractiveExpression(node.data,node.value)))
    if(node instanceof MulAssign)return call(new AAssign(node.data,new MultiplicativeExpression(node.data,node.value)))
    if(node instanceof ModAssign)return call(new AAssign(node.data,new ModAssign(node.data,node.value)))
    if(node instanceof BitShlAssign)return call(new AAssign(node.data,new ShiftLeftExpression(node.data,node.value)))
    if(node instanceof BitShrAssign)return call(new AAssign(node.data,new ShiftRightExpression(node.data,node.value)))
    if(node instanceof BitAndAssign)return call(new AAssign(node.data,new BitwiseAndExpression(node.data,node.value)))
    if(node instanceof BitOrAssign)return call(new AAssign(node.data,new BitwiseOrExpression(node.data,node.value)))
    if(node instanceof BitXorAssign)return call(new AAssign(node.data,new BitwiseXorExpression(node.data,node.value)))
}
const D_VarDeclaration:slang_desugar_visitor=(node:VarDeclaration,call)=>{
    node.value=call(node.value)
    return node
}
const D_CallOrReturn:slang_desugar_visitor=(node:Call|Return,call)=>{
    node.data=call(node.data)
    return node
}
const D_Throw:slang_desugar_visitor=(node:Throw,call)=>{
    node.data=call(node.data)
    return call(
        new ListCommand([
            new Call(new PostfixExpression(new IdentifierExpr('throw'),[new ArgumentsPostfix(null,[node.data])]),false),
            new Assign(new IdentifierExpr('throw'),new BooleanLiteral('true'))
        ])
    )
}
const D_IncrementOrDecrement:slang_desugar_visitor=(node:Increment|Decrement,call)=>{
    node.data=call(node.data)
    if(node.oper!=null&&node.oper!='')
        return new Call(desugar_oper(node.oper,node.data),false)
    return node
}
const D_IfStatement:slang_desugar_visitor=(node:IfStatement,call)=>{
    node.condition=no_bool_cond(call(node.condition))
    node.commands=call(node.commands)
    node.else_=call(node.else_)
    return node
}
const D_SwitchStatement:slang_desugar_visitor=(node:SwitchStatement,call)=>{
    node.condition=call(node.condition)
    for(let i of node.case_list){
        i.condition=call(i.condition)
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
    node.condition=no_bool_cond(call(node.condition))
    node.commands=call(node.commands)
    return node
}
const D_ForStatement:slang_desugar_visitor=(node:ForStatement,call)=>{
    node.init=node.init.map(i=>call(i)) as VarDeclaration[]
    node.condition=call(node.condition)
    node.step=node.step.map(i=>call(i))
    node.commands=call(node.commands)
    return call(new ListCommand([
        ...node.init,
        new WhileStatement(node.condition,new ListCommand([node.commands,...node.step]))
    ]))
}
const D_ForeachStatement:slang_desugar_visitor=(node:ForeachStatement,call)=>{
    for(let i of node.unwrap)
        node.data=desugar_oper(i,node.data)
    return call(
        new ForStatement(
            [
                new VarDeclaration('for',new NumberType(),new NumberLiteral('0')),
                new VarDeclaration(node.iden,null,new NullLiteral(''))
            ],
            new InequalityExpression(new PostfixExpression(node.data,[new IndexPostfix(new IdentifierExpr('for'))]),
                new NullLiteral('')),
            [new Increment(new IdentifierExpr('for'))],
            new ListCommand([
                new AAssign(new IdentifierExpr(node.iden),new PostfixExpression(node.data,[new IndexPostfix(new IdentifierExpr('for'))])),
                node.commands
            ])
        )
    )
}
const D_TryStatement:slang_desugar_visitor=(node:TryStatement,call)=>{
    node.commands=call(node.commands)
    node.catch_.command=call(node.catch_.command)
    node.finally_=call(node.finally_)
    const _do=(command:Command)=>{
        if(command instanceof ListCommand){
            let index=0
            let _if=-1
            for(let i of command.commands){
                //之后的都要放进if
                if(i instanceof Throw)
                    _if=index
                index++
            }
            if(_if>-1){
                command.commands[_if+1]=new IfStatement(
                    new IdentifierExpr('throw'),
                    _do(new ListCommand([
                        new Assign(new IdentifierExpr('throw'),new BooleanLiteral('false')),
                        ...command.commands.slice(_if+1)
                    ])),
                    new ListCommand([])
                )
            }
        }
        return command
    }
    return call(new ListCommand([
        new VarDeclaration('throw',new BooleanType(),new BooleanLiteral('false')),
        new VarDeclaration('catch',new LambdaType(null,new Map([[node.catch_.iden,node.catch_.type]])
                ,new VoidType(),false),
            new LambdaExpression(null,new Map([[node.catch_.iden,node.catch_.type]]),new VoidType(),node.catch_.command)),
        new VarDeclaration('finally',new LambdaType(null,new Map(),new VoidType(),false),
            new LambdaExpression(null,new Map(),new VoidType(),node.finally_)),
        _do(node.commands)
    ]))
}
const D_ListCommand:slang_desugar_visitor=(node:ListCommand,call)=>{
    node.commands=node.commands.map(call)
    return node
}
export default new Map<any,slang_desugar_visitor>([
    [Assign,D_Assign],
    [VarDeclaration,D_VarDeclaration],
    [Call,D_CallOrReturn],
    [Return,D_CallOrReturn],
    [Throw,D_Throw],
    [Increment,D_IncrementOrDecrement],
    [Decrement,D_IncrementOrDecrement],
    [IfStatement,D_IfStatement],
    [SwitchStatement,D_SwitchStatement],
    [DoWhileStatement,D_DoWhileStatement],
    [WhileStatement,D_WhileStatement],
    [ForStatement,D_ForStatement],
    [ForeachStatement,D_ForeachStatement],
    [TryStatement,D_TryStatement],
    [ListCommand,D_ListCommand]
])