import {describe, expect, it} from 'vitest'
import parser from '../../src/parser'
import {lexer, tokens, TokenType} from '../../src/utils'

const parse = (src: string) => parser.run([lexer(src, tokens)])[0] as any

describe('parser 集成: tokens 到 AST', () => {
    it('注释不参与语法', () => {
        const file = parse('// 头注释\napp: module { }')
        expect(file.children).toHaveLength(1)
        expect(file.children[0].name).toBe('app')
    })

    it('完整小程序的文件结构', () => {
        const file = parse(`link std.io as io;
app: module {
    main: void() { }
}`)
        expect(file.links).toHaveLength(1)
        expect(file.children).toHaveLength(1)
        expect(file.children[0].name).toBe('app')
        expect(file.children[0].children[0].name).toBe('main')
    })

    it('语法错误: 非法 token 抛出异常', () => {
        expect(() => parse('app: module { main: void() { var; } }')).toThrow()
    })

    it('语法错误: 顶层残留 token 抛出异常', () => {
        expect(() => parse('app: module { } ;')).toThrow()
    })

    it('词法错误字符被跳过而非报错', () => {
        // lexer 对未匹配字符逐个跳过,如制表符
        const file = parse('app: module { }')
        expect(file.children).toHaveLength(1)
    })
})

describe('parser 集成: 注释与空白', () => {
    it('块注释跨行不影响后续解析', () => {
        const file = parse('app: module {\n/* a\nb */\nv: number = 1;\n}')
        expect(file.children[0].children[0]).toBeDefined()
    })

    it('token 保留行号信息', () => {
        const toks = lexer("app: module {\n  v: number = 1;\n}", tokens)
        const number_token = toks.find(t => t.type === TokenType.Number)
        expect(number_token!.line).toContain('at line:2')
    })
})
