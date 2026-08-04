import {
    AdditiveExpression,
    ArgumentsPostfix,
    ArrayExpression,
    ast_data,
    ast_generate, BitNotPrefix, BitwiseAndExpression, BitwiseOrExpression, BitwiseXorExpression,
    BooleanLiteral, DecrementPostfix, DecrementPrefix, DivisionExpression, EqualityExpression, Expression,
    GreaterEqualExpression,
    IdentifierExpr, IncrementPostfix, IncrementPrefix, IndexPostfix, InequalityExpression, LessEqualExpression,
    LogicalAndExpression, LogicalOrExpression, MapExpression, MemberPostfix,
    AddressPrefix, MinusPrefix, ModExpression, MultiplicativeExpression, NewPrefix, NotPrefix,
    NullLiteral,
    NumberLiteral, Postfix, PostfixExpression, Prefix, PrefixExpression, ReferencePrefix,
    ShiftLeftExpression, ShiftRightExpression,
    StringLiteral, SubtractiveExpression, TernaryExpression, Type
} from '../../utils'
import {GreaterExpression, LambdaExpression, LessExpression} from "../../utils/model/expr.js";
const G_NumberLiteral:ast_generate=(data,tree)=>{
    return new NumberLiteral(data.children.get('child_0') as string)
}
const G_StringLiteral:ast_generate=(data,tree)=>{
    return new StringLiteral(data.children.get('child_0') as string)
}
const G_NullLiteral:ast_generate=(data,tree)=>{
    return new NullLiteral(null)
}
const G_BooleanLiteral:ast_generate=(data,tree)=>{
    return new BooleanLiteral(data.children.get('child_0') as string)
}
const G_Identifier:ast_generate=(data,tree)=>{
    return new IdentifierExpr(data.children.get('child_0') as string)
}
const G_ArrayExpression:ast_generate=(data,tree)=>{
    let children=[]
    for(let [k,v] of data.children)
        if(typeof v=='object')children.push(tree(v,tree))
    return new ArrayExpression(children)
}
const G_MapExpression:ast_generate=(data,tree)=>{
    let children=new Map<string,Expression>
    for(let [k,v] of data.children)
        if(typeof v=='object')
            children.set(v.children.get('child_0') as string,
                         tree(v.children.get('child_2') as ast_data,tree))
    return new MapExpression(children)
}
const G_LambdaExpression:ast_generate=(data,tree)=>{
    const ParamIdentifier=data.children.get('child_0') as ast_data
    let param=new Map<string,Type>
    for(let [k,v] of ParamIdentifier.children)
        if(typeof v=='object')
            param.set(v.children.get('child_0') as string,
                      tree(v.children.get('child_1') as ast_data,tree))
    let type=tree(data.children.get('child_1') as ast_data,tree)
    let command=tree(data.children.get('child_2') as ast_data,tree)
    return new LambdaExpression(param,type,command)
}
const G_PostfixExpression:ast_generate=(data,tree)=>{
    let fix:Postfix[]=[]
    let primary=tree(data.children.get('child_0') as ast_data,tree)
    let FixList=data.children.get('child_1') as ast_data
    for(let [k,v] of FixList.children)
        if(typeof v=='object')
            switch (v.type) {
                case 'IncrementPostfix':
                    fix.push(new IncrementPostfix())
                    break
                case 'DecrementPostfix':
                    fix.push(new DecrementPostfix())
                    break
                case 'MemberPostfix':
                    fix.push(new MemberPostfix(v.children.get('child_0') as string))
                    break
                case 'IndexPostfix':
                    fix.push(new IndexPostfix(tree(v.children.get('child_0') as ast_data,tree)))
                    break
                case 'ArgumentsPostfix':{
                    let param=[]
                    for(let [k,_v] of v.children)
                        if(typeof _v=='object')
                            param.push(tree(_v,tree))
                    fix.push(new ArgumentsPostfix(param))
                    break
                }
            }
    if(FixList.children.size==0)
        return primary
    return new PostfixExpression(primary,fix)
}
const G_PrefixExpression:ast_generate=(data,tree)=>{
    let fix:Prefix[]=[]
    let primary=tree(data.children.get('child_1') as ast_data,tree)
    for(let [k,v] of (data.children.get('child_0') as ast_data).children)
        if(typeof v=='object')
            switch (v.type) {
                case 'IncrementPrefix':
                    fix.push(new IncrementPrefix())
                    break
                case 'DecrementPrefix':
                    fix.push(new DecrementPrefix())
                    break
                case 'NotPrefix':
                    fix.push(new NotPrefix())
                    break
                case 'BitNotPrefix':
                    fix.push(new BitNotPrefix())
                    break
                case 'MinusPrefix':
                    fix.push(new MinusPrefix())
                    break
                case 'ReferencePrefix':
                    fix.push(new ReferencePrefix())
                    break
                case 'AddressPrefix':
                    fix.push(new AddressPrefix())
                    break
                case 'NewPrefix':
                    fix.push(new NewPrefix())
                    break
            }
    if((data.children.get('child_0') as ast_data).children.size==0)
        return primary
    return new PrefixExpression(primary,fix)
}
const G_BinaryExpression:ast_generate=(data,tree)=>{
    const g=(left:Expression,right:Expression,type:string)=>{
        switch (type) {
            case 'Additive':
                return new AdditiveExpression(left,right)
            case 'Subtract':
                return new SubtractiveExpression(left,right)
            case 'Multiplicative':
                return new MultiplicativeExpression(left,right)
            case 'Divide':
                return new DivisionExpression(left,right)
            case 'Mod':
                return new ModExpression(left,right)
            case 'ShiftLeft':
                return new ShiftLeftExpression(left,right)
            case 'ShiftRight':
                return new ShiftRightExpression(left,right)
            case 'BitwiseAnd':
                return new BitwiseAndExpression(left,right)
            case 'BitwiseOr':
                return new BitwiseOrExpression(left,right)
            case 'BitwiseXor':
                return new BitwiseXorExpression(left,right)
            case 'LogicalAnd':
                return new LogicalAndExpression(left,right)
            case 'LogicalOr':
                return new LogicalOrExpression(left,right)
            case 'Greater':
                return new GreaterExpression(left,right)
            case 'GreaterEqual':
                return new GreaterEqualExpression(left,right)
            case 'Less':
                return new LessExpression(left,right)
            case 'LessEqual':
                return new LessEqualExpression(left,right)
            case 'Equal':
                return new EqualityExpression(left,right)
            case 'NotEqual':
                return new InequalityExpression(left,right)
        }
    }
    let ret=tree(data.children.get('child_0') as ast_data,tree)
    let right=data.children.get('child_1') as ast_data
    for(let [k,v] of right.children)
        if(typeof v=='object')
            ret=g(ret,tree(v.children.get('child_1') as ast_data,tree),(v.children.get('child_0') as ast_data).type as string)
    return ret
}
const G_TernaryExpression:ast_generate=(data,tree)=>{
    return new TernaryExpression(
        tree(data.children.get('child_0') as ast_data,tree),
        tree(data.children.get('child_1') as ast_data,tree),
        tree(data.children.get('child_2') as ast_data,tree)
    )
}
export default {
    'NumberLiteral':G_NumberLiteral,
    'StringLiteral':G_StringLiteral,
    'BooleanLiteral':G_BooleanLiteral,
    'NullLiteral':G_NullLiteral,
    'Identifier':G_Identifier,
    'ArrayExpression':G_ArrayExpression,
    'MapExpression':G_MapExpression,
    'PostfixExpression':G_PostfixExpression,
    'PrefixExpression':G_PrefixExpression,
    'AdditiveExpression':G_BinaryExpression,
    'MultiplicativeExpression':G_BinaryExpression,
    'ShiftExpression':G_BinaryExpression,
    'BitwiseAndExpression':G_BinaryExpression,
    'BitwiseOrExpression':G_BinaryExpression,
    'BitwiseXorExpression':G_BinaryExpression,
    'LogicalAndExpression':G_BinaryExpression,
    'LogicalOrExpression':G_BinaryExpression,
    'BinaryExpression':G_BinaryExpression,
    'EqualityExpression':G_BinaryExpression,
    'RelationalExpression':G_BinaryExpression,
    'TernaryExpression':G_TernaryExpression,
    'LambdaExpression':G_LambdaExpression,
}