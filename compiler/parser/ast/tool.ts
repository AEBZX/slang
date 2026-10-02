import {
    AAssign, AddAssign,
    AddExpression, AndAssign,
    AndExpression, ast_data, ASTTree, ClassType, DivAssign,
    DivExpression, EqualExpression, GreaterEqualExpression,
    GreaterExpression, InequalExpression, LessEqualExpression, LessExpression, LogicAndExpression,
    LogicOrExpression, ModAssign,
    ModExpression, MulAssign,
    MulExpression, OrAssign, OrExpression, ShlAssign, ShlExpression, ShrAssign, ShrExpression, SubAssign,
    SubExpression, Type, XorAssign, XorExpression
} from '../../utils'

export const BinaryMap=new Map([
    ['Add',AddExpression],
    ['Sub',SubExpression],
    ['Mul',MulExpression],
    ['Div',DivExpression],
    ['Mod',ModExpression],
    ['And',AndExpression],
    ['Or',OrExpression],
    ['Xor',XorExpression],
    ['LogicAnd',LogicAndExpression],
    ['LogicOr',LogicOrExpression],
    ['Shr',ShrExpression],
    ['Shl',ShlExpression],
    ['Less',LessExpression],
    ['LessEqual',LessEqualExpression],
    ['Greater',GreaterExpression],
    ['GreaterEqual',GreaterEqualExpression],
    ['Equal',EqualExpression],
    ['Inequal',InequalExpression]
])
export const AssignMap=new Map([
    ['AAssign',AAssign],
    ['AddAssign',AddAssign],
    ['SubAssign',SubAssign],
    ['MulAssign',MulAssign],
    ['DivAssign',DivAssign],
    ['ModAssign',ModAssign],
    ['AndAssign',AndAssign],
    ['OrAssign',OrAssign],
    ['XorAssign',XorAssign],
    ['ShlAssign',ShlAssign],
    ['ShrAssign',ShrAssign]
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
function stamp(data:ast_data,node:ASTTree){
    if(node!=null&&node.line==null&&data!=null)node.line=data.line
    return node
}
export function parseImplement(data:ast_data,tree:(data:ast_data)=>ASTTree,key:number){
    const first=data&&data.children?data.children.get(key) as ast_data:null
    if(first==null)
        return {is:false,data:stamp(data,new ClassType(['std','ObjectInterface'],[]))}
    if(first.type=='ImplementsName'||first.type=='ModuleName')
        return {is:true,data:tree(to_ast_data(data,0))}
    if(first.type=='Type'||first.type=='BasicType')
        return {is:true,data:tree(first.type=='Type'?to_ast_data(data,0):first)}
    return {is:false,data:stamp(data,new ClassType(['std','ObjectInterface'],[]))}
}
export function parseGeneric(data:ast_data,tree:(data:ast_data)=>ASTTree){
    const generic=to_ast_data(data,0)
    if(generic==null||generic.type!='GenericList')return {
        is:false,data:new Map<string,Type>()
    }
    let ret=new Map<string,Type>()
    for(const v of to_ast_data(generic,0).children.values())
        if(typeof v=='object')
            ret.set(to_string(v,0),parseImplement(v,tree,1).data)
    return {is:true,data:ret}
}