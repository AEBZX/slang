import {de_cond, de_operation, slang_desugar_visitor} from './tool'
import {
    AAssign,
    Assign,
    Expression,
    Await,
    IdentifierExpr,
    ReferencePrefix,
    ReferenceType,
    VarDecl, VM,
    Command, Return, ExprCommand, Throw, Continue, GotoCommand, Break, IfStatement, WhileStatement, DoWhileStatement,
    ListCommand, LabelCommand, ForStatement, ForeachStatement, NumberType, NumberLiteral, InequalExpression,
    IndexPostfix, NullLiteral, IncrementPostfix, IncrementPrefix, SwitchStatement
} from '../utils'
const D_Assign:slang_desugar_visitor=(node:Assign,call)=>{
    node.data=call(node.data) as Expression
    node.value=call(node.value) as Expression
    if(node.oper!=null)return de_operation(node.oper,node.data,node.value)
    //左边不是引用类型,右边是(被脱糖成指针),加解引用
    if(!(node.data.type instanceof ReferenceType)&&node.value.type instanceof ReferenceType){
        node.value.type=node.value.type.t
        node.value=new ReferencePrefix(node.value)
    }
    return node
}
const D_VarDecl:slang_desugar_visitor=(node:VarDecl,call)=>{
    node.value=call(node.value) as Expression
    //左边不是引用类型,右边是(被脱糖成指针),加解引用
    if(!(node.t instanceof ReferenceType)&&node.value.type instanceof ReferenceType){
        node.value.type=node.value.type.t
        node.value=new ReferencePrefix(node.value)
    }
    //如果是a:T&=b,那么按照语义b已经被脱糖成&b,不用管
    return new AAssign(new IdentifierExpr(node.name),node.value)
}
const D_Await:slang_desugar_visitor=(node:Await,call)=>{
    node.command=call(node.command) as Command
    return node
}
const D_Return:slang_desugar_visitor=(node:Return,call)=>{
    node.data=call(node.data) as Expression
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
    return new GotoCommand('while')
}
const D_Break:slang_desugar_visitor=(node:Break,call)=>{
    return new GotoCommand('break')
}
const D_VM:slang_desugar_visitor=(node:VM,call)=>{
    node.param=node.param.map(call) as Expression[]
    return node
}
const D_If:slang_desugar_visitor=(node:IfStatement,call)=>{
    node.condition=call(de_cond(node.condition)) as Expression
    node.commands=call(node.commands) as Command
    node.else_=call(node.else_) as Command
    return node
}
const D_While:slang_desugar_visitor=(node:WhileStatement,call)=>{
    return new ListCommand([
        new LabelCommand('while'),
        node.commands,
        new IfStatement(node.condition,new GotoCommand('while'),null),
        new LabelCommand('break')
    ])
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
    let ret:IfStatement=null
    let ls:IfStatement=null
    for(const i of node.case_list){
        if(ret==null){
            ret=new IfStatement(i.condition,i.commands,null)
            ls=ret.else_ as IfStatement
            continue
        }
        ls.else_=new IfStatement(i.condition,i.commands,null)
        ls=ls.else_ as IfStatement
    }
    ls.else_=node.default_
    return call(ret)
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
    [IfStatement,D_If],
    [WhileStatement,D_While],
    [DoWhileStatement,D_DoWhile],
    [ForStatement,D_For],
    [ForeachStatement,D_Foreach],
    [SwitchStatement,D_Switch],
    [ListCommand,D_ListCommand]
])