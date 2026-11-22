import {describe, expect, it} from 'vitest'
import {lexer, tokens, TokenType} from '../../src/utils'

const lex = (src: string) => lexer(src, tokens)

describe('lexer 标识符与关键字', () => {
    it('标识符以字母开头并含数字', () => {
        const result = lex('abc123')
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe(TokenType.Identifier)
        expect(result[0].value).toBe('abc123')
    })

    it('标识符允许 _ 与 $ 开头', () => {
        for (const name of ['_x', '$y']) {
            const result = lex(name)
            expect(result[0].type).toBe(TokenType.Identifier)
            expect(result[0].value).toBe(name)
        }
    })

    it('数字不能作为标识符开头', () => {
        const result = lex('1abc')
        expect(result[0].type).toBe(TokenType.Number)
        expect(result[0].value).toBe('1')
        expect(result[1].type).toBe(TokenType.Identifier)
        expect(result[1].value).toBe('abc')
    })

    it('关键字被识别为 Keyword', () => {
        const result = lex('return')
        expect(result[0].type).toBe(TokenType.Keyword)
        expect(result[0].value).toBe('return')
    })

    it('关键字不吞并标识符前缀(for 与 foreach)', () => {
        const foreach_result = lex('foreach')
        expect(foreach_result[0].value).toBe('foreach')
        const forx_result = lex('forx')
        expect(forx_result).toHaveLength(1)
        expect(forx_result[0].type).toBe(TokenType.Identifier)
        expect(forx_result[0].value).toBe('forx')
    })

    it('多 token 混合分词', () => {
        const result = lex('a1 + b_2')
        expect(result.map(t => t.value)).toEqual(['a1', '+', 'b_2'])
    })
})
