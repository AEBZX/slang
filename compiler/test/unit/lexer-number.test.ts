import {describe, expect, it} from 'vitest'
import {lexer, tokens, TokenType} from '../../src/utils'

const lex = (src: string) => lexer(src, tokens)
const number_values = (src: string) => lex(src).filter(t => t.type === TokenType.Number).map(t => t.value)

describe('lexer 数字字面量', () => {
    it('十进制整数', () => {
        expect(number_values('42')).toEqual(['42'])
    })

    it('单独的 0', () => {
        expect(number_values('0')).toEqual(['0'])
    })

    it('十六进制 0x/0X', () => {
        expect(number_values('0x1F')).toEqual(['0x1F'])
        expect(number_values('0XaB')).toEqual(['0XaB'])
    })

    it('二进制 0b/0B', () => {
        expect(number_values('0b101')).toEqual(['0b101'])
        expect(number_values('0B0')).toEqual(['0B0'])
    })

    it('八进制 0o/0O', () => {
        expect(number_values('0o17')).toEqual(['0o17'])
    })

    it('前缀后无合法数字时只留下 0', () => {
        // '0x' 后面没有 hex 数字 → '0' + 标识符 'x'
        const result = lex('0x')
        expect(result[0].value).toBe('0')
        expect(result[1].value).toBe('x')
    })

    it('小数点后必须跟数字', () => {
        expect(number_values('1.5')).toEqual(['1.5'])
        // '1.x' 的 '.' 不是数字后缀 → 只留下 1
        expect(number_values('1.x')).toEqual(['1'])
    })

    it('科学计数法含正负指数', () => {
        expect(number_values('1e3')).toEqual(['1e3'])
        expect(number_values('2E+5')).toEqual(['2E+5'])
        expect(number_values('1.5e-2')).toEqual(['1.5e-2'])
    })

    it('数字后跟字母时字母归标识符', () => {
        expect(number_values('12ab')).toEqual(['12'])
        expect(lex('12ab')[1].value).toBe('ab')
    })
})
