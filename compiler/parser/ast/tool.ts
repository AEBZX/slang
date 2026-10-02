import {
    AAssign, AddAssign,
    AddExpression, AndAssign,
    AndExpression, ast_data, ASTTree, DivAssign,
    DivExpression, EqualExpression, GreaterEqualExpression,
    GreaterExpression, InequalExpression, LessEqualExpression, LessExpression, LogicAndExpression,
    LogicOrExpression, ModAssign,
    ModExpression, MulAssign,
    MulExpression, OrAssign, OrExpression, ShlAssign, ShlExpression, ShrAssign, ShrExpression, SubAssign,
    SubExpression, XorAssign, XorExpression
} from '../../utils'

export const BinaryMap=new Map([
    ['Add',AddExpression.constructor],
    ['Sub',SubExpression.constructor],
    ['Mul',MulExpression.constructor],
    ['Div',DivExpression.constructor],
    ['Mod',ModExpression.constructor],
    ['And',AndExpression.constructor],
    ['Or',OrExpression.constructor],
    ['Xor',XorExpression.constructor],
    ['LogicAnd',LogicAndExpression.constructor],
    ['LogicOr',LogicOrExpression.constructor],
    ['Shr',ShrExpression.constructor],
    ['Shl',ShlExpression.constructor],
    ['Less',LessExpression.constructor],
    ['LessEqual',LessEqualExpression.constructor],
    ['Greater',GreaterExpression.constructor],
    ['GreaterEqual',GreaterEqualExpression.constructor],
    ['Equal',EqualExpression.constructor],
    ['Inequal',InequalExpression.constructor]
])
export const AssignMap=new Map([
    ['AAssign',AAssign.constructor],
    ['AddAssign',AddAssign.constructor],
    ['SubAssign',SubAssign.constructor],
    ['MulAssign',MulAssign.constructor],
    ['DivAssign',DivAssign.constructor],
    ['ModAssign',ModAssign.constructor],
    ['AndAssign',AndAssign.constructor],
    ['OrAssign',OrAssign.constructor],
    ['XorAssign',XorAssign.constructor],
    ['ShlAssign',ShlAssign.constructor],
    ['ShrAssign',ShrAssign.constructor]
])
export function to_ast_data(data:ast_data,id:number){
    return data.children.get(id) as ast_data|null
}
export function to_string(data:ast_data,id:number){
    return data.children.get(id) as string|null
}
export function tree_ast<T>(data:ast_data,id:number,call:(ast:ast_data)=>ASTTree):T{
    if(to_ast_data(data,id)==null)return null
    return call(to_ast_data(data,id)) as T
}