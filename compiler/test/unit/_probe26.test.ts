import { describe, it } from 'vitest'
import { lexer } from '../../utils'
import parser from '../../parser'
import check from '../../check'
import desugar from '../../desugar'
import hir from '../../hir'
import ir from '../../ir'
describe('probe26', () => {
    it('foreach ir blocks', () => {
        const src = 'public static main:void(){var arr:number[]=[1,2,3];var sum:number=0;foreach(v:arr){sum=sum+v;}}\n'
        const files = [parser(lexer(src)) as any]
        check(files as any)
        const [count, h] = hir(desugar(files) as any)
        const { code } = ir(count, h)
        console.log('blocks:', [...code.keys()].join(','))
        for (const [k, v] of code) {
            console.log('== block', k, '(size ' + v.length + ') ==')
            for (let i = 0; i < v.length; i++) console.log(' ', i, JSON.stringify(v[i]))
        }
    })
})
