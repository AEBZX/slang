import {
    AAssign,
    AddAssign,
    AdditiveExpression, ArgumentsPostfix,
    Assign, BitAndAssign, BitOrAssign, BitShlAssign, BitShrAssign, BitwiseAndExpression, BitwiseOrExpression,
    BitwiseXorExpression, BitXorAssign, BooleanLiteral, BooleanType, Break, Call, Decrement,
    desugar_visitor, DivAssign, DivisionExpression, DoWhileStatement, EqualityExpression, Expression,
    FixType, ForeachStatement, ForStatement, IdentifierExpr, IfStatement,
    Increment,
    IndexPostfix, InequalityExpression,
    LambdaExpression, LambdaType, ListCommand, MemberPostfix, ModAssign, ModExpression, MulAssign, MultiplicativeExpression,
    NullLiteral, NumberLiteral, NumberType, PostfixExpression, Return,
    ShiftLeftExpression, ShiftRightExpression,
    SubAssign,
    SubtractiveExpression, SwitchStatement, Throw, TryStatement, VarDeclaration, VoidType, WhileStatement
} from '../utils'
const D_Assign:desugar_visitor=(node:Assign,call)=>{
    node.data=call(node.data)
    node.value=call(node.value)
    if(node instanceof AAssign)return node
    if(node instanceof AddAssign)return new AAssign(node.data,new AdditiveExpression(node.data,node.value))
    if(node instanceof SubAssign)return new AAssign(node.data,new SubtractiveExpression(node.data,node.value))
    if(node instanceof DivAssign)return new AAssign(node.data,new DivisionExpression(node.data,node.value))
    if(node instanceof MulAssign)return new AAssign(node.data,new MultiplicativeExpression(node.data,node.value))
    if(node instanceof ModAssign)return new AAssign(node.data,new ModExpression(node.data,node.value))
    if(node instanceof BitAndAssign)return new AAssign(node.data,new BitwiseAndExpression(node.data,node.value))
    if(node instanceof BitOrAssign)return new AAssign(node.data,new BitwiseOrExpression(node.data,node.value))
    if(node instanceof BitXorAssign)return new AAssign(node.data,new BitwiseXorExpression(node.data,node.value))
    if(node instanceof BitShlAssign)return new AAssign(node.data,new ShiftLeftExpression(node.data,node.value))
    if(node instanceof BitShrAssign)return new AAssign(node.data,new ShiftRightExpression(node.data,node.value))
}
const D_VarDeclaration:desugar_visitor=(node:VarDeclaration,call)=>{
    node.value=node.value==null?new NullLiteral(''):call(node.value)
    return node
}
const D_Call:desugar_visitor=(node:Call,call)=>{
    node.data=call(node.data)
    //ClassType.call(args)转换为call(ClassType,args),ClassType作为第一个参数
    if(node.data instanceof PostfixExpression){
        let postfix=node.data.postfix
        let member=postfix.find(i=>i instanceof MemberPostfix&&i.name=='call')
        if(member){
            let index=postfix.indexOf(member)
            if(postfix[index+1] instanceof ArgumentsPostfix){
                let args=(postfix[index+1] as ArgumentsPostfix).args
                node.data=new PostfixExpression(
                    new IdentifierExpr('call'),
                    [new ArgumentsPostfix([node.data.expr,...args])])
            }
        }
    }
    return node
}
const D_Return:desugar_visitor=(node:Return,call)=>{
    node.data=node.data==null?new NullLiteral(''):call(node.data)
    return node
}
const D_Throw:desugar_visitor=(node:Throw,call)=>{
    node.data=call(node.data)
    return new ListCommand([
        new Call(new PostfixExpression(new IdentifierExpr('throw'),[new ArgumentsPostfix([node.data])])
            ,false),
        //break强制跳出当前作用域,仅供编译器优化使用
        new Break()
    ])
}
const D_Increment:desugar_visitor=(node:Increment,call)=>{
    node.data=new AdditiveExpression(call(node.data),new NumberLiteral('1'))
    return node
}
const D_Decrement:desugar_visitor=(node:Decrement,call)=>{
    node.data=new SubtractiveExpression(call(node.data),new NumberLiteral('1'))
    return node
}
const D_IfStatement:desugar_visitor=(node:IfStatement,call)=>{
    call(node.condition)
    if(!(node.condition.type instanceof BooleanType))
        node.condition=new InequalityExpression(node.condition,new NullLiteral(''))
    node.commands=call(node.commands)
    node.else_=node.else_==null?new ListCommand([]):call(node.else_)
    return node
}
const D_WhileStatement:desugar_visitor=(node:WhileStatement,call)=>{
    node.condition=call(node.condition)
    if(!(node.condition.type instanceof BooleanType))
        node.condition=new InequalityExpression(node.condition,new NullLiteral(''))
    return node
}
const D_DoWhileStatement:desugar_visitor=(node:DoWhileStatement,call)=>
    call(new ListCommand([
        node.commands,
        new WhileStatement(node.condition,node.commands)
    ]))
const D_ForStatement:desugar_visitor=(node:ForStatement,call)=>call(new ListCommand([
    ...node.init,
    call(new WhileStatement(
        node.condition,
        new ListCommand([
            node.commands,
            ...node.step
        ])
    ))
]))
const D_ForeachStatement:desugar_visitor=(node:ForeachStatement,call)=>{
    let type=node.data.type as FixType
    type.fix.pop()
    type=new FixType(type.t,type.fix)
    return new ListCommand([
        new VarDeclaration(node.iden,type,node.data),
        new ForStatement(
            [new VarDeclaration('foreach',new NumberType(),new NumberLiteral('0'))],
            new InequalityExpression(new PostfixExpression(node.data,[new IndexPostfix(new IdentifierExpr('foreach'))]),
                new NullLiteral('')),
            [new Increment(new IdentifierExpr('foreach'))],
            new ListCommand([
                new Assign(new IdentifierExpr(node.iden),
                    new PostfixExpression(node.data,[new IndexPostfix(new IdentifierExpr('foreach'))])),
                node.commands
            ]))
    ])
}
const D_SwitchStatement:desugar_visitor=(node:SwitchStatement,call)=>{
    let g=(index:number)=>{
        if(node.case_list.length<=index)
            return node.default_==null?new ListCommand([]):call(node.default_)
        return call(new IfStatement(
            new EqualityExpression(node.case_list[index].condition,node.condition),
            node.case_list[index].commands,
            g(index+1)
        ))
    }
    return g(0)
}
const D_TryStatement:desugar_visitor=(node:TryStatement,call)=>{
    let _lambda=new LambdaExpression(new Map([
        [node.catch_.iden,node.catch_.type]
    ]),new VoidType(),new ListCommand([node.catch_.command,node.finally_==null?new ListCommand([]):call(node.finally_)]))
    return call(new ListCommand([
        new VarDeclaration('catch',new LambdaType(new Map([[node.catch_.iden,node.catch_.type]]),new VoidType(),false)
            ,_lambda),
        node.commands,
        node.finally_==null?new ListCommand([]):call(node.finally_)
    ]))
}
const D_ListCommand:desugar_visitor=(node:ListCommand,call)=>new ListCommand(node.commands.map(i=>call(i)))
export default new Map<any,desugar_visitor>([
    [VarDeclaration,D_VarDeclaration],
    [Call,D_Call],
    [Return,D_Return],
    [Throw,D_Throw],
    [Assign,D_Assign],
    [Increment,D_Increment],
    [Decrement,D_Decrement],
    [IfStatement,D_IfStatement],
    [WhileStatement,D_WhileStatement],
    [DoWhileStatement,D_DoWhileStatement],
    [ForStatement,D_ForStatement],
    [ForeachStatement,D_ForeachStatement],
    [SwitchStatement,D_SwitchStatement],
    [TryStatement,D_TryStatement],
    [ListCommand,D_ListCommand]
])