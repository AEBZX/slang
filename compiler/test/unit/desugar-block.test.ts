import { describe, expect, it } from 'vitest'
import { lexer } from '../../utils/lexer'
import cst_parse from '../../parser/cst'
import ast_parse from '../../parser/ast'
import { ast_data, ClassType, File } from '../../utils'
import check from '../../check'
import desugar from '../../desugar'

function desugar_code(code: string): any {
    const files = [ast_parse(cst_parse(lexer(code)) as ast_data) as File]
    check(files)
    return desugar(files)
}

describe('desugar 成员函数 this 参数', () => {
    it('类成员函数注入 this:ClassType 作为第一个参数', () => {
        const out = desugar_code('public A:class{public f:number(x:number){return x;}}\n')
        const A = out[0].children[0]
        const f = A.children[0]
        const params = f.value.params
        expect([...params.keys()]).toEqual(['this', 'x'])
        // this 类型为指向当前类的 ClassType
        expect(params.get('this')).toBeInstanceOf(ClassType)
        expect((params.get('this') as ClassType).local).toEqual(['A'])
    })

    it('顶层函数不注入 this', () => {
        const out = desugar_code('public g:number(x:number){return x;}\n')
        const g = out[0].children[0]
        expect([...g.value.params.keys()]).toEqual(['x'])
    })

    it('静态成员函数不注入 this', () => {
        const out = desugar_code('public A:class{public static f:number(x:number){return x;}}\n')
        const A = out[0].children[0]
        const f = A.children[0]
        expect([...f.value.params.keys()]).toEqual(['x'])
    })

    it('constructor 特殊处理不注入 this', () => {
        const out = desugar_code('public A:class{public constructor:void(x:number){}\npublic f:number(){return 1;}}\n')
        const A = out[0].children[0]
        const cons = A.children.find((c: any) => c.name == 'constructor')
        const f = A.children.find((c: any) => c.name == 'f')
        // constructor 不加 this,普通成员函数加
        expect([...cons.value.params.keys()]).toEqual(['x'])
        expect([...f.value.params.keys()]).toEqual(['this'])
    })
})
