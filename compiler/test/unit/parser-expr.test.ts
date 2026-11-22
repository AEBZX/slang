import {describe, expect, it} from 'vitest'
import parser from '../../src/parser'
import {lexer, tokens} from '../../src/utils'
import {
    AddressPrefix, ArgumentsPostfix, ArrayExpression, BinaryExpression, IdentifierExpr,
    IncrementPostfix, LambdaExpression, MemberPostfix, MinusPrefix, NewPrefix, NotPrefix,
    NumberLiteral, NumberType, ReferencePrefix, TernaryExpression, TypePrefix
} from '../../src/utils'

const parse_expr = (src: string) => {
    const file = parser.run([lexer(`m: number = ${src};`, tokens)])[0] as any
    return file.children[0].value
}

describe('parser 表达式', () => {
    it('字面量与标识符', () => {
        expect(parse_expr('1')).toBeInstanceOf(NumberLiteral)
        expect(parse_expr('x')).toBeInstanceOf(IdentifierExpr)
    })

    it('二元运算优先级: * 高于 +', () => {
        const add = parse_expr('1 + 2 * 3') as BinaryExpression
        expect(add).toBeInstanceOf(BinaryExpression)
        expect(add.op).toBe('+')
        expect(add.left).toBeInstanceOf(NumberLiteral)
        expect(add.right).toBeInstanceOf(BinaryExpression)
        expect((add.right as BinaryExpression).op).toBe('*')
    })

    it('同级二元左结合', () => {
        const sub = parse_expr('1 - 2 - 3') as BinaryExpression
        expect(sub.op).toBe('-')
        expect(sub.left).toBeInstanceOf(BinaryExpression)
    })

    it('成员访问链', () => {
        const member = parse_expr('a.b.c') as MemberPostfix
        expect(member).toBeInstanceOf(MemberPostfix)
        expect(member.name).toBe('c')
        expect(member.expr).toBeInstanceOf(MemberPostfix)
        expect((member.expr as MemberPostfix).name).toBe('b')
    })

    it('索引与调用', () => {
        const call = parse_expr('f(1, 2)') as ArgumentsPostfix
        expect(call).toBeInstanceOf(ArgumentsPostfix)
        expect(call.args).toHaveLength(2)
        const index = parse_expr('a[0]') as any
        expect(index.constructor.name).toBe('IndexPostfix')
    })

    it('调用带显式泛型实参', () => {
        const call = parse_expr('f<number>(1)') as ArgumentsPostfix
        expect(call.generic).toHaveLength(1)
        expect(call.args).toHaveLength(1)
    })

    it('前缀运算符', () => {
        expect(parse_expr('-x')).toBeInstanceOf(MinusPrefix)
        expect(parse_expr('!x')).toBeInstanceOf(NotPrefix)
        expect(parse_expr('*p')).toBeInstanceOf(ReferencePrefix)
        expect(parse_expr('&x')).toBeInstanceOf(AddressPrefix)
    })

    it('强转前缀', () => {
        const cast = parse_expr('(number)y') as TypePrefix
        expect(cast).toBeInstanceOf(TypePrefix)
        expect(cast.t).toBeInstanceOf(NumberType)
    })

    it('new 表达式', () => {
        const new_expr = parse_expr('new C()') as NewPrefix
        expect(new_expr).toBeInstanceOf(NewPrefix)
        expect(new_expr.expr).toBeInstanceOf(ArgumentsPostfix)
    })

    it('后缀自增', () => {
        expect(parse_expr('i++')).toBeInstanceOf(IncrementPostfix)
    })

    it('三元表达式', () => {
        const ternary = parse_expr('c ? a : b') as TernaryExpression
        expect(ternary).toBeInstanceOf(TernaryExpression)
        expect(ternary.trueExpr).toBeInstanceOf(IdentifierExpr)
        expect(ternary.falseExpr).toBeInstanceOf(IdentifierExpr)
    })

    it('数组字面量', () => {
        const array = parse_expr('[1, 2]') as ArrayExpression
        expect(array).toBeInstanceOf(ArrayExpression)
        expect(array.elements).toHaveLength(2)
    })

    it('lambda 表达式', () => {
        const lambda = parse_expr('()=>void { return 1; }') as LambdaExpression
        expect(lambda).toBeInstanceOf(LambdaExpression)
        expect(lambda.params.size).toBe(0)
        expect(lambda.body).toBeDefined()
    })
})
