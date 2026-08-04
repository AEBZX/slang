import { describe, it, expect } from 'vitest'
import { lexer } from '../../utils/lexer'
import cst_parse from '../../parser/cst'
import ast_parse from '../../parser/ast'
import { ast_data, File } from '../../utils'
import check from '../../check'

function check_code(code: string): string[] {
    const file = ast_parse(cst_parse(lexer(code)) as ast_data) as File
    try {
        check([file])
        return []
    } catch (e) {
        return (e as Error).message.split('\n')
    }
}

describe('check 端到端', () => {
    it('正确代码无错误', () => {
        const errors = check_code('public main:void(a:number){return a;}\n')
        expect(errors).toEqual([])
    })

    it('未定义变量报错', () => {
        const errors = check_code('public main:void(){return x;}\n')
        expect(errors.join()).toContain('x is not defined')
    })

    it('类型错误: 字符串 + 数字', () => {
        const errors = check_code('public main:void(){var y:number=1+"a";}\n')
        expect(errors.join()).toContain('not number')
    })

    it('赋值类型不匹配报错', () => {
        const errors = check_code('public main:void(a:number){a="str";}\n')
        expect(errors.join()).toContain('not assignable')
    })

    it('赋值类型匹配无错误', () => {
        const errors = check_code('public main:void(a:number){a=1;}\n')
        expect(errors).toEqual([])
    })

    it('重名类报错', () => {
        const errors = check_code('public Foo:class{}\npublic Foo:class{}\n')
        expect(errors.join()).toContain('is defined')
    })
})
