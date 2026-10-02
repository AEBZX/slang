import {
    AddExpression,
    ArgumentsPostfix,
    ArrayExpression,
    ast_data,
    slang_ast_generate, BitNotPrefix, AndExpression, OrExpression, XorExpression,
    BooleanLiteral, DecrementPostfix, DecrementPrefix, DivExpression, EqualExpression, Expression,
    GreaterEqualExpression,
    IdentifierExpr, IncrementPostfix, IncrementPrefix, IndexPostfix, InequalExpression, LessEqualExpression,
    LogicAndExpression, LogicOrExpression, MapExpression, MemberPostfix,
    AddressPrefix, MinusPrefix, ModExpression, MulExpression, NewPrefix, NotPrefix,
    NullLiteral,
    NumberLiteral, PostfixExpression, PrefixExpression, ReferencePrefix,
    ShlExpression, ShrExpression,
    StringLiteral, SubExpression, TernaryExpression, Type, GreaterExpression, LambdaExpression, LessExpression,
    TypePrefix, Command
} from '../../utils'
import {parseGeneric} from './block'
import {BinaryMap, to_ast_data, to_string, tree_ast} from "./tool";
const G_NumberLiteral:slang_ast_generate=(data,tree)=>{
    return new NumberLiteral(to_string(data,0))
}
const G_StringLiteral:slang_ast_generate=(data,tree)=>{
    return new StringLiteral(to_string(data,0))
}
const G_NullLiteral:slang_ast_generate=(data,tree)=>{
    return new NullLiteral(null)
}
const G_BooleanLiteral:slang_ast_generate=(data,tree)=>{
    return new BooleanLiteral(to_string(data,0))
}
const G_Identifier:slang_ast_generate=(data,tree)=>{
    return new IdentifierExpr(to_string(data,0))
}
const G_ArrayExpression:slang_ast_generate=(data,tree)=>{
    let children=[]
    for(const v of data.children.values())
        if(typeof v=='object')children.push(tree(v))
    return new ArrayExpression(children)
}
const G_MapExpression:slang_ast_generate=(data,tree)=>{
    let children=new Map<string,Expression>
    for(const v of data.children.values())
        if(typeof v=='object')
            children.set(to_string(v,0),tree_ast(v,1,tree))
    return new MapExpression(children)
}
const G_LambdaExpression:slang_ast_generate=(data,tree)=>{
    const d=parseGeneric(data,tree)
    const ParamIdentifier=to_ast_data(data,d.is?1:0)
    let param=new Map<string,Type>
    for(const v of ParamIdentifier.children.values())
        if(typeof v=='object')
            param.set(to_string(v,0),
                      tree_ast(v,1,tree))
    const type=tree_ast<Type>(data,d.is?2:1,tree)
    const command=tree_ast<Command>(data,d.is?3:2,tree)
    return new LambdaExpression(d.data,param,type,command)
}
const G_PostfixExpression:slang_ast_generate=(data,tree)=>{
    let primary=tree_ast<Expression>(data,0,tree)
    const FixList=to_ast_data(data,1)
    for(const v of FixList.children.values())
        if(typeof v=='object')
            switch (v.type) {
                case 'IncrementPostfix':
                    primary=new IncrementPostfix(primary)
                    break
                case 'DecrementPostfix':
                    primary=new DecrementPostfix(primary)
                    break
                case 'MemberPostfix':
                    primary=new MemberPostfix(primary,to_string(v,0))
                    break
                case 'IndexPostfix':
                    primary=new IndexPostfix(primary,tree_ast(v,0,tree))
                    break
                case 'ArgumentsPostfix':{
                    let param:Expression[]=[]
                    let type:Type[]=[]
                    let args=0
                    const first=to_ast_data(data,0)
                    if(first&&first.type=='GenericData'){
                        args=1
                        for(const _v of first.children.values())
                            type.push(tree(_v as ast_data))
                    }
                    const args_data=to_ast_data(data,args)
                    if(args_data)
                        for(const arg of args_data.children.values())
                            if(typeof arg=='object')
                                param.push(tree(arg) as Expression)
                    primary=new ArgumentsPostfix(primary,type,param)
                    break
                }
            }
    return primary
}
const G_PrefixExpression:slang_ast_generate=(data,tree)=>{
    const FixList=data.children.get(0) as ast_data
    let primary:Expression=tree(to_ast_data(data,1)) as Expression
    for(const v of FixList.children.values())
        if(typeof v=='object')
            switch (v.type) {
                case 'TypePrefix':
                    primary=new TypePrefix(primary,tree_ast(data,0,tree))
                    break
                case 'IncrementPrefix':
                    primary=new IncrementPrefix(primary)
                    break
                case 'DecrementPrefix':
                    primary=new DecrementPrefix(primary)
                    break
                case 'NotPrefix':
                    primary=new NotPrefix(primary)
                    break
                case 'BitNotPrefix':
                    primary=new BitNotPrefix(primary)
                    break
                case 'MinusPrefix':
                    primary=new MinusPrefix(primary)
                    break
                case 'ReferencePrefix':
                    primary=new ReferencePrefix(primary)
                    break
                case 'AddressPrefix':
                    primary=new AddressPrefix(primary)
                    break
                case 'NewPrefix':
                    primary=new NewPrefix(primary)
                    break
            }
    return primary
}
const G_BinaryExpression:slang_ast_generate=(data,tree)=>{
    const g=(left:Expression,right:Expression,type:string)=>BinaryMap.get(type)(left,right)
    let ret=tree_ast<Expression>(data,0,tree)
    const right=to_ast_data(data,1)
    for(const v of right.children.values())
        if(typeof v=='object')
            ret=g(ret,tree_ast(v,1,tree),(to_ast_data(v,0)).type)
    return ret
}
const G_TernaryExpression:slang_ast_generate=(data,tree)=>{
    return new TernaryExpression(
        tree_ast(data,0,tree),
        tree_ast(data,1,tree),
        tree_ast(data,2,tree)
    )
}
export default new Map([
    ['NumberLiteral',G_NumberLiteral],
    ['StringLiteral',G_StringLiteral],
    ['BooleanLiteral',G_BooleanLiteral],
    ['NullLiteral',G_NullLiteral],
    ['Identifier',G_Identifier],
    ['ArrayExpression',G_ArrayExpression],
    ['MapExpression',G_MapExpression],
    ['PostfixExpression',G_PostfixExpression],
    ['PrefixExpression',G_PrefixExpression],
    ['AddExpression',G_BinaryExpression],
    ['MulExpression',G_BinaryExpression],
    ['ShiftExpression',G_BinaryExpression],
    ['AndExpression',G_BinaryExpression],
    ['OrExpression',G_BinaryExpression],
    ['XorExpression',G_BinaryExpression],
    ['LogicAndExpression',G_BinaryExpression],
    ['LogicOrExpression',G_BinaryExpression],
    ['BinaryExpression',G_BinaryExpression],
    ['EqualExpression',G_BinaryExpression],
    ['RelationalExpression',G_BinaryExpression],
    ['TernaryExpression',G_TernaryExpression],
    ['LambdaExpression',G_LambdaExpression]
])