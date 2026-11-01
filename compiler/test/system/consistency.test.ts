//系统测试:compiler↔vm 绝对一致——三路差分(参考解释器/优化后IR/真实VM)+蜕变变体+重复性
import {describe, expect, it} from 'vitest'
import {execFileSync} from 'node:child_process'
import {writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {bin_of, ir_of, opt_of} from '../unit/helper-ir'
import {exec} from '../interpreter'

const vm_exe = resolve(__dirname, '../../..', 'vm/cmake-build-debug/vm.exe')
//结果按 12 位二进制打印,|值| 必须小于 2^11(生成器保证)
const BITS = 12

const run_vm = (src: string): string[] => {
    const file = join(tmpdir(), `slang-diff-${process.pid}.sbin`)
    writeFileSync(file, bin_of(src, file))
    const out = execFileSync(vm_exe, [file], {timeout: 60000, encoding: 'utf8'})
    return out.replace(/\r\n/g, '\n').trim().split('\n')
}
//参考解释器:返回整数结果,null 表示它跑不了这类程序。
//从入口块 0 起跑(和 VM 同一起点):模块登记就编在块 0 开头,函数调用要靠它
const run_interp = (tool: any): number | null => {
    try
    {
        const r: any = exec(tool, [], 200000, {entry: 0})
        if (typeof r.ret != 'number' || !Number.isInteger(r.ret))return null
        return r.ret
    }
    catch
    {
        return null
    }
}

//先造树,再由各自的方式生成源码;蜕变变换只动树
type expr =
    | {k: 'lit', v: number}
    | {k: 'var', name: string}
    | {k: 'bin', op: string, l: expr, r: expr}
    | {k: 'intop', op: string, a: number, b: number}
type cond = {k: 'cmp', op: string, l: expr, r: expr} | {k: 'not', a: cond}
type stmt =
    | {k: 'assign', name: string, e: expr}
    | {k: 'if', c: cond, t: stmt[], f: stmt[]}
    | {k: 'while', s: string, i: string, bound: number}

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

const bin_ops = ['+', '-', '*']
const int_ops = ['&', '|', '^', '<<', '>>']
const cmp_ops = ['==', '!=', '>', '>=', '<', '<=']
const code_expr = (e: expr): string => {
    switch (e.k)
    {
    case 'lit': return String(e.v)
    case 'var': return e.name
    case 'intop': return `(${e.a}${e.op}${e.b})`
    case 'bin': return `(${code_expr(e.l)}${e.op}${code_expr(e.r)})`
    }
}
const code_cond = (c: cond): string =>
    c.k == 'not' ? `(!${code_cond(c.a)})` : `(${code_expr(c.l)}${c.op}${code_expr(c.r)})`
const code_stmt = (s: stmt): string => {
    switch (s.k)
    {
    case 'assign': return `${s.name}=${code_expr(s.e)};`
    case 'if': return `if(${code_cond(s.c)}){ ${s.t.map(code_stmt).join('')} }else{ ${s.f.map(code_stmt).join('')} }`
    case 'while': return `while(${s.i}<${s.bound}){ ${s.s}=${s.s}+${s.i}; ${s.i}=${s.i}+1; }`
    }
}

//蜕变:交换律换序、常量折叠、if/else 翻转取反
const swap = (e: expr): expr => {
    switch (e.k)
    {
    case 'bin':
        if (e.op == '/' || e.op == '-' || e.op == '%')return {k: 'bin', op: e.op, l: swap(e.l), r: swap(e.r)}
        return {k: 'bin', op: e.op, l: swap(e.r), r: swap(e.l)}
    case 'intop': return e
    default: return e
    }
}
const fold = (e: expr): expr => {
    switch (e.k)
    {
    case 'bin':
    {
        const l = fold(e.l), r = fold(e.r)
        if (l.k == 'lit' && r.k == 'lit')
        {
            const a = l.v, b = r.v
            const v = e.op == '+' ? a + b : e.op == '-' ? a - b : a * b
            return {k: 'lit', v}
        }
        return {k: 'bin', op: e.op, l, r}
    }
    default: return e
    }
}
const negate = (c: cond): cond => ({k: 'not', a: c})

const gen_program = (seed: number): {body: string[]} => {
    const {rnd, pick, int_lit} = make_rnd(seed)
    const gen_expr = (depth: number): expr => {
        if (depth <= 0 || rnd() < 0.4)return rnd() < 0.5 ? {k: 'lit', v: int_lit()} : {k: 'var', name: pick(['x0', 'x1'])}
        if (rnd() < 0.3)return {k: 'intop', op: pick(int_ops), a: int_lit(), b: 1 + Math.floor(rnd() * 9)}
        return {k: 'bin', op: pick(bin_ops), l: gen_expr(depth - 1), r: gen_expr(depth - 1)}
    }
    const gen_cond = (depth: number): cond =>
        depth > 0 && rnd() < 0.25 ? {k: 'not', a: gen_cond(depth - 1)} : {k: 'cmp', op: pick(cmp_ops), l: gen_expr(1), r: gen_expr(1)}
    const gen_then = (): stmt[] => [
        {k: 'assign', name: 'x0', e: gen_expr(2)},
        {k: 'assign', name: 'x1', e: gen_expr(2)}
    ]
    const stmts: stmt[] = [
        {k: 'assign', name: 'x0', e: gen_expr(2)},
        {k: 'assign', name: 'x1', e: gen_expr(2)},
        {k: 'if', c: gen_cond(2), t: gen_then(), f: gen_then()},
        {k: 'while', s: 'x0', i: 'li0', bound: 1 + Math.floor(rnd() * 12)},
        {k: 'if', c: gen_cond(2), t: gen_then(), f: gen_then()},
        {k: 'assign', name: 'x1', e: gen_expr(2)}
    ]
    return {body: stmts}
}

//生成源码:做 if 翻转时把 then/else 互换并取反条件
const emit = (stmts: stmt[], mode: 'orig' | 'swap' | 'fold' | 'flip'): string => {
    const emit_stmt = (s: stmt): string => {
        switch (s.k)
        {
        case 'assign': return `${s.name}=${code_expr(mode == 'swap' ? swap(s.e) : mode == 'fold' ? fold(s.e) : s.e)};`
        case 'if':
        {
            const c = mode == 'swap' || mode == 'fold' ? s.c : mode == 'flip' ? negate(s.c) : s.c
            const t = mode == 'flip' ? s.f : s.t, f = mode == 'flip' ? s.t : s.f
            return `if(${code_cond(c)}){ ${t.map(emit_stmt).join('')} }else{ ${f.map(emit_stmt).join('')} }`
        }
        case 'while': return `while(${s.i}<${s.bound}){ ${s.s}=${s.s}+${s.i}; ${s.i}=${s.i}+1; }`
        }
    }
    const head = [
        'var x0:number=0; var x1:number=0;',
        'var li0:number=0;'
    ]
    return `public m:module{ public static main:number(){ ${head.join(' ')} ${stmts.map(emit_stmt).join(' ')} var r:number=x1; ${bit_checks()} return r; } }`
}
//把结果逐位打成 1/0 行,让文本通道能读到数字
const bit_checks = (): string => {
    const list: string[] = []
    for (let k = BITS - 1; k >= 0; --k)
        list.push(`if(((r>>${k})&1)==1)vm("in","shell",[oper:"output",id:0,data:"1"]);else vm("in","shell",[oper:"output",id:0,data:"0"]);`)
    return list.join('')
}

const bits_of = (v: number): string => {
    let s = ''
    for (let k = BITS - 1; k >= 0; --k)s += ((v >> k) & 1) == 1 ? '1' : '0'
    return s
}

describe('system/绝对一致性', () => {
    it('三路差分+蜕变变体+重复性', () => {
        let checked = 0
        for (const seed of [2, 5, 17, 400])
        {
            const {body} = gen_program(seed)
            const sources = {
                orig: emit(body, 'orig'),
                swap: emit(body, 'swap'),
                fold: emit(body, 'fold'),
                flip: emit(body, 'flip')
            }
            let base_bits: string | null = null
            for (const [name, src] of Object.entries(sources))
            {
                //重复性:同一 sbin 连跑三次必须逐字节一致
                const first = run_vm(src)
                const again = run_vm(src)
                expect(again, `重复运行不一致 seed=${seed} ${name}`).toEqual(first)
                const bits = first.join('')
                //三路:参考解释器 原始IR / 优化后IR 都要给出同一位串
                const ir = run_interp(ir_of(src))
                const opt = run_interp(opt_of(src))
                expect(ir, `参考解释器跑不了 seed=${seed} ${name}`).not.toBeNull()
                expect(opt, `参考解释器(优化后)跑不了 seed=${seed} ${name}`).not.toBeNull()
                expect(bits_of(ir!), `参考解释器(IR) 与 VM 不一致 seed=${seed} ${name}`).toBe(bits)
                expect(bits_of(opt!), `参考解释器(优化后) 与 VM 不一致 seed=${seed} ${name}`).toBe(bits)
                //蜕变:四个变体必须和原版逐位一致
                if (base_bits == null)base_bits = bits
                else expect(bits, `蜕变变体 ${name} 与原版不一致 seed=${seed}`).toBe(base_bits)
                ++checked
            }
        }
        expect(checked).toBe(16)
    }, 600000)

    it('函数调用与递归', () => {
        //模块登记、参数传递、返回值、递归帧:容器语义对齐后三路必须一致
        const cases: [string, string, string][] = [
            [
                'public m:module{ public static f:number(a:number){ return a+1; } public static main:number(){ {r} } }',
                'var z:number=f(3)*2;',
                'var z:number=2*f(3);'
            ],
            [
                'public m:module{ public static g:number(n:number){ if(n<=1)return 1; return n*g(n-1); } public static main:number(){ {r} } }',
                'var z:number=g(4);',
                'var z:number=g(2+2);'
            ],
            [
                'public m:module{ public static h:number(a:number,b:number){ return a*b-a; } public static main:number(){ {r} } }',
                'var z:number=h(5,3)+h(2,2);',
                'var z:number=h(2,2)+h(5,3);'
            ],
            [
                'public m:module{ public static f:number(a:number){ var b:number=a*a; if(b>4)b=b-1; return b; } public static main:number(){ {r} } }',
                'var z:number=f(3)+f(4);',
                'var z:number=f(4)+f(3);'
            ]
        ]
        for (const [tmpl, base, variant] of cases)
        {
            const bits: string[] = []
            for (const r of [base, variant])
            {
                const src = tmpl.replace('{r}', `${r} var r:number=z; ${bit_checks()} return r;`)
                const vm = run_vm(src).join('')
                const ir = run_interp(ir_of(src))
                const opt = run_interp(opt_of(src))
                expect(ir, `参考解释器跑不了 ${r}`).not.toBeNull()
                expect(opt, `参考解释器(优化后)跑不了 ${r}`).not.toBeNull()
                expect(bits_of(ir!), `参考解释器(IR) 与 VM 不一致 ${r}`).toBe(vm)
                expect(bits_of(opt!), `参考解释器(优化后) 与 VM 不一致 ${r}`).toBe(vm)
                bits.push(vm)
            }
            //蜕变:等价写法必须逐位一致
            expect(bits[1], `蜕变变体不一致 ${base}`).toBe(bits[0])
        }
    }, 300000)
})
