//系统测试:严格模糊——随机表达式/循环/字符串/数组,独立求值器对答案
import {describe, expect, it} from 'vitest'
import {execFileSync} from 'node:child_process'
import {writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {bin_of} from '../unit/helper-ir'

const vm_exe = resolve(__dirname, '../../..', 'vm/cmake-build-debug/vm.exe')

//程序里每条用例自答,打出 okN/badN;断言标记序列与独立求值器的结论一致
const run = (vars: string, checks: string[], expected: string[]) => {
    const src = `public m:module{ public static main:number(){ ${vars} ${checks.join('')} return 0; } }`
    const file = join(tmpdir(), `slang-fuzz-${process.pid}.sbin`)
    writeFileSync(file, bin_of(src, file))
    const out = execFileSync(vm_exe, [file], {timeout: 60000, encoding: 'utf8'})
    const lines = out.replace(/\r\n/g, '\n').trim().split('\n')
    const wrong = lines.filter((l, i) => l !== expected[i])
    expect(wrong, '打错标记的用例: ' + wrong.join(',')).toEqual([])
    expect(lines.length).toBe(expected.length)
}

//每个种子独立可复现
const make_rnd = (s: number) => {
    let seed = s
    const rnd = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0
        return seed / 0x100000000
    }
    return {
        rnd,
        pick: <T>(list: T[]): T => list[Math.floor(rnd() * list.length)],
        int_lit: () => Math.floor(rnd() * 10)
    }
}

//先造树,再由独立求值器算值;生成和求值互不干扰
type num =
    | {k: 'lit', v: number}
    | {k: 'var', name: string}
    | {k: 'op', op: string, l: num, r: num}
    | {k: 'intop', op: string, a: number, b: number}
    | {k: 'bitnot', v: number}
type cond =
    | {k: 'cmp', op: string, l: num, r: num}
    | {k: 'not', a: cond}

const eval_num = (n: num, env: Map<string, number>): number => {
    switch (n.k)
    {
    case 'lit': return n.v
    case 'var': return env.get(n.name) ?? 0
    case 'bitnot': return ~(n.v | 0)
    case 'intop':
        switch (n.op)
        {
        case '%': return (n.a | 0) % (n.b | 0)
        case '&': return (n.a | 0) & (n.b | 0)
        case '|': return (n.a | 0) | (n.b | 0)
        case '^': return (n.a | 0) ^ (n.b | 0)
        case '<<': return (n.a | 0) << (n.b | 0)
        default: return (n.a | 0) >> (n.b | 0)
        }
    case 'op':
        switch (n.op)
        {
        case '+': return eval_num(n.l, env) + eval_num(n.r, env)
        case '-': return eval_num(n.l, env) - eval_num(n.r, env)
        case '*': return eval_num(n.l, env) * eval_num(n.r, env)
        default: return eval_num(n.l, env) / eval_num(n.r, env)
        }
    }
}
const eval_cond = (c: cond, env: Map<string, number>): boolean => {
    if (c.k == 'not')return !eval_cond(c.a, env)
    const l = eval_num(c.l, env), r = eval_num(c.r, env)
    switch (c.op)
    {
    case '==': return l === r
    case '!=': return l !== r
    case '>': return l > r
    case '>=': return l >= r
    case '<': return l < r
    default: return l <= r
    }
}

const code_num = (n: num): string => {
    switch (n.k)
    {
    case 'lit': return n.v < 0 ? `(0-${String(-n.v)})` : String(n.v)
    case 'var': return n.name
    case 'bitnot': return `(~${String(n.v)})`
    case 'intop': return `(${n.a}${n.op}${n.b})`
    case 'op': return `(${code_num(n.l)}${n.op}${code_num(n.r)})`
    }
}
const code_cond = (c: cond): string =>
    c.k == 'not' ? `(!${code_cond(c.a)})` : `(${code_num(c.l)}${c.op}${code_num(c.r)})`

const num_ops = ['+', '-', '*', '/']
const int_ops = ['%', '&', '|', '^', '<<', '>>']
const cmp_ops = ['==', '!=', '>', '>=', '<', '<=']
const marker = (index: number, pass: boolean) => pass ? `ok${index}` : `bad${index}`
const check = (index: number, condition: string) =>
    `if(${condition})vm("in","shell",[oper:"output",id:0,data:"ok${index}"]);else vm("in","shell",[oper:"output",id:0,data:"bad${index}"]);`

describe('system/严格模糊', () => {
    it('随机表达式(含变量/负字面量/位运算)', () => {
        for (const seed of [1, 7, 42, 99, 2026])
        {
            const {rnd, pick, int_lit} = make_rnd(seed)
            const env = new Map([['x', int_lit()], ['y', int_lit()]])
            const gen_num = (depth: number): num => {
                if (depth <= 0 || rnd() < 0.3)
                {
                    if (rnd() < 0.2)return {k: 'var', name: rnd() < 0.5 ? 'x' : 'y'}
                    if (rnd() < 0.15)return {k: 'lit', v: -int_lit()}
                    return {k: 'lit', v: int_lit()}
                }
                if (rnd() < 0.15)return {k: 'bitnot', v: int_lit()}
                if (rnd() < 0.4)return {k: 'intop', op: pick(int_ops), a: int_lit(), b: 1 + Math.floor(rnd() * 9)}
                return {k: 'op', op: pick(num_ops), l: gen_num(depth - 1), r: gen_num(depth - 1)}
            }
            const gen_cond = (depth: number): cond =>
                depth > 0 && rnd() < 0.25 ? {k: 'not', a: gen_cond(depth - 1)} : {k: 'cmp', op: pick(cmp_ops), l: gen_num(2), r: gen_num(2)}
            const checks: string[] = []
            const expected: string[] = []
            let attempts = 0
            while (checks.length < 60 && attempts++ < 1500)
            {
                const index = checks.length
                if (rnd() < 0.6)
                {
                    const e = gen_num(3)
                    const v = eval_num(e, env)
                    if (!Number.isInteger(v) || Math.abs(v) > 2147483647)continue
                    checks.push(check(index, `${code_num(e)}==${code_num({k: 'lit', v})}`))
                    expected.push(marker(index, true))
                }
                else
                {
                    const c = gen_cond(2)
                    checks.push(check(index, code_cond(c)))
                    expected.push(marker(index, eval_cond(c, env)))
                }
            }
            expect(checks.length).toBe(60)
            run(`var x:number=${env.get('x')}; var y:number=${env.get('y')};`, checks, expected)
        }
    }, 300000)

    it('随机 while 循环(边界/步长/运算符)', () => {
        for (const seed of [3, 11, 77, 555])
        {
            const {rnd, pick} = make_rnd(seed)
            const checks: string[] = []
            const expected: string[] = []
            let attempts = 0
            while (checks.length < 6 && attempts++ < 100)
            {
                const loop = checks.length
                const start = Math.floor(rnd() * 5)
                const step = 1 + Math.floor(rnd() * 3)
                const bound = start + step * (1 + Math.floor(rnd() * 40))
                const op = pick(['+', '+', '-', '-', '*'])
                //TS 侧独立求循环结果,和 VM 的 while 语义对齐
                let s = 0, i = start
                while (i < bound)
                {
                    if (op == '+')s = s + i
                    else if (op == '-')s = s - i
                    else s = s * i
                    i = i + step
                }
                if (!Number.isInteger(s) || Math.abs(s) > 2147483647)continue
                checks.push(
                    `var s${loop}:number=0; var i${loop}:number=${start};` +
                    `while(i${loop}<${bound}){ s${loop}=s${loop}${op}i${loop}; i${loop}=i${loop}+${step}; }` +
                    check(loop, `s${loop}==${s < 0 ? `(0-${-s})` : s}`))
                expected.push(marker(loop, true))
            }
            expect(checks.length).toBe(6)
            run('', checks, expected)
        }
    }, 300000)

    it('字符串相等', () => {
        const words = ['ab', 'abc', 'zz']
        const {rnd, pick} = make_rnd(9)
        const checks: string[] = []
        const expected: string[] = []
        for (let index = 0; index < 20; ++index)
        {
            const a = pick(words), b = pick(words)
            const use_var = rnd() < 0.5
            //a 声明为 "ab":变量参与时按 a 的内容判
            checks.push(check(index, use_var ? `a=="${b}"` : `"${a}"=="${b}"`))
            expected.push(marker(index, use_var ? b === 'ab' : a === b))
        }
        run('var a:string="ab";', checks, expected)
    }, 120000)

    it('数组相等按内容比', () => {
        const {rnd} = make_rnd(13)
        const checks: string[] = []
        const expected: string[] = []
        for (let index = 0; index < 20; ++index)
        {
            const a = Math.floor(rnd() * 5), b = Math.floor(rnd() * 5), c = Math.floor(rnd() * 5)
            const ne = rnd() < 0.5
            checks.push(`var d${index}:number[]=[${a},${b}];` +
                check(index, `d${index}${ne ? '!=' : '=='}[${a},${c}]`))
            expected.push(marker(index, ne ? b !== c : b === c))
        }
        run('', checks, expected)
    }, 120000)
})
