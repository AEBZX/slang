import Parser from './lib/parser'
import Desugar from './lib/desugar'
export * from './lib/ir'
export * from './lib/check'
export * from './lib/desugar'
export {Desugar}
import HIR from './lib/hir'
export * from './lib/hir'
export * from './lib/optimize'
export {HIR}
export * from './model/ir'
export * from './model/hir'
export * from './data'
export {Parser}
export * from './model/ast'
export * from './lib/lexer'
export function convert(s: string): string | string[][] {
    const max = '2147483647'
    const strip = (x: string) => x.replace(/^0+(?=\d)/, "")
    const cmp = (a: string, b: string) => {
        a = strip(a); b = strip(b)
        if (a.length !== b.length) return a.length - b.length
        return a < b ? -1 : a > b ? 1 : 0
    }
    const sub = (a: string, b: string) => {
        const r: number[] = []
        let i = a.length - 1, j = b.length - 1, borrow = 0
        while (i >= 0) {
            let d = +a[i] - borrow - (j >= 0 ? +b[j] : 0)
            if (d < 0) { d += 10; borrow = 1 } else borrow = 0
            r.push(d); i--; j--
        }
        while (r.length > 1 && r[r.length - 1] === 0) r.pop()
        return r.reverse().join('')
    }
    const divmod = (a: string, b: string): [string, string] => {
        a = strip(a)
        if (cmp(a, b) < 0) return ['0', a]
        let q = '', rem = ''
        for (const c of a) {
            rem = strip(rem + c)
            let d = 0
            while (cmp(rem, b) >= 0) { rem = sub(rem, b); d++ }
            q += d
        }
        q = strip(q)
        return [q, rem]
    }
    const n = strip(s)
    if (cmp(n, max) < 0) return n
    const [intPart, intRem] = divmod(n, max)
    const decPart = strip(s.replace(/0+$/, ''))
    const [decQuot, decRem] = divmod(decPart, max)
    return [[intPart, intRem], [decQuot, decRem]]
}