//词法的边界行为:进制里的 0、未闭合的字面量/注释、CRLF 与行号
import {describe, expect, it} from 'vitest'
import {lex_src} from './helper'

//TokenType: 0=Identifier 1=Number 2=String 3=Keyword 4=Comment
const T = {id: 0, num: 1, str: 2, kw: 3, comment: 4}
const values = (src: string) => lex_src(src).map((t: any) => t.value)
const kinds = (src: string) => lex_src(src).map((t: any) => t.type)

describe('lexer/进制里的 0', () => {
    it('十六进制的 0 是合法的数字位', () => {
        expect(values('0x0')).toEqual(['0x0'])
        expect(values('0X0')).toEqual(['0X0'])
        expect(values('0x00ff')).toEqual(['0x00ff'])
        expect(values('0X00FF')).toEqual(['0X00FF'])
    })

    it('二进制/八进制的 0 本来就合法', () => {
        expect(values('0b0')).toEqual(['0b0'])
        expect(values('0o0')).toEqual(['0o0'])
        expect(values('0b0001')).toEqual(['0b0001'])
        expect(values('0o007')).toEqual(['0o007'])
    })

    it('进制前缀后没有合法数字位时按 0 + 标识符切分', () => {
        expect(values('0x')).toEqual(['0', 'x'])
        expect(values('0b2')).toEqual(['0', 'b2'])
        expect(values('0o8')).toEqual(['0', 'o8'])
    })

    it('十六进制里的字母与十进制数字混着用仍是一个 token', () => {
        expect(kinds('0x1a2B')).toEqual([T.num])
        expect(values('0x1a2B+3')).toEqual(['0x1a2B', '+', '3'])
    })
})

describe('lexer/未闭合的字面量与注释', () => {
    it('字符串到文件尾就结束', () => {
        expect(values('"abc')).toEqual(['abc'])
        expect(values("'abc")).toEqual(['abc'])
        expect(values('`abc')).toEqual(['abc'])
        expect(kinds('"abc')).toEqual([T.str])
    })

    it('字符串末尾的孤立反斜杠不会吞掉已有内容', () => {
        expect(values('"a\\')).toEqual(['a'])
    })

    it('块注释没有闭合时一直吃到文件尾', () => {
        expect(values('a /* c')).toEqual(['a', '/* c'])
        expect(kinds('/*')).toEqual([T.comment])
        expect(kinds('a /* c */ b')).toEqual([T.id, T.comment, T.id])
    })

    it('单行注释在文件尾没有换行也能结束', () => {
        expect(values('a//c')).toEqual(['a', '//c'])
        expect(values('//')).toEqual(['//'])
    })

    it('单行注释遇到换行就结束,后面的 token 照常切', () => {
        expect(values('a//c\nb')).toEqual(['a', '//c', 'b'])
        expect(values('a//c\r\nb')).toEqual(['a', '//c', 'b'])
    })
})

describe('lexer/换行与行号', () => {
    it('CRLF 与 LF 切出来的 token 一致', () => {
        expect(values('a\r\nb')).toEqual(values('a\nb'))
        expect(values('var a:number=1;\r\nvar b:number=2;')).toEqual(values('var a:number=1;\nvar b:number=2;'))
    })

    it('CRLF 之后行号从 2 开始,行文本里不带回车', () => {
        const tokens = lex_src('var a:number=1;\r\nvar b:number=2;')
        const vars = tokens.filter((t: any) => t.value === 'var')
        expect(vars[0].line).toBe('var a:number=1; at line:1:1')
        expect(vars[1].line).toBe('var b:number=2; at line:2:1')
        expect(vars[1].line).not.toContain('\r')
    })
})
