import { describe, it } from 'vitest'
import { lexer } from '../../utils'
import parser from '../../parser'
import check from '../../check'
import desugar from '../../desugar'
describe('probe27', () => {
    it('foreach desugar structure', () => {
        const src = 'public m:void(){var arr:number[]=[1];var sum:number=0;foreach(v:arr){sum=sum+v;}}\n'
        const files = [parser(lexer(src)) as any]
        check(files as any)
        const out = desugar(files)
        const dump = (n: any, d = 0): string => {
            if (!n || typeof n != 'object') return '  '.repeat(d) + String(n) + '\n'
            let s = '  '.repeat(d) + (n.constructor?.name || '?')
            for (const [k, v] of Object.entries(n)) {
                const sub = dump(v, d + 1)
                if (sub.trim()) s += '\n' + '  '.repeat(d) + k + ':' + sub.trim()
            }
            return s + '\n'
        }
        console.log(dump(out).slice(0, 7000))
    })
})
