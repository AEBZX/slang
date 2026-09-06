import {
    AdditiveExpression, Function,
    ArgumentsPostfix,
    ArrayExpression, ArrayFix,
    ast_type,
    ASTTree, BasicType, BinaryExpression, BitNotPrefix, BitwiseAndExpression, BitwiseOrExpression,
    BitwiseXorExpression, BlockType, BooleanLiteral, BooleanType,
    Class, ClassType, DecrementPostfix, DecrementPrefix, DivisionExpression, Enum,
    EnumType, EqualityExpression, Expression, FixType, GreaterEqualExpression, IdentifierExpr,
    IncrementPostfix, IncrementPrefix, IndexPostfix, InequalityExpression, Interface, LambdaType,
    LessEqualExpression, Literal, LogicalAndExpression, LogicalOrExpression, MapExpression,
    MapFix, MemberPostfix, MinusPrefix, ModExpression, Module, MultiplicativeExpression, NewPrefix, NotPrefix,
    NullLiteral,
    NumberLiteral, NumberType, PointFix, PostfixExpression, PrefixExpression, ReferencePrefix,
    Scope, ShiftLeftExpression, ShiftRightExpression, StringLiteral, StringType,
    SubtractiveExpression, TernaryExpression, Type, GreaterExpression, LambdaExpression, LessExpression,
    type_checker, type_merge,
    VoidType, Variable, AddressPrefix, type_is, oper_get_have, TypePrefix, cast_get, oper_best, overload_resolve
} from '../utils'
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
const S_LambdaExpression:type_checker=(ast:LambdaExpression,scope:Scope,call:(ast:ASTTree)=>Type)=>new LambdaType(ast.generic,ast.params,ast.ret,false)
const S_PostfixExpression:type_checker=(ast:PostfixExpression,scope:Scope,call:(ast:ASTTree)=>Type)=>{
    let type=call(ast.expr)
    ast.types=ast.types||[]
    //成员函数重载:记录最近访问的"类.成员",Arguments 分支据此决策(成员名改写为 序号名)
    let cur_member:{cls:string,name:string}=null
    label:
    for(let postfix of ast.postfix){
        if(postfix instanceof IncrementPostfix||postfix instanceof DecrementPostfix){
            let oper= postfix instanceof IncrementPostfix? 'p++' : 'p--'
            let ops=oper_best(scope,oper,type)
            if(ops.length==1){
                ast.oper=oper
                type=ops[0].command.ret
                ast.types.push(type)
                continue
            }
            if(ops.length>1)scope.thr(`ambiguous operation ${oper} at line ${ast.line.join('\n')}`)
            if(!(type instanceof NumberType))
                scope.thr(`++ can only be applied to number at line ${ast.line.join('\n')}`)
            type=new NumberType()
        }
        if(postfix instanceof IndexPostfix){
            if(type instanceof StringType){
                if(!(call(postfix.index) instanceof NumberType))
                    scope.thr(`[] can only be applied to number at line ${ast.line.join('\n')}`)
                type=new StringType()
                ast.types.push(type)
                continue
            }
            if(!(type instanceof FixType)){
                //是否重载了[]:按实参(self 类型, 索引类型)决策最符合签名
                let idx_type=call(postfix.index)
                let ops=oper_best(scope,'[]',type,idx_type)
                if(ops.length==0)scope.thr(`[] can only be applied to fix type at line ${ast.line.join('\n')}`)
                if(ops.length>1)scope.thr(`ambiguous operation [] at line ${ast.line.join('\n')}`)
                if(ops.length==1){
                    ast.oper='[]'
                    ast.types.push(ops[0].command.ret)
                    type=ops[0].command.ret
                }else type=new VoidType()
            }
            else{
                if(type.fix[type.fix.length-1] instanceof ArrayFix){
                    if(!(call(postfix.index) instanceof NumberType))
                        scope.thr(`[] can only be applied to number at line ${ast.line.join('\n')}`)
                    type=type.t
                    ast.types.push(type)
                    continue
                }
                if(type.fix[type.fix.length-1] instanceof MapFix){
                    //map键必须是字符串,如m['a']或m[key]
                    if(!(call(postfix.index) instanceof StringType))
                        scope.thr(`map key must be string at line ${ast.line.join('\n')}`)
                    type= type.t
                    ast.types.push(type)
                    continue
                }
                scope.thr(`[] can only be applied to map or array at line ${ast.line.join('\n')}`)
            }
        }
        if(postfix instanceof ArgumentsPostfix){
            //成员函数重载:最近访问成员 cur_member 且同名多签名 → 按实参选具体成员(改成员名为 序号名)
            if(cur_member&&!(ast.expr instanceof IdentifierExpr&&scope.get_overload(ast.expr.name).length>1)){
                let fns=scope.get_overload(cur_member.name)
                if(fns.length>1&&type instanceof LambdaType){
                    let arg_types=postfix.args.map(a=>call(a))
                    let r=overload_resolve(scope,cur_member.name,fns,arg_types)
                    if(r.kind=='best'){
                        let fn:any=r.fn
                        //改成员名:desugar 据此把 .f 指向具体重载(f/f1)。call_target 存"类.序号名"
                        ast.call_target=cur_member.cls+'.'+fn.name+(fn.index>0?fn.index:'')
                        return fn.return_type
                    }
                    if(r.kind=='ambiguous'){
                        scope.thr(`ambiguous call to ${cur_member.name} at line ${ast.line.join('\n')}`)
                        return type.returnType
                    }
                }
            }
            //函数重载决策:目标是重载函数(同名多签名)时,按实参类型选最符合签名
            if(ast.expr instanceof IdentifierExpr&&type instanceof LambdaType){
                let fns=scope.get_overload(ast.expr.name)
                //组内 >1 才需决议(首个即代表,普通调用由下方通用分支处理)
                if(fns.length>1){
                    let arg_types=postfix.args.map(a=>call(a))
                    let r=overload_resolve(scope,ast.expr.name,fns,arg_types)
                    if(r.kind=='best'){
                        let fn:any=r.fn
                        ast.call_target=fn.name+(fn.index>0?fn.index:'')
                        return fn.return_type
                    }
                    if(r.kind=='ambiguous'){
                        //并列最符合:实参同等地喂入多个签名且互不支配,如 (a,B) 与 (A,b) 传 a,b
                        scope.thr(`ambiguous call to ${ast.expr.name} at line ${ast.line.join('\n')}`)
                        return type.returnType
                    }
                    //kind=='none':留给通用分支报参数不匹配
                }
            }
            if(!(type instanceof LambdaType)){
                //是否重载():self 类型(type) + 实参列表,决策最符合签名
                let arg_types=postfix.args.map(a=>call(a))
                let ops=oper_best(scope,'()',type,...arg_types)
                if(ops.length==0){
                    scope.thr(`() can only be applied to function at line ${ast.line.join('\n')}`)
                    type=new VoidType()
                }else{
                    if(ops.length>1)scope.thr(`ambiguous operation () at line ${ast.line.join('\n')}`)
                    if(postfix.generic.length!=0)scope.thr(`function generic count mismatch at line ${ast.line.join('\n')}`)
                    ast.oper='()'
                    type=ops[0].command.ret
                }
            }else{
                let index=0
                for(let [k,v] of type.generic){
                    if(type_merge(v,postfix.generic[index],scope)!=v)
                        scope.thr(`function generic type mismatch at line ${ast.line.join('\n')}`)
                    scope.set_generic(k,v)
                    index++
                }
                //检查形式泛型和实际泛型,数量一致且实际泛型implement||=形式泛型
                if(postfix.generic.length!=type.generic.size)
                    scope.thr(`function generic count mismatch at line ${ast.line.join('\n')}`)
                //匹配形参实参检查类型,最小公共超类型必须是形参
                if(postfix.args.length!=type.params.size)
                    scope.thr(`function parameter count mismatch at line ${ast.line.join('\n')}`)
                let iden=[]
                type.params.forEach((value,key)=>{iden.push(value)})
                for(let i=0;i<postfix.args.length;i++)
                    if(type_merge(iden[i],call(postfix.args[i]),scope) instanceof VoidType)
                        scope.thr(`function parameter type mismatch at line ${ast.line.join('\n')}`)
                for(let [k,v] of type.generic)
                    scope.generic.delete(k)
                type=type.returnType
            }
        }
        if(postfix instanceof MemberPostfix){
            //up链:外层类的up再向上取一层
            if(postfix.name=='up'&&type instanceof ClassType){
                type=type.local.length>1?new ClassType(type.local.slice(0,-1),[]):type
                ast.types.push(type)
                continue
            }
            //情况1:Class Member
            if(type instanceof ClassType){
                let class_=scope.get(type.local.join('.'))
                if(class_ instanceof Class)
                    for(let i of class_.children)
                        if(i.name==postfix.name) {
                            if(i.modifiers&&i.modifiers._private){
                                let this_t=scope.get('this')
                                let in_class=this_t instanceof ClassType&&this_t.local.join('.')==type.local.join('.')
                                if(!in_class)
                                    scope.thr(`private member '${postfix.name}' can only be accessed inside class ${type.local.join('.')} at line ${ast.line.join('\n')}`)
                            }
                            //函数成员:记住类名与成员名,供 Arguments 重载决策(类内 Function 同名已收进 overload)
                            if(i instanceof Function){
                                let cls=type.local.join('.')
                                cur_member={cls,name:cls+'.'+i.name}
                            }else cur_member=null
                            type = scope.get_sym(i)
                            ast.types.push(type)
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
                            ast.types.push(type)
                            continue label
                        }
                    scope.thr(`${postfix.name} is not defined at line ${ast.line.join('\n')}`)
                }
                //情况2:就是简单的类/模块静态成员
                let mb_target=[...type.local,postfix.name].join('.')
                let mb_obj=scope.get(mb_target)
                //函数成员:记录(类.成员)供 Arguments 重载决策(静态重载 K.f)
                if(mb_obj instanceof Function){
                    cur_member={cls:type.local.join('.'),name:mb_target}
                }else cur_member=null
                type=scope.get_sym(mb_obj)
            }
        }
        ast.types.push(type)
    }
    return type
}
const S_PrefixExpression:type_checker=(ast:PrefixExpression,scope:Scope,call:(ast:ASTTree)=>Type)=>{
    let is_new=ast.prefix[0] instanceof NewPrefix
    let type=is_new?null:call(ast.expr)
    let index=0
    for(let prefix of ast.prefix){
        if(prefix instanceof IncrementPrefix||prefix instanceof DecrementPrefix){
            let oper=prefix instanceof IncrementPrefix?'++p':'--p'
            let ops=oper_best(scope,oper,type)
            if(ops.length==1){
                ast.oper=oper
                type=ops[0].command.ret
                index++
                continue
            }
            if(ops.length>1)scope.thr(`ambiguous operation ${oper} at line ${ast.line.join('\n')}`)
            if(!(type instanceof NumberType))scope.thr(`++/-- can only be applied to number at line ${ast.line.join('\n')}`)
            type=new NumberType()
        }
        if(prefix instanceof MinusPrefix){
            //一元负号:查 '-' 一元?operations 表里 '-' 是二元。一元负号无独立符号,原生 number 即可
            if(!(type instanceof NumberType))scope.thr(`- can only be applied to number at line ${ast.line.join('\n')}`)
            type=new NumberType()
        }
        //逻辑运算符可以当作!a=!(a!=null),不检查
        if(prefix instanceof NotPrefix){
            let ops=oper_best(scope,'!',type)
            if(ops.length==1){
                ast.oper='!'
                type=ops[0].command.ret
                index++
                continue
            }
            if(ops.length>1)scope.thr(`ambiguous operation ! at line ${ast.line.join('\n')}`)
            type=new BooleanType()
        }
        if(prefix instanceof BitNotPrefix){
            let ops=oper_best(scope,'~',type)
            if(ops.length==1){
                ast.oper='~'
                type=ops[0].command.ret
                index++
                continue
            }
            if(ops.length>1)scope.thr(`ambiguous operation ~ at line ${ast.line.join('\n')}`)
            if(!(type instanceof BooleanType||type instanceof NumberType))
                scope.thr(`~ can only be applied to boolean at line ${ast.line.join('\n')}`)
            type=(type instanceof BooleanType||type instanceof NumberType)?type:new NumberType()
        }
        if(prefix instanceof TypePrefix){
            //强转 (T)x:源类型 type 需能经注册的 cast 到达目标 prefix.type。
            //cast_get(type)=[type, 注册在 type 上的各 cast 目标];任一目标可赋给期望类型即可。
            //命中则标记,desugar 脱糖成对 _value_<源>.<目标类型名>(x) 的调用。
            if(!cast_get(type,scope).some(i=>type_is(i,prefix.type,scope)))
                scope.thr(`cast failed at line ${ast.line.join('\n')}`)
            ast.oper='cast'
            type=prefix.type
        }
        //*解引用:去掉一个指针(p* 一元;注意 addressPrefix 节点代表 * 前缀)
        if(prefix instanceof AddressPrefix){
            //是否有重载:p* 是 * 的一元重载符号
            let ops=oper_best(scope,'p*',type)
            if(ops.length==1){
                ast.oper='p*'
                type=ops[0].command.ret
                index++
                continue
            }
            if(ops.length>1)scope.thr(`ambiguous operation p* at line ${ast.line.join('\n')}`)
            if(type instanceof FixType){
                if(!(type.fix[type.fix.length-1] instanceof PointFix))
                    scope.thr(`* can only be applied to point type at line ${ast.line.join('\n')}`)
                type.fix.pop()
                if(type.fix.length==0)
                    type=type.t
            }else
                scope.thr(`* can only be applied to point type at line ${ast.line.join('\n')}`)
        }
        //&取地址:加一个指针(p& 一元)
        if(prefix instanceof ReferencePrefix){
            let ops=oper_best(scope,'p&',type)
            if(ops.length==1){
                ast.oper='p&'
                type=ops[0].command.ret
                index++
                continue
            }
            if(ops.length>1)scope.thr(`ambiguous operation p& at line ${ast.line.join('\n')}`)
            if(type instanceof FixType)
                type.fix.push(new PointFix())
            else type=new FixType(type, [new PointFix()])
        }
        //必须是函数调用
        if(prefix instanceof NewPrefix){
            //绝对是第一个
            if(index!=0)
                scope.thr(`new can only be applied to first at line ${ast.line.join('\n')}`)
            //检查ast.expr是不是postfix
            if(ast.expr instanceof PostfixExpression){
                //找到第一个 ArgumentsPostfix,可能其后有 MemberPostfix/ArgumentsPostfix 等
                let args_index=-1
                for(let i=0;i<ast.expr.postfix.length;i++)
                    if(ast.expr.postfix[i] instanceof ArgumentsPostfix){args_index=i;break}
                if(args_index>=0){
                    //拆下 ArgumentsPostfix 及之后的 trailing postfixes,call 时不带它们避免误处理
                    let trailing=ast.expr.postfix.splice(args_index+1)
                    let fix=ast.expr.postfix.splice(args_index)
                    let _type=call(ast.expr)
                    ast.expr.postfix=[...ast.expr.postfix,...fix,...trailing]  //恢复所有 postfixes
                    let iden_param=[]
                    let real_param=[]
                    for(let v of (fix[0] as ArgumentsPostfix).args)
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
                        type=new ClassType(_type.local,[])
                    }else
                        type=_type
                    //参数是否对应
                    if(iden_param.length!=real_param.length)
                        scope.thr(`new can only be applied to class at line ${ast.line.join('\n')}`)
                    for(let i=0;i<iden_param.length;i++)
                        if(type_merge(iden_param[i],real_param[i],scope)!=iden_param[i])
                            scope.thr(`new can only be applied to class at line ${ast.line.join('\n')}`)
                    //重新应用 trailing postfixes(如 .v .member [index] 等),原实现忽略导致成员访问结果为 ClassType
                    for(let p of trailing){
                        if(p instanceof MemberPostfix){
                            if(type instanceof ClassType){
                                let class_=scope.get(type.local.join('.'))
                                if(class_ instanceof Class){
                                    let found=false
                                    for(let i of class_.children)
                                        if(i.name==p.name){type=scope.get_sym(i);found=true;break}
                                    if(!found)
                                        scope.thr(`${p.name} is not defined at line ${ast.line.join('\n')}`)
                                    continue
                                }
                            }
                            if(type instanceof BlockType){
                                let block=scope.get(type.local.join('.'))
                                if(block instanceof Enum){
                                    let found=false
                                    for(let i of block.children)
                                        if(i==p.name){type=new EnumType(type.local,i);found=true;break}
                                    if(!found)
                                        scope.thr(`${p.name} is not defined at line ${ast.line.join('\n')}`)
                                    continue
                                }
                                type=scope.get_sym(scope.get([...type.local,p.name].join('.')))
                                continue
                            }
                            scope.thr(`${p.name} is not defined at line ${ast.line.join('\n')}`)
                            continue
                        }
                        if(p instanceof IndexPostfix){
                            if(type instanceof FixType){
                                let last=type.fix[type.fix.length-1]
                                if(last instanceof ArrayFix||last instanceof MapFix)type=type.t
                                else scope.thr(`[] can only be applied to map or array at line ${ast.line.join('\n')}`)
                            }else
                                scope.thr(`[] can only be applied to fix type at line ${ast.line.join('\n')}`)
                            continue
                        }
                        if(p instanceof ArgumentsPostfix){
                            //方法调用 new A().make():type=成员的 LambdaType
                            if(type instanceof LambdaType){
                                type=type.returnType
                            }else
                                scope.thr(`() can only be applied to function at line ${ast.line.join('\n')}`)
                        }
                    }
                }
            }
        }
        index++
    }
    return type
}
//运算符→符号:用 instanceof 判定而非 constructor.name——
//bundler(rolldown)可能给类名加 $1 后缀,constructor.name 与字符串表失配(CLI 编译因此查不到重载)
let binary_operator=(ast:BinaryExpression):string|null=>{
    if(ast instanceof LogicalAndExpression)return '&&'
    if(ast instanceof LogicalOrExpression)return '||'
    if(ast instanceof AdditiveExpression)return '+'
    if(ast instanceof SubtractiveExpression)return '-'
    if(ast instanceof MultiplicativeExpression)return '*'
    if(ast instanceof DivisionExpression)return '/'
    if(ast instanceof ModExpression)return '%'
    if(ast instanceof ShiftLeftExpression)return '<<'
    if(ast instanceof ShiftRightExpression)return '>>'
    if(ast instanceof BitwiseAndExpression)return '&'
    if(ast instanceof BitwiseOrExpression)return '|'
    if(ast instanceof BitwiseXorExpression)return '^'
    if(ast instanceof EqualityExpression)return '=='
    if(ast instanceof InequalityExpression)return '!='
    if(ast instanceof GreaterExpression)return '>'
    if(ast instanceof LessExpression)return '<'
    if(ast instanceof GreaterEqualExpression)return '>='
    if(ast instanceof LessEqualExpression)return '<='
    return null
}
const S_BinaryExpression:type_checker=(ast:BinaryExpression,scope:Scope,call:(ast:ASTTree)=>Type)=>{
    let left=call(ast.left)
    let right=call(ast.right)
    let operator=binary_operator(ast)
    //是否有重载:决策取最具体候选;命中则记录到节点供 desugar 脱糖成调用
    let ops=operator?oper_best(scope,operator,left,right):[]
    if(ops.length>1)
        scope.thr(`ambiguous operation ${operator} at line ${ast.line.join('\n')}`)
    if(ops.length!=0){
        ast.oper=ops[0].oper
        return ops[0].command.ret
    }
    //逻辑与/或:操作数类型不限,返回合并类型
    if(ast instanceof LogicalAndExpression||ast instanceof LogicalOrExpression)
        return type_merge(left,right,scope)||new VoidType()
    //算术、位运算、位移:操作数为 number,返回 number
    if(ast instanceof AdditiveExpression||ast instanceof SubtractiveExpression||
       ast instanceof MultiplicativeExpression||ast instanceof DivisionExpression||
       ast instanceof ModExpression||ast instanceof ShiftLeftExpression||
       ast instanceof ShiftRightExpression||ast instanceof BitwiseAndExpression||
       ast instanceof BitwiseOrExpression||ast instanceof BitwiseXorExpression){
        //字符串拼接:string + string => string(仅 +)
        if(ast instanceof AdditiveExpression&&left instanceof StringType&&right instanceof StringType)
            return new StringType()
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
    //相等比较:两边类型需兼容,返回 boolean;null(VoidType)可与任意类型比较(越界/缺键/字面量 null)
    if(ast instanceof EqualityExpression||ast instanceof InequalityExpression){
        let null_side=left instanceof VoidType||right instanceof VoidType
        if(!null_side&&type_merge(left,right,scope) instanceof VoidType)
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
const S_Function:type_checker=(ast:Function,scope:Scope,call:(ast:ASTTree)=>Type)=>new LambdaType(ast.generic,ast.params,ast.return_type,false)
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