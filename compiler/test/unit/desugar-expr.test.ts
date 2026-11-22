import {describe, expect, it} from 'vitest'
import {run_to_desugar} from '../helpers'
import {ArrayExpression, BinaryExpression, IdentifierExpr, NumberLiteral, Variable} from '../../src/utils'

//跑管线到 desugar,取 main(lambda 形式)体的第一个语句
const desugar_first = (body: string) => {
    const desugared = run_to_desugar(`app: module { main: void() { ${body} } }`) as any
    const main_var = desugared[0].children[0].children[0] as Variable
    return main_var.value.body.commands[0]
}

describe('desugar expr: 字面量降糖', () => {
    it('boolean 字面量降为 number 1/0', () => {
        expect(desugar_first('var t: boolean = true;').value).toBeInstanceOf(NumberLiteral)
        expect(desugar_first('var t: boolean = true;').value.value).toBe('1')
        expect(desugar_first('var f: boolean = false;').value.value).toBe('0')
    })

    it('单字符字符串降为 number(UTF-8 打包)', () => {
        const char_literal = desugar_first('var c: number = \'a\';')
        expect(char_literal.value).toBeInstanceOf(NumberLiteral)
        expect(Number(char_literal.value.value)).toBe(97)
    })

    it('多字符字符串降为 number 数组', () => {
        const str = desugar_first('var s: number[] = \'ab\';')
        expect(str.value).toBeInstanceOf(ArrayExpression)
        expect(str.value.elements).toHaveLength(2)
        expect(Number(str.value.elements[0].value)).toBe(97)
    })
})

describe('desugar expr: 无重载运算保留原节点', () => {
    it('加法保留 BinaryExpression', () => {
        const expr = desugar_first('var x: number = 1 + 2;')
        expect(expr.value).toBeInstanceOf(BinaryExpression)
        expect(expr.value.op).toBe('+')
    })

    it('标识符保留 IdentifierExpr', () => {
        const desugared = run_to_desugar('app: module { main: void() { var x: number = 1; var y: number = x; } }') as any
        const commands = desugared[0].children[0].children[0].value.body.commands
        const expr = commands[1]
        expect(expr.value).toBeInstanceOf(IdentifierExpr)
        expect(expr.value.name).toBe('x')
    })

    it('三元表达式保留结构', () => {
        const desugared = run_to_desugar('app: module { main: void() { var x: number = 1; var y: number = x ? 1 : 2; } }') as any
        const commands = desugared[0].children[0].children[0].value.body.commands
        expect(commands[1].value.constructor.name).toBe('TernaryExpression')
    })
})
