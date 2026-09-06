import {
    ArgumentsPostfix,
    ArrayExpression, BinaryExpression, BooleanType, Call,
    desugar_visitor,
    IndexPostfix, InequalityExpression, MemberPostfix, IdentifierExpr,
    LambdaExpression, LogicalAndExpression, LogicalOrExpression,
    MapExpression, NullLiteral,
    PostfixExpression, PrefixExpression, TernaryExpression, TypePrefix, type_name
} from '../utils'
const D_LambdaExpression:desugar_visitor=(node:LambdaExpression,call)=>{
    node.body=call(node.body)
    return node
}
const D_ArrayExpression:desugar_visitor=(node:ArrayExpression,call)=>{
    node.elements=node.elements.map(i=>call(i))
    return node
}
const D_MapExpression:desugar_visitor=(node:MapExpression,call)=>{
    node.elements=new Map(Array.from(node.elements.entries()).map(i=>[i[0],call(i[1])]))
    return node
}
const D_PostfixExpression:desugar_visitor=(node:PostfixExpression,call)=>{
    //函数重载:call_target 有两种——裸名(f2)改写 expr 标识符;成员(类.序号名)改写 MemberPostfix.name
    if(node.call_target){
        if(node.call_target.includes('.')){
            //成员重载:改写最后一个 MemberPostfix 的名字为目标序号名(f/f1)
            let seq=node.call_target.split('.')
            let want=seq[seq.length-1]
            let mb=node.postfix.find(p=>p instanceof MemberPostfix) as any
            if(mb)mb.name=want
        }else if(node.expr instanceof IdentifierExpr)
            node.expr=new IdentifierExpr(node.call_target)
    }
    //运算符重载:[] 索引读 / () 调用——整体表达式脱糖成容器静态函数调用。
    //a[i] → _value_<self类型>.[](a,i);a(b) → _value_<self类型>.()(a,b)
    if(node.oper=='[]'||node.oper=='()'){
        let self_type=(node.expr as any).type
        let cls='_value_'+type_name(self_type)
        let self=call(node.expr)
        let args=[self]
        for(let i of node.postfix){
            if(i instanceof IndexPostfix)args.push(call(i.index))
            else if(i instanceof ArgumentsPostfix)args.push(...i.args.map(x=>call(x)))
        }
        return new PostfixExpression(new IdentifierExpr(cls),
            [new MemberPostfix(node.oper),new ArgumentsPostfix([], args)])
    }
    node.expr=call(node.expr)
    for(let i of node.postfix){
        if(i instanceof IndexPostfix)
            i.index=call(i.index)
        else if(i instanceof ArgumentsPostfix)
            i.args=i.args.map(i=>call(i))
    }
    return node
}
const D_BinaryExpression:desugar_visitor=(node:BinaryExpression,call)=>{
    //运算符重载:check 决策命中后(写入 node.oper),把 a+b 脱糖成容器静态函数调用
    //a+b → _value_<类型名>.+(a,b);容器名由左操作数类型(check 已标 node.left.type)推导
    let left=node.oper?(node.left as any).type:null
    let cls=left?'_value_'+type_name(left):null
    let new_left=call(node.left)
    let new_right=call(node.right)
    if(node.oper){
        return new PostfixExpression(new IdentifierExpr(cls),
            [new MemberPostfix(node.oper),new ArgumentsPostfix([], [new_left,new_right])])
    }
    //缺括号:原写法 A||(B&&C&&D) 使 LogicalAndExpression 无条件包装(boolean 也被转 !=null),
    //与 LogicalOrExpression 只对非 boolean 包装的行为不对称
    if((node instanceof LogicalAndExpression||node instanceof LogicalOrExpression)&&
        !(node.right.type instanceof BooleanType)&&!(node.left.type instanceof BooleanType)){
        node.right=new InequalityExpression(node.right,new NullLiteral(''))
        node.left=new InequalityExpression(node.left,new NullLiteral(''))
        return node
    }
    node.left=new_left
    node.right=new_right
    return node
}
const D_PrefixExpression:desugar_visitor=(node:PrefixExpression,call)=>{
    //cast 强转:(T)x → _value_<源类型>.cast 函数调用(方法名=目标类型名,见 D_Cast)
    if(node.oper=='cast'){
        let src_type=(node.expr as any).type
        let cls='_value_'+type_name(src_type)
        let tp=node.prefix.find(p=>p instanceof TypePrefix) as any
        let target=tp?type_name(tp.type):''
        let src=call(node.expr)
        return new PostfixExpression(new IdentifierExpr(cls),
            [new MemberPostfix(target),new ArgumentsPostfix([], [src])])
    }
    //一元重载:!x / ~x / *x / &x / ++x / --x → _value_<self类型>.<符号>(x)
    if(node.oper){
        let self_type=(node.expr as any).type
        let cls='_value_'+type_name(self_type)
        let src=call(node.expr)
        return new PostfixExpression(new IdentifierExpr(cls),
            [new MemberPostfix(node.oper),new ArgumentsPostfix([], [src])])
    }
    node.expr=call(node.expr)
    return node
}
const D_TernaryExpression:desugar_visitor=(node:TernaryExpression,call)=>{
    node.condition=call(node.condition)
    node.trueExpr=call(node.trueExpr)
    node.falseExpr=call(node.falseExpr)
    return node
}
export default new Map<any,desugar_visitor>([
    [LambdaExpression,D_LambdaExpression],
    [ArrayExpression,D_ArrayExpression],
    [MapExpression,D_MapExpression],
    [PostfixExpression,D_PostfixExpression],
    [PrefixExpression,D_PrefixExpression],
    [BinaryExpression,D_BinaryExpression],
    [TernaryExpression,D_TernaryExpression]
])