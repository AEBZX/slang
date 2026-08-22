import {
    AAssign,
    AddAssign,
    AdditiveExpression, ArgumentsPostfix,
    Assign, BitAndAssign, BitOrAssign, BitShlAssign, BitShrAssign, BitwiseAndExpression, BitwiseOrExpression,
    BitwiseXorExpression, BitXorAssign, BooleanLiteral, BooleanType, Break, Call, Case,
    Continue, Decrement,
    desugar_visitor, DivAssign, DivisionExpression, DoWhileStatement, EqualityExpression, Expression,
    FixType, ForeachStatement, ForStatement, IdentifierExpr, IfStatement,
    Increment,
    IndexPostfix, InequalityExpression,
    LambdaExpression, LambdaType, ListCommand, MemberPostfix, ModAssign, ModExpression, MulAssign, MultiplicativeExpression,
    NullLiteral, NumberLiteral, NumberType, PostfixExpression, Return,
    ShiftLeftExpression, ShiftRightExpression, StringType,
    SubAssign,
    SubtractiveExpression, SwitchStatement, Throw, TryStatement, VarDeclaration, VoidType, WhileStatement,Command
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
    //纯 Assign(=)必须返回节点:此前无 return 返回 undefined,foreach 的 v=arr[foreach]、for 的 step 赋值
    //全部变 undefined 被丢弃(循环体只剩 sum+=v,索引不递增死循环)
    return node
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
    //Increment 命令无 HIR 节点,转成赋值否则整条语句丢失
    //(此前只改 node.data 仍返回 Increment,foreach++/i++ 语句被忽略,索引不递增死循环)
    return call(new Assign(node.data, new AdditiveExpression(call(node.data), new NumberLiteral('1'))))
}
const D_Decrement:desugar_visitor=(node:Decrement,call)=>{
    return call(new Assign(node.data, new SubtractiveExpression(call(node.data), new NumberLiteral('1'))))
}
const D_IfStatement:desugar_visitor=(node:IfStatement,call)=>{
    call(node.condition)
    //比较表达式(==/!=)结果即 boolean,不包装!=null;desugar 新建的节点(如 switch case 比较)
    //无 type 标注,此前被误判为非 boolean 包成 (case==x)!=null,优化器折叠后控制流错乱
    if(!(node.condition.type instanceof BooleanType) &&
       !(node.condition instanceof EqualityExpression) &&
       !(node.condition instanceof InequalityExpression))
        node.condition=new InequalityExpression(node.condition,new NullLiteral(''))
    node.commands=call(node.commands)
    node.else_=node.else_==null?new ListCommand([]):call(node.else_)
    return node
}
const D_WhileStatement:desugar_visitor=(node:WhileStatement,call)=>{
    node.condition=call(node.condition)
    //必须 call commands:此前漏掉,循环体内的语句(如 for 的 step Increment)未 desugar,
    //Increment 保持原样被 HIR 忽略,foreach++ 丢失索引不递增死循环
    node.commands=call(node.commands)
    if(!(node.condition.type instanceof BooleanType) &&
       !(node.condition instanceof EqualityExpression) &&
       !(node.condition instanceof InequalityExpression))
        node.condition=new InequalityExpression(node.condition,new NullLiteral(''))
    return node
}
const D_DoWhileStatement:desugar_visitor=(node:DoWhileStatement,call)=>
    call(new ListCommand([
        node.commands,
        new WhileStatement(node.condition,node.commands)
    ]))
const D_ForStatement:desugar_visitor=(node:ForStatement,call)=>{
    let rewrite=(cmd:Command):Command=>{
        if(cmd instanceof Continue)
            return new ListCommand([...node.step, cmd])
        if(cmd instanceof ListCommand)
            return new ListCommand(cmd.commands.map(rewrite))
        if(cmd instanceof IfStatement)
            return new IfStatement(cmd.condition, rewrite(cmd.commands),
                cmd.else_?rewrite(cmd.else_):cmd.else_)
        if(cmd instanceof SwitchStatement)
            return new SwitchStatement(cmd.condition,
                cmd.case_list.map(c=>new Case(c.condition,rewrite(c.commands))),
                cmd.default_?rewrite(cmd.default_):cmd.default_)
        return cmd
    }
    return call(new ListCommand([
        ...node.init,
        call(new WhileStatement(
            node.condition,
            new ListCommand([rewrite(node.commands), ...node.step])
        ))
    ]))
}
const D_ForeachStatement:desugar_visitor=(node:ForeachStatement,call)=>{
    //字符串遍历:元素为字符;字符串是 StringType 而非 FixType
    if(node.data.type instanceof StringType)
        return call(new ListCommand([
            new VarDeclaration(node.iden,new StringType(),node.data),
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
        ]))
    let type=node.data.type as FixType
    type.fix.pop()
    type=new FixType(type.t,type.fix)
    //必须 call:desugar 的 visitor 对返回值不再遍历,此前返回裸 ListCommand 内 ForStatement 未 desugar,
    //HIR 无 H_For 直接忽略,foreach 循环整体丢失(IR 只有块0)
    return call(new ListCommand([
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
    ]))
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