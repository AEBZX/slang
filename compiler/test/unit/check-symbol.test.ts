import { describe, it, expect } from 'vitest'
import { lexer } from '../../utils/lexer'
import cst_parse from '../../parser/cst'
import ast_parse from '../../parser/ast'
import { ast_data, Class, File, Scope } from '../../utils'
import symbol from '../../check/symbol'

function parse_ast(code: string): File {
    return ast_parse(cst_parse(lexer(code)) as ast_data) as File
}

function make_scope(): Scope {
    return new Scope(null, new Scope(null, null))
}

describe('symbol 符号表', () => {
    it('注册顶层类', () => {
        const ast = parse_ast('public Foo:class{}\n')
        const scope = make_scope()
        symbol([ast], scope)
        expect(scope.data.get('Foo')).toBeInstanceOf(Class)
        expect(scope.global.error).toEqual([])
    })

    it('重名检测', () => {
        const ast = parse_ast('public Foo:class{}\npublic Foo:class{}\n')
        const scope = make_scope()
        symbol([ast], scope)
        expect(scope.global.error.join()).toContain('is defined')
    })

    it('implements 建立继承链', () => {
        const ast = parse_ast('public I:interface{}\npublic A:class implements I{}\n')
        const scope = make_scope()
        symbol([ast], scope)
        expect(scope.global.error).toEqual([])
        expect(scope.chain.get('I').has('A')).toBe(true)
    })

    it('static 成员注册到全局', () => {
        const ast = parse_ast('public Foo:class{public static bar:var:number;}\n')
        const scope = make_scope()
        symbol([ast], scope)
        expect(scope.global.data.has('Foo.bar')).toBe(true)
    })
})
