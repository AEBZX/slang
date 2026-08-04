import {
    AdditiveExpression, Function,
    ArgumentsPostfix,
    ArrayExpression, ArrayFix,
    ast_type,
    ASTTree, BasicType, BinaryExpression, BitNotPrefix, BitwiseAndExpression, BitwiseOrExpression,
    BitwiseXorExpression, BlockType, BooleanLiteral, BooleanType,
    Checker as $,
    Class, ClassType, DecrementPostfix, DecrementPrefix, DivisionExpression, Enum,
    EnumType, EqualityExpression, Expression, FixType, GreaterEqualExpression, IdentifierExpr,
    IncrementPostfix, IncrementPrefix, IndexPostfix, InequalityExpression, Interface, LambdaType,
    LessEqualExpression, Literal, LogicalAndExpression, LogicalOrExpression, MapExpression,
    MapFix, MemberPostfix, MinusPrefix, ModExpression, Module, MultiplicativeExpression, NewPrefix, NotPrefix,
    NullLiteral,
    NumberLiteral, NumberType, PointFix, PostfixExpression, PrefixExpression, ReferencePrefix,
    Scope, ShiftLeftExpression, ShiftRightExpression, StringLiteral, StringType,
    SubtractiveExpression, TernaryExpression, Type,
    type_checker, type_merge,
    VoidType, Variable, AddressPrefix
} from '../utils'
import {GreaterExpression, LambdaExpression, LessExpression} from "../utils/model/expr";
import {number_radix} from "../utils/data";
//表达式检查
const S_Literal:type_checker=(ast:Literal,scope:Scope,call:(ast:ASTTree)=>Type)=>{
    if(ast instanceof NullLiteral)return new VoidType()
    if(ast instanceof NumberLiteral)return new NumberType()
    if(ast instanceof StringLiteral)return new StringType()
    if(ast instanceof BooleanLiteral)return new BooleanType()
}
const S_IdentifierExpression:type_checker=(ast:IdentifierExpr,scope:Scope,call:(ast:ASTTree)=>Type)=> {
    const data = scope.get_sym(scope.get(ast.name))
    if (!data) {
        scope.thr(`${ast.name} is not defined at line ${ast.line.join('\n')}`)
        return new VoidType()
    }
    return data
}
//求最小公共超类型，不存在则返回VoidType
const S_ArrayExpression:type_checker=(ast:ArrayExpression,scope:Scope,call:(ast:ASTTree)=>Type)=>{
    let element_type=ast.elements.map((element)=>call(element))
    let type:Type=element_type.length?element_type[0]:new VoidType()
    for(let i=1;i<element_type.length;i++)
        type=type_merge(type,element_type[i],scope)
    if(type instanceof FixType){
        type.fix.push(new ArrayFix())
        return type
    }
    return new FixType(type, [new ArrayFix()])
}
const S_MapExpression:type_checker=(ast:MapExpression,scope:Scope,call:(ast:ASTTree)=>Type)=>{
    let element_type=[]
    for(let [key,value] of ast.elements)
        element_type.push(call(value))
    let type:Type=element_type.length?element_type[0]:new VoidType()
    for(let i=1;i<element_type.length;i++)
        type=type_merge(type,element_type[i],scope)
    if(type instanceof FixType){
        type.fix.push(new MapFix())
        return type
    }
    return new FixType(type, [new MapFix()])
}
const S_LambdaExpression:type_checker=(ast:LambdaExpression,scope:Scope,call:(ast:ASTTree)=>Type)=>new LambdaType(ast.params,ast.ret)
const S_PostfixExpression:type_checker=(ast:PostfixExpression,scope:Scope,call:(ast:ASTTree)=>Type)=>{
    let type=call(ast.expr)
    label:
    for(let postfix of ast.postfix){
        if(postfix instanceof IncrementPostfix||postfix instanceof DecrementPostfix){
            if(!(type instanceof NumberType))scope.thr(`++/-- can only be applied to number at line ${ast.line.join('\n')}`)
            type=new NumberType()
        }
        if(postfix instanceof IndexPostfix){
            if(!(type instanceof FixType))scope.thr(`[] can only be applied to fix type at line ${ast.line.join('\n')}`)
            else{
                if(type.fix[type.fix.length-1] instanceof ArrayFix){
                    if(!(call(postfix.index) instanceof NumberType))
                        scope.thr(`[] can only be applied to number at line ${ast.line.join('\n')}`)
                    type=type.t
                    continue
                }
                if(type.fix[type.fix.length-1] instanceof MapFix){
                    if(!(call(postfix.index) instanceof StringType))
                        scope.thr(`[] can only be applied to string at line ${ast.line.join('\n')}`)
                    type= type.t
                    continue
                }
                scope.thr(`[] can only be applied to map or array at line ${ast.line.join('\n')}`)
            }
        }
        if(postfix instanceof ArgumentsPostfix){
            if(!(type instanceof LambdaType)){
                scope.thr(`() can only be applied to function at line ${ast.line.join('\n')}`)
                type=new VoidType()
            }else{
                //匹配形参实参检查类型,最小公共超类型必须是形参
                if(postfix.args.length!=type.params.size)
                    scope.thr(`function parameter count mismatch at line ${ast.line.join('\n')}`)
                let iden=[]
                type.params.forEach((value,key)=>{iden.push(value)})
                for(let i=0;i<postfix.args.length;i++)
                    if(type_merge(iden[i],call(postfix.args[i]),scope)!=iden[i])
                        scope.thr(`function parameter type mismatch at line ${ast.line.join('\n')}`)
                type=type.returnType
            }
        }
        if(postfix instanceof MemberPostfix){
            //情况1:Class Member
            if(type instanceof ClassType){
                let class_=scope.get(type.local.join('.'))
                if(class_ instanceof Class)
                    for(let i of class_.children)
                        if(i.name==postfix.name) {
                            type = scope.get_sym(i)
                            continue label
                        }
                scope.thr(`${postfix.name} is not defined at line ${ast.line.join('\n')}`)
            }
            //情况2:Block Member
            if(type instanceof BlockType){
                let block=scope.get(type.local.join('.'))
                //情况1:Enum
                if(block instanceof Enum){
                    for(let i of block.children)
                        if(i==postfix.name) {
                            type = new EnumType(type.local, i)
                            continue label
                        }
                    scope.thr(`${postfix.name} is not defined at line ${ast.line.join('\n')}`)
                }
                //情况2:就是简单的类
                type=scope.get_sym(scope.get([...type.local,postfix.name].join('.')))
            }
        }
    }
    return type
}
const S_PrefixExpression:type_checker=(ast:PrefixExpression,scope:Scope,call:(ast:ASTTree)=>Type)=>{
    let type=call(ast.expr)
    let index=0
    for(let prefix of ast.prefix){
        if(prefix instanceof IncrementPrefix||prefix instanceof DecrementPrefix){
            if(!(type instanceof NumberType))scope.thr(`++/-- can only be applied to number at line ${ast.line.join('\n')}`)
            type=new NumberType()
        }
        if(prefix instanceof MinusPrefix){
            if(!(type instanceof NumberType))scope.thr(`- can only be applied to number at line ${ast.line.join('\n')}`)
            type=new NumberType()
        }
        //逻辑运算符可以当作!a=!(a!=null),不检查
        if(prefix instanceof NotPrefix)
            type=new BooleanType()
        if(prefix instanceof BitNotPrefix){
            if(!(type instanceof BooleanType||type instanceof NumberType))
                scope.thr(`~ can only be applied to boolean at line ${ast.line.join('\n')}`)
            type=(type instanceof BooleanType||type instanceof NumberType)?type:new NumberType()
        }
        //&操作不检查
        if(prefix instanceof AddressPrefix){
            if(type instanceof FixType)
                type.fix.push(new PointFix())
            else type=new FixType(type, [new PointFix()])
        }
        if(prefix instanceof ReferencePrefix){
            if(!(type instanceof BasicType))
                scope.thr(`& can only be applied to basic type at line ${ast.line.join('\n')}`)
            if(type instanceof FixType) {
                if (!(type.fix[type.fix.length - 1] instanceof PointFix))
                    scope.thr(`& can only be applied to point type at line ${ast.line.join('\n')}`)
                type.fix.pop()
            }
        }
        //必须是函数调用
        if(prefix instanceof NewPrefix){
            //绝对是第一个
            if(index!=0)
                scope.thr(`new can only be applied to first at line ${ast.line.join('\n')}`)
            //检查ast.expr是不是postfix
            if(ast.expr instanceof PostfixExpression){
                //最外围一定是函数调用
                if(ast.expr.postfix[ast.expr.postfix.length-1] instanceof ArgumentsPostfix){
                    let fix=ast.expr.postfix[ast.expr.postfix.length-1] as ArgumentsPostfix
                    ast.expr.postfix.pop()
                    let _type=call(ast.expr)
                    let iden_param=[]
                    let real_param=[]
                    for(let v of fix.args)
                        real_param.push(call(v))
                    if(_type instanceof BlockType){
                        let block=scope.get(_type.local.join('.'))
                        if(!(block instanceof Class)) {
                            scope.thr(`new can only be applied to class at line ${ast.line.join('\n')}`)
                            type = new VoidType()
                            continue
                        }
                        //寻找构造函数
                        for(let i of block.children){
                            if(i.name=='constructor'){
                                if(call(i) instanceof LambdaType) {
                                    iden_param = [...(call(i) as LambdaType).params.values()]
                                    break
                                }
                                scope.thr(`new can only be applied to class at line ${ast.line.join('\n')}`)
                            }
                        }
                        type=new ClassType(_type.local)
                    }
                    //参数是否对应
                    if(iden_param.length!=real_param.length)
                        scope.thr(`new can only be applied to class at line ${ast.line.join('\n')}`)
                    for(let i=0;i<iden_param.length;i++)
                        if(type_merge(iden_param[i],real_param[i],scope)!=iden_param[i])
                            scope.thr(`new can only be applied to class at line ${ast.line.join('\n')}`)
                }
            }
        }
        index++
    }
    return type
}
const S_BinaryExpression:type_checker=(ast:BinaryExpression,scope:Scope,call:(ast:ASTTree)=>Type)=>{
    let left=call(ast.left)
    let right=call(ast.right)
    //逻辑与/或:操作数类型不限,返回合并类型
    if(ast instanceof LogicalAndExpression||ast instanceof LogicalOrExpression)
        return type_merge(left,right,scope)||new VoidType()
    //算术、位运算、位移:操作数为 number,返回 number
    if(ast instanceof AdditiveExpression||ast instanceof SubtractiveExpression||
       ast instanceof MultiplicativeExpression||ast instanceof DivisionExpression||
       ast instanceof ModExpression||ast instanceof ShiftLeftExpression||
       ast instanceof ShiftRightExpression||ast instanceof BitwiseAndExpression||
       ast instanceof BitwiseOrExpression||ast instanceof BitwiseXorExpression){
        if(!(left instanceof NumberType))scope.thr(`left operand is not number at line ${ast.line.join('\n')}`)
        if(!(right instanceof NumberType))scope.thr(`right operand is not number at line ${ast.line.join('\n')}`)
        return new NumberType()
    }
    //关系比较:操作数为 number,返回 boolean
    if(ast instanceof GreaterExpression||ast instanceof LessExpression||
       ast instanceof GreaterEqualExpression||ast instanceof LessEqualExpression){
        if(!(left instanceof NumberType))scope.thr(`left operand is not number at line ${ast.line.join('\n')}`)
        if(!(right instanceof NumberType))scope.thr(`right operand is not number at line ${ast.line.join('\n')}`)
        return new BooleanType()
    }
    //相等比较:两边类型需兼容,返回 boolean
    if(ast instanceof EqualityExpression||ast instanceof InequalityExpression){
        if(type_merge(left,right,scope) instanceof VoidType)
            scope.thr(`type mismatch at line ${ast.line.join('\n')}`)
        return new BooleanType()
    }
    return new VoidType()
}
const S_TernaryExpression:type_checker=(ast:TernaryExpression,scope:Scope,call:(ast:ASTTree)=>Type)=>{
    let condition=call(ast.condition)
    let true_value=call(ast.trueExpr)
    let false_value=call(ast.falseExpr)
    if(!(condition instanceof BooleanType))
        scope.thr(`condition is not boolean at line ${ast.line.join('\n')}`)
    return type_merge(true_value,false_value,scope)
}
const S_Block:type_checker=(ast:Class|Module|Interface|Enum,scope:Scope,call:(ast:ASTTree)=>Type)=>{
    let name=''
    for(let [k,v] of scope.global.data)
        if(v==ast)
            name=k
    return new BlockType(name.split('.'))
}
const S_Variable:type_checker=(ast:Variable,scope:Scope,call:(ast:ASTTree)=>Type)=>ast.t
const S_Function:type_checker=(ast:Function,scope:Scope,call:(ast:ASTTree)=>Type)=>new LambdaType(ast.params,ast.return_type)
export default new Map<any,type_checker>([
    [Literal,S_Literal],
    [IdentifierExpr,S_IdentifierExpression],
    [PrefixExpression,S_PrefixExpression],
    [PostfixExpression,S_PostfixExpression],
    [BinaryExpression,S_BinaryExpression],
    [TernaryExpression,S_TernaryExpression],
    [ArrayExpression,S_ArrayExpression],
    [MapExpression,S_MapExpression],
    [LambdaExpression,S_LambdaExpression],
    [Class,S_Block],
    [Module,S_Block],
    [Interface,S_Block],
    [Enum,S_Block],
    [Variable,S_Variable],
    [Function,S_Function]
])