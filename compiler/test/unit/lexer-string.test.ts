import {describe, expect, it} from 'vitest'
import {lexer, tokens, TokenType} from '../../src/utils'

const lex = (src: string) => lexer(src, tokens)
const string_values = (src: string) => lex(src).filter(t => t.type === TokenType.String).map(t => t.value)

describe('lexer 字符串字面量', () => {
    it('双引号字符串,值不含引号', () => {
        expect(string_values('"abc"')).toEqual(['abc'])
    })

    it('单引号与反引号字符串', () => {
        expect(string_values("'a'")).toEqual(['a'])
        expect(string_values('`hi`')).toEqual(['hi'])
    })

    it('空字符串', () => {
        expect(string_values('""')).toEqual([''])
    })

    it('转义序列按 JSON 表解析(\\n)', () => {
        expect(string_values('"a\\nb"')).toEqual(['a\nb'])
    })

    it('未知转义保留原字符', () => {
        expect(string_values('"\\q"')).toEqual(['q'])
    })

    it('未闭合字符串读到 EOF', () => {
        expect(string_values('"abc')).toEqual(['abc'])
    })

    it('字符串中的空格保留', () => {
        expect(string_values('"a b"')).toEqual(['a b'])
    })
})
