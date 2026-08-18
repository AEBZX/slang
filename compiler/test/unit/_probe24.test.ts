import { describe, it } from 'vitest'
import { lexer } from '../../utils'
import parser from '../../parser'
import check from '../../check'
import desugar from '../../desugar'
import hir from '../../hir'
import ir from '../../ir'
import c from '../../index'
describe('probe24', () => {
    it('switch ir before/after optimize', () => {
        const src = 'public static main:void(){var x:number=7;switch(x){case 1=>{return;}case 7=>{return;}default=>{return;}}}\n'
        const files = [parser(lexer(src)) as any]
        check(files as any)
        const [count, h] = hir(desugar(files) as any)
        const { code } = ir(count, h)
        console.log('=== IR (optimize 前) main 块 ===')
        const main = code.get(0)!
        for (let i = 0; i < main.length; i++) console.log(' ', i, JSON.stringify(main[i]))
        console.log('=== optimize 后 ===')
        const { BIN } = c([src], 0)
        console.log(JSON.stringify(BIN.slice(0, 40)))
    })
})
