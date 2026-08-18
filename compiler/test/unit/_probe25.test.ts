import { describe, it } from 'vitest'
import { lexer } from '../../utils'
import parser from '../../parser'
import check from '../../check'
import desugar from '../../desugar'
import hir from '../../hir'
describe('probe25', () => {
    it('switch hir structure', () => {
        const src = 'public static main:void(){var x:number=7;switch(x){case 1=>{return;}case 7=>{return;}default=>{return;}}}\n'
        const files = [parser(lexer(src)) as any]
        check(files as any)
        const [, h] = hir(desugar(files) as any)
        const dump = (n: any, d = 0): string => {
            if (!n || typeof n != 'object') return '  '.repeat(d) + String(n) + '\n'
            if (n instanceof Map) return '  '.repeat(d) + 'Map(...)\n'
            let s = '  '.repeat(d) + (n.constructor?.name || '?')
            for (const [k, v] of Object.entries(n)) {
                const sub = dump(v, d + 1)
                if (sub.trim()) s += '\n' + '  '.repeat(d) + k + ':' + sub.trim()
            }
            return s + '\n'
        }
        console.log(dump(h).slice(0, 5000))
    })
})
