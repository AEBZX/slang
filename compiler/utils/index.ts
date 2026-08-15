import Parser from './lib/parser'
import Desugar from './lib/desugar'
export * from './lib/ir'
export * from './lib/check'
export * from './lib/desugar'
export {Desugar}
import HIR from './lib/hir'
export * from './lib/hir'
export * from './lib/optimize'
export {HIR}
export * from './model/ir'
export * from './model/hir'
export * from './data'
export {Parser}
export * from './model/ast'
export * from './lexer'
export default {
    desugar:Desugar,
    parser:Parser
}