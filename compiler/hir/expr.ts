import {
    AdditiveExpression,
    AddressPrefix,
    ArgumentsPostfix,
    ArrayExpression, BinaryExpression, BlockType, BitNotPrefix, BitwiseAndExpression, BitwiseOrExpression, BitwiseXorExpression,
    BooleanLiteral, DecrementPostfix, DecrementPrefix, DivisionExpression, EqualityExpression, GreaterEqualExpression,
    GreaterExpression, HAddressExpr, HArgumentsExpr, HArrayExpr,
    HBinaryExpr, HBitNotExpr,
    HBooleanLiteral, HExpr, HIdentifierExpr, HIndexExpr,
    hir_visitor, HLambdaExpr, HMapExpr, HMemberExpr, HMinusExpr, HNotExpr, HNullLiteral,
    HNumberLiteral, HPostDecrementExpr, HPostIncrementExpr, HPreDecrementExpr, HPreIncrementExpr, HReferenceExpr,
    HStringLiteral, HTernaryExpr, ClassType, IdentifierExpr, HNewExpr,
    IncrementPostfix, IncrementPrefix, IndexPostfix,
    InequalityExpression, LambdaExpression,
    LessEqualExpression, LessExpression,
    LogicalAndExpression, LogicalOrExpression, MapExpression, MemberPostfix, MinusPrefix,
    ModExpression, MultiplicativeExpression,
    NewPrefix,
    NotPrefix, NullLiteral,
    NumberLiteral,
    Postfix, PostfixExpression, PrefixExpression, ReferencePrefix, ShiftLeftExpression, ShiftRightExpression,
    StringLiteral, StringType, SubtractiveExpression, TernaryExpression, HScope
} from '../utils'
const H_NumberLiteral:hir_visitor=(node:NumberLiteral,scope,call)=>new HNumberLiteral(parseFloat(node.value))
const H_StringLiteral:hir_visitor=(node:StringLiteral,scope,call)=>new HStringLiteral(node.value)
const H_BooleanLiteral:hir_visitor=(node:BooleanLiteral,scope,call)=>new HBooleanLiteral(node.value=='true')
const H_NullLiteral:hir_visitor=(node:NullLiteral,scope,call)=>new HNullLiteral()
const H_IdentifierExpr:hir_visitor=(node:IdentifierExpr,scope,call)=>{
    let name=scope.get(node.name)
    //link别名走lnk表,普通变量无lnk则保留自身id
    let linked=name!=null?scope.lnk_get(name):null
    if(linked!=null)name=linked
    return new HIdentifierExpr(name)
}
const H_ArrayExpr:hir_visitor=(node:ArrayExpression,scope,call)=>new HArrayExpr(node.elements.map(i=>call(i,scope)))
const H_MapExpr:hir_visitor=(node:MapExpression,scope,call)=>new HMapExpr(new Map(Array.from(node.elements.entries()).map(i=>[i[0],call(i[1],scope)])))
const H_LambdaExpr:hir_visitor=(node:LambdaExpression,scope,call)=>{
    scope=scope.enter()
    let params=Array.from(node.params.entries()).map(i=>{
        //this参数复用类作用域已分配的this_id,保持成员内this与类实例一致
        let id=i[0]=='this'&&scope.get('this')!=null?scope.get('this'):scope.id()
        scope.set(i[0],id)
        return id
    })
    let cmd=call(node.body,scope)
    scope=scope.leave()
    return new HLambdaExpr(params,cmd)
}
const H_PostfixExpr:hir_visitor=(node:PostfixExpression,scope,call)=>{
    let _primary=node.expr
    //如果primary是identifier,那么尽量的匹配足够多的Member作为一整个Identifier
    //实例成员(x.f)不折叠,保留Member走成员访问;模块路径(A.B)折叠
    if(_primary instanceof IdentifierExpr){
        //link 别名(如 io→std.io):折叠前先换成目标路径,否则 io.print 折叠成
        //"io.print" 在 HIR 全局无此名,生成的指令操作数为 null,VM 卡死
        //link_target 在文件子 scope 中注册,但 PostfixExpr 在函数体子 scope 中运行,
        //需沿 parent 链向上查找
        let find_link_target=(name:string,s:HScope):string|null=>{
            while(s){
                if(s.link_target.has(name))return s.link_target.get(name)
                s=s.parent
            }
            return null
        }
        let target=find_link_target(_primary.name,scope)
        if(target!=null)
            _primary=new IdentifierExpr(target)
        let _type=_primary.type
        let is_instance=_type instanceof ClassType
        let g=(a:IdentifierExpr,fix:Postfix):IdentifierExpr=>{
            if(fix instanceof MemberPostfix)
                return new IdentifierExpr(a.name+'.'+fix.name)
            return a
        }
        let delete_index:number=0
        for(let i=0;i<node.postfix.length&&!is_instance;i++)
            if(g(<IdentifierExpr>_primary,node.postfix[i])!=_primary){
                _primary=g(<IdentifierExpr>_primary,node.postfix[i])
                delete_index=i+1
            }else
                break
        //去掉已折叠的Member,保留Arguments/Index等
        node.postfix=node.postfix.slice(delete_index)
    }
    let primary=call(_primary,scope)
    for(let i of node.postfix){
        if(i instanceof IndexPostfix)
            //字符串索引标记:primary 类型为 StringType 时走独立 str_get(见 HIndexExpr 注释)
            primary=new HIndexExpr(primary,call(i.index,scope),_primary.type instanceof StringType)
        if(i instanceof ArgumentsPostfix)
            primary=new HArgumentsExpr(primary,i.args.map(i=>call(i,scope)))
        if(i instanceof MemberPostfix){
            //实例成员:通过primary的类型解析成员id
            let member_id=scope.get(i.name)
            if(_primary instanceof IdentifierExpr&&_primary.type instanceof ClassType)
                member_id=scope.get((_primary.type as ClassType).local.join('.')+'.'+i.name)
            //new Item(5).v:ArgumentsPostfix 后跟 MemberPostfix,primary 是 HArgumentsExpr
            //此时 _primary 是类名(BlockType),成员应解析为类成员槽而非局部变量
            if(primary instanceof HArgumentsExpr&&_primary instanceof IdentifierExpr&&_primary.type instanceof BlockType){
                let cls=(_primary.type as BlockType).local.join('.')
                member_id=scope.get(cls+'.'+i.name)
            }
            primary=new HMemberExpr(primary,new HIdentifierExpr(member_id))
        }
        if(i instanceof IncrementPostfix)
            primary=new HPostIncrementExpr(primary)
        if(i instanceof DecrementPostfix)
            primary=new HPostDecrementExpr(primary)
    }
    return primary
}
const H_PrefixExpr:hir_visitor=(node:PrefixExpression,scope,call)=>{
    let primary=call(node.expr,scope)
    for(let i of node.prefix){
        if(i instanceof IncrementPrefix)
            primary=new HPreIncrementExpr(primary)
        if(i instanceof DecrementPrefix)
            primary=new HPreDecrementExpr(primary)
        if(i instanceof NotPrefix)
            primary=new HNotExpr(primary)
        if(i instanceof BitNotPrefix)
            primary=new HBitNotExpr(primary)
        if(i instanceof MinusPrefix)
            primary=new HMinusExpr(primary)
        if(i instanceof ReferencePrefix)
            primary=new HReferenceExpr(primary)
        if(i instanceof AddressPrefix)
            primary=new HAddressExpr(primary)
        //new:包装调用为 HNewExpr(对象分配+this传递),此前被忽略导致无对象
        //new Item(5).v:primary=HMemberExpr(HArgumentsExpr,'Item.v') → 拆掉成员层,new 只包构造
        //new A().make():primary=HArgumentsExpr(HMemberExpr(HArgumentsExpr,'A.make'),[]) →
        //外层 ArgumentsPostfix 是方法调用,new 只包内层构造,再重建方法调用链
        if(i instanceof NewPrefix){
            if(primary instanceof HArgumentsExpr&&primary.target instanceof HMemberExpr&&primary.target.target instanceof HArgumentsExpr)
                primary=new HArgumentsExpr(
                    new HMemberExpr(
                        new HNewExpr(primary.target.target.target,primary.target.target.args),
                        primary.target.member),
                    primary.args)
            else if(primary instanceof HArgumentsExpr)
                primary=new HNewExpr(primary.target,primary.args)
            else if(primary instanceof HMemberExpr&&primary.target instanceof HArgumentsExpr)
                primary=new HMemberExpr(new HNewExpr(primary.target.target,primary.target.args),primary.member)
            else
                primary=new HNewExpr(primary,[])
        }
    }
    return primary
}
const H_BinaryExpr:hir_visitor=(node:BinaryExpression,scope,call)=>{
    switch (node.constructor) {
        case AdditiveExpression:
            return new HBinaryExpr(call(node.left,scope),'+',call(node.right,scope))
        case SubtractiveExpression:
            return new HBinaryExpr(call(node.left,scope),'-',call(node.right,scope))
        case MultiplicativeExpression:
            return new HBinaryExpr(call(node.left,scope),'*',call(node.right,scope))
        case ModExpression:
            return new HBinaryExpr(call(node.left,scope),'%',call(node.right,scope))
        case DivisionExpression:
            return new HBinaryExpr(call(node.left,scope),'/',call(node.right,scope))
        case ShiftLeftExpression:
            return new HBinaryExpr(call(node.left,scope),'<<',call(node.right,scope))
        case ShiftRightExpression:
            return new HBinaryExpr(call(node.left,scope),'>>',call(node.right,scope))
        case GreaterExpression:
            return new HBinaryExpr(call(node.left,scope),'>',call(node.right,scope))
        case LessExpression:
            return new HBinaryExpr(call(node.left,scope),'<',call(node.right,scope))
        case GreaterEqualExpression:
            return new HBinaryExpr(call(node.left,scope),'>=',call(node.right,scope))
        case LessEqualExpression:
            return new HBinaryExpr(call(node.left,scope),'<=',call(node.right,scope))
        case EqualityExpression:
            return new HBinaryExpr(call(node.left,scope),'==',call(node.right,scope))
        case InequalityExpression:
            return new HBinaryExpr(call(node.left,scope),'!=',call(node.right,scope))
        case BitwiseAndExpression:
            return new HBinaryExpr(call(node.left,scope),'&',call(node.right,scope))
        case BitwiseOrExpression:
            return new HBinaryExpr(call(node.left,scope),'|',call(node.right,scope))
        case BitwiseXorExpression:
            return new HBinaryExpr(call(node.left,scope),'^',call(node.right,scope))
        case LogicalOrExpression:
            return new HBinaryExpr(call(node.left,scope),'||',call(node.right,scope))
        case LogicalAndExpression:
            return new HBinaryExpr(call(node.left,scope),'&&',call(node.right,scope))
    }
}
const H_TernaryExpr:hir_visitor=(node:TernaryExpression,scope,call)=>{
    return new HTernaryExpr(call(node.condition,scope),call(node.trueExpr,scope),call(node.falseExpr,scope))
}
export default new Map<any,hir_visitor>([
    [NullLiteral,H_NullLiteral],
    [IdentifierExpr,H_IdentifierExpr],
    [ArrayExpression,H_ArrayExpr],
    [MapExpression,H_MapExpr],
    [LambdaExpression,H_LambdaExpr],
    [PostfixExpression,H_PostfixExpr],
    [PrefixExpression,H_PrefixExpr],
    [BinaryExpression,H_BinaryExpr],
    [TernaryExpression,H_TernaryExpr],
    [StringLiteral,H_StringLiteral],
    [NumberLiteral,H_NumberLiteral],
    [BooleanLiteral,H_BooleanLiteral]
])