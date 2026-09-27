import {
    Block,
    BlockType,
    Cast,
    Class,
    ClassType,
    desugar_visitor,
    Enum,
    File,
    LambdaType,
    Modifier,
    Module,
    NumberLiteral,
    Operation,
    Variable,
    Function, LambdaExpression, NullLiteral, Value
} from '../utils'
import {slang_desugar_visitor} from './tool'
const D_Module:slang_desugar_visitor=(node:Module,call)=>{
    node.children=node.children.map(call) as Block[]
    return node
}