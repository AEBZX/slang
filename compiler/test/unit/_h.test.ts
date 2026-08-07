import { describe, expect, it } from 'vitest'
import { lexer } from '../../utils/lexer'
import cst_parse from '../../parser/cst'
import ast_parse from '../../parser/ast'
import { ast_data, File } from '../../utils'
import check from '../../check'
import desugar from '../../desugar'
import hir from '../../hir'
import {
    HBinaryExpr, HIdentifierExpr, HLambdaExpr, HListCommand, HNumberLiteral, HReturn, HVariable
} from '../../utils'

function hir_of(code: string): any[] {
    const files = [ast_parse(cst_parse(lexer(code)) as ast_data) as File]
    check(files)
    return hir(desugar(files))
}

describe('HIR 生成', () => {
    it('变量引用应解析为参数 id 而非 null', () => {
        const h = hir_of('public m:number(a:number){return a+1;}\n')
        const v = h[0] as HVariable
        expect(v).toBeInstanceOf(HVariable)
        expect(v.name).toBeTypeOf('number')

        const lambda = v.value as HLambdaExpr
        expect(lambda).toBeInstanceOf(HLambdaExpr)
        expect(lambda.params.length).toBe(1)
        const a_id = lambda.params[0]
        expect(a_id).toBeTypeOf('number')

        const list = lambda.commands as HListCommand
        expect(list).toBeInstanceOf(HListCommand)
        const ret = list.commands[0] as HReturn
        expect(ret).toBeInstanceOf(HReturn)

        const bin = ret.data as HBinaryExpr
        expect(bin).toBeInstanceOf(HBinaryExpr)
        expect(bin.op).toBe('+')

        // 参数引用 a 应解析为参数 id,而非 null
        const left = bin.left as HIdentifierExpr
        expect(left).toBeInstanceOf(HIdentifierExpr)
        expect(left.name).toBe(a_id)
        expect(bin.right).toBeInstanceOf(HNumberLiteral)
    })

    it('局部变量声明应分配新 id 并在作用域中可解析', () => {
        const h = hir_of('public main:number(){var x:number=1;return x;}\n')
        const v = h[0] as HVariable
        const lambda = v.value as HLambdaExpr
        const list = lambda.commands as HListCommand
        // var x 反糖为 HAssign,return x 引用 x
        const assign = list.commands[0] as any
        const ret = list.commands[1] as HReturn
        const x_id = (assign.data as HIdentifierExpr).name
        expect(x_id).toBeTypeOf('number')
        expect((ret.data as HIdentifierExpr).name).toBe(x_id)
    })
})
