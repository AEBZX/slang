import {describe, expect, it} from 'vitest'
import {lexer, tokens, TokenType} from '../../src/utils'

const lex = (src: string) => lexer(src, tokens)

describe('lexer 注释', () => {
    it('行注释整体成一个 Comment token', () => {
        const result = lex('// abc')
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe(TokenType.Comment)
        expect(result[0].value).toBe('// abc')
    })

    it('块注释整体成一个 Comment token', () => {
        const result = lex('/* abc */')
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe(TokenType.Comment)
        expect(result[0].value).toBe('/* abc */')
    })

    it('块注释可跨行', () => {
        const result = lex('/* a\nb */')
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe(TokenType.Comment)
    })

    it('/ 不被注释匹配吞掉,可作除号', () => {
        const result = lex('4/2')
        expect(result.map(t => t.value)).toEqual(['4', '/', '2'])
    })

    it('注释不参与后续 token 的行号错乱', () => {
        const result = lex('/* a\n*/ 42')
        const number_token = result.find(t => t.value === '42')
        expect(number_token).toBeDefined()
        expect(number_token!.line).toContain('at line:2')
    })
})
