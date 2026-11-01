import {describe, expect, it} from 'vitest'
import {lex_src} from './helper'

//TokenType: 0=Identifier 1=Number 2=String 3=Keyword 4=Comment
const T = {id: 0, num: 1, str: 2, kw: 3, comment: 4}
const kinds = (src: string) => lex_src(src).map(t => t.type)
const values = (src: string) => lex_src(src).map(t => t.value)

describe('lexer/切分', () => {
    it('标识符/运算符/数字各自成型', () => {
        expect(kinds('a+1')).toEqual([T.id, T.kw, T.num])
        expect(values('a+1')).toEqual(['a', '+', '1'])
    })

    it('多字符运算符是一个 token', () => {
        expect(values('a<<=1')).toEqual(['a', '<<=', '1'])
        expect(values('a===b')).toEqual(['a', '===', 'b'])
        expect(values('a!==b')).toEqual(['a', '!==', 'b'])
        expect(values('a&&b||c')).toEqual(['a', '&&', 'b', '||', 'c'])
        expect(values('a=>b')).toEqual(['a', '=>', 'b'])
    })

    it('后缀形式(点/下标/调用)全切成分隔符', () => {
        expect(values('a.b[0](1)')).toEqual(['a', '.', 'b', '[', '0', ']', '(', '1', ')'])
    })

    it('标识符可以用 $ 和 _ 开头,可以带数字', () => {
        expect(kinds('$a _b c1')).toEqual([T.id, T.id, T.id])
    })

    it('空输入没有 token', () => {
        expect(lex_src('')).toEqual([])
    })
})

describe('lexer/关键字', () => {
    it('字面量关键字', () => {
        expect(kinds('null true false')).toEqual([T.kw, T.kw, T.kw])
    })

    it('声明与语句关键字', () => {
        for (const kw of ['module', 'class', 'interface', 'enum', 'function', 'var', 'operation',
            'cast', 'value', 'link', 'implements', 'of', 'as'])
            expect(kinds(kw), kw).toEqual([T.kw])
        for (const kw of ['if', 'else', 'switch', 'case', 'default', 'for', 'while', 'do',
            'foreach', 'break', 'continue', 'return', 'throw', 'await', 'try', 'catch', 'finally', 'vm'])
            expect(kinds(kw), kw).toEqual([T.kw])
    })

    it('修饰符与类型关键字', () => {
        for (const kw of ['public', 'private', 'async', 'sync', 'static', 'unstatic'])
            expect(kinds(kw), kw).toEqual([T.kw])
        for (const kw of ['void', 'boolean', 'number', 'string'])
            expect(kinds(kw), kw).toEqual([T.kw])
    })

    it('关键字和标识符不会混', () => {
        //vm 是关键字,vmx 是标识符
        expect(kinds('vm vmx')).toEqual([T.kw, T.id])
    })
})

describe('lexer/数字', () => {
    it('文本原样保留,进制前缀不在这里换算', () => {
        expect(values('12 1.5 0x1f 0b101 0o17')).toEqual(['12', '1.5', '0x1f', '0b101', '0o17'])
        expect(kinds('12 1.5 0x1f')).toEqual([T.num, T.num, T.num])
    })

    it('负号是单独的运算符,不算进数字', () => {
        expect(values('-1')).toEqual(['-', '1'])
    })

    it('科学计数法是一个数字 token', () => {
        expect(values('1e3')).toEqual(['1e3'])
        expect(values('1.5e-2')).toEqual(['1.5e-2'])
        expect(values('2E+5')).toEqual(['2E+5'])
    })

    //标识符 e 后面跟 +/- 不能被当成指数吃掉(指数必须紧跟在数字后面)
    it('e+1 是三个 token', () => {
        expect(values('e+1')).toEqual(['e', '+', '1'])
        expect(values('a=e+1')).toEqual(['a', '=', 'e', '+', '1'])
        expect(values('x=E-2')).toEqual(['x', '=', 'E', '-', '2'])
    })
})

describe('lexer/字符串', () => {
    it('三种引号都支持,内容去掉引号', () => {
        expect(values('"ab" \'cd\' `ef`')).toEqual(['ab', 'cd', 'ef'])
        expect(kinds('"ab"')).toEqual([T.str])
    })

    it('转义被还原成真实字符', () => {
        expect(values('"a\\nb"')).toEqual(['a\nb'])
        expect(values('"a\\tb"')).toEqual(['a\tb'])
        expect(values('"a\\"b"')).toEqual(['a"b'])
        expect(values('"a\\\\b"')).toEqual(['a\\b'])
    })

    it('空串', () => {
        expect(values('""')).toEqual([''])
    })
})

describe('lexer/注释', () => {
    it('单行注释是独立 token,保留原文', () => {
        expect(kinds('a // c')).toEqual([T.id, T.comment])
        expect(values('a // c')).toEqual(['a', '// c'])
    })

    it('块注释是独立 token', () => {
        expect(kinds('a /* c */ b')).toEqual([T.id, T.comment, T.id])
        expect(values('a /* c */ b')).toEqual(['a', '/* c */', 'b'])
    })
})

describe('lexer/行信息', () => {
    it('每个 token 带着所在行的原文', () => {
        const t = lex_src('var a:number=1;')
        expect(t.length).toBeGreaterThan(0)
        expect(t[0].line).toContain('var a:number=1;')
    })

    it('多行源码每行单独切分', () => {
        const t = lex_src('var a:number=1;\nvar b:number=2;')
        expect(t.map(x => x.value)).toContain('a')
        expect(t.map(x => x.value)).toContain('b')
        expect(t.every(x => x.line.includes('var') || x.line.trim() === '')).toBe(true)
    })
})
