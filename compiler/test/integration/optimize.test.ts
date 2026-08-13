import { describe, expect, it } from 'vitest'
import { lexer } from '../../utils/lexer'
import cst_parse from '../../parser/cst'
import ast_parse from '../../parser/ast'
import { ast_data, BinMap, File } from '../../utils'
import check from '../../check'
import desugar from '../../desugar'
import hir from '../../hir'
import ir from '../../ir'
import optimize from '../../optimize'

//指令opcode区间:3参占8,2参占4
const W2 = ['mov', 'load', 'cz', 'jz', 'tz', 'in', 'out', 'param_set', 'param_load']
const RANGE = (name: string) => {
    const base = BinMap.get(name)!
    return [base, base + (W2.includes(name) ? 4 : 8)] as const
}
const in_range = (c: any, [lo, hi]: readonly [number, number]) => c && c[0] >= lo && c[0] < hi
const BS = BinMap.get('block_start')!
const BE = BinMap.get('block_end')!

function opt_bin(src: string, level = 0): any[] {
    const files = [ast_parse(cst_parse(lexer(src)) as ast_data) as File]
    check(files)
    const [count, h] = hir(<File[]>desugar(files))
    return optimize(ir(count, h), level)
}
const count_op = (bin: any[], name: string) => bin.filter((c: any) => in_range(c, RANGE(name))).length
//按block_start/block_end切块,返回块id→指令列表
function blocks(bin: any[]): Map<number, any[]> {
    const m = new Map<number, any[]>()
    let cur: number | null = null
    for (const c of bin) {
        if (!c) continue
        if (c[0] == BS) {
            cur = c[1]
            m.set(cur, [])
            continue
        }
        if (c[0] == BE) {
            cur = null
            continue
        }
        if (cur != null) m.get(cur)!.push(c)
    }
    return m
}

describe('optimize o1 优化', () => {
    it('常量折叠 1+2 消除 add', () => {
        const bin = opt_bin('public m:number(){return 1+2;}\n')
        expect(bin.some((c: any) => in_range(c, RANGE('add')))).toBe(false)
        expect(bin.some((c: any) => in_range(c, RANGE('load')))).toBe(true)
    })

    it('常量折叠链式 1+2+3 收敛为单 load', () => {
        const bin = opt_bin('public m:number(){return 1+2+3;}\n')
        const loads = bin.filter((c: any) => in_range(c, RANGE('load')))
        expect(loads.length).toBe(1)
    })

    it('常量比较 1<2 消除 cmp', () => {
        const bin = opt_bin('public m:boolean(){return 1<2;}\n')
        expect(bin.some((c: any) => in_range(c, RANGE('cmp')))).toBe(false)
        //返回值为常量1
        expect(bin.some((c: any) => in_range(c, RANGE('param_set')))).toBe(true)
    })

    it('常量取反 !false 消除 not', () => {
        const bin = opt_bin('public m:boolean(){return !false;}\n')
        expect(bin.some((c: any) => in_range(c, RANGE('not')))).toBe(false)
        expect(bin.some((c: any) => in_range(c, RANGE('load')))).toBe(true)
    })

    it('常量按位取反 ~0 消除 bit_not', () => {
        const bin = opt_bin('public m:number(){return ~0;}\n')
        expect(bin.some((c: any) => in_range(c, RANGE('bit_not')))).toBe(false)
        expect(bin.some((c: any) => in_range(c, RANGE('param_set')))).toBe(true)
    })

    it('字符串字面量 load 不被误删', () => {
        const bin = opt_bin('public m:string(){return "hi";}\n')
        expect(count_op(bin, 'load')).toBe(1)
        expect(bin.some((c: any) => in_range(c, RANGE('param_set')))).toBe(true)
    })

    it('参数运算不被折叠(return a+b)', () => {
        const bin = opt_bin('public m:number(a:number,b:number){return a+b;}\n')
        //参数值是运行期值,param_load 必须保留、add 不可折叠成 NaN
        expect(bin.some((c: any) => in_range(c, RANGE('param_load')))).toBe(true)
        expect(bin.some((c: any) => in_range(c, RANGE('add')))).toBe(true)
    })

    it('peephole a*1 消除 mul', () => {
        const bin = opt_bin('public m:number(a:number){return a*1;}\n')
        expect(bin.some((c: any) => in_range(c, RANGE('mul')))).toBe(false)
    })

    it('peephole a+0 消除 add', () => {
        const bin = opt_bin('public m:number(a:number){return a+0;}\n')
        expect(bin.some((c: any) => in_range(c, RANGE('add')))).toBe(false)
    })

    it('变量读写不被误删', () => {
        const bin = opt_bin('public m:number(){var a:number=5;return a;}\n')
        //定义a的load保留,param_set读取的槽有定义
        const loads = bin.filter((c: any) => in_range(c, RANGE('load')))
        expect(loads.length).toBeGreaterThan(0)
        expect(bin.some((c: any) => in_range(c, RANGE('param_set')))).toBe(true)
    })

    it('数组下标读取保留 offset_get', () => {
        const bin = opt_bin('public m:number(){var a:number[]=[1,2];return a[0];}\n')
        expect(bin.some((c: any) => in_range(c, RANGE('offset_get')))).toBe(true)
        expect(count_op(bin, 'offset_addr')).toBe(0)
    })
})

describe('optimize o2 块优化', () => {
    it('保留根块并删除未调用块', () => {
        const bin = opt_bin('public m:number(){return 1+2;}\n', 1)
        const bs = blocks(bin)
        expect(bs.has(0)).toBe(true)
        expect(bs.size).toBe(1)
    })

    it('static main 入口块保留', () => {
        const bin = opt_bin('public static main:void(){var x:number=1+2;}\n', 1)
        const bs = blocks(bin)
        expect(bs.has(0)).toBe(true)
    })

    it('if 分支块保留(参数条件运行期判定)', () => {
        const bin = opt_bin('public static main:void(x:number){if(x==1){return;}else{return;}}\n', 1)
        const bs = blocks(bin)
        //根块 + then分支 + else分支
        expect(bs.size).toBe(3)
        expect(bs.has(0)).toBe(true)
    })

    it('while 循环块保留', () => {
        const bin = opt_bin('public static main:void(x:number){while(x>0){x=x-1;}}\n', 1)
        const bs = blocks(bin)
        //根块 + 条件块 + 循环体块 + break块
        expect(bs.size).toBe(4)
        expect(bs.has(0)).toBe(true)
    })

    it('常量条件 if 只保留 then 分支', () => {
        const bin = opt_bin('public static main:number(){if(1==1){return 1;}else{return 2;}}\n', 1)
        const bs = blocks(bin)
        //根块 + then分支,else死分支被删除
        expect(bs.size).toBe(2)
        expect(bs.has(0)).toBe(true)
    })

    it('被调用函数块保留(call 目标跨块解析)', () => {
        const bin = opt_bin('public add:number(a:number,b:number){return a+b;}\npublic static main:number(){return add(1,2);}\n', 1)
        const bs = blocks(bin)
        //入口根块(main,含函数槽初始化) + add函数块;main的call跨块解析使add可达保留
        expect(bs.has(0)).toBe(true)
        expect(bs.size).toBe(2)
        //add函数体保留(含param_load)
        const add = [...bs.entries()].filter(([k]) => k != 0)[0]?.[1]
        expect(add?.some((c: any) => in_range(c, RANGE('param_load')))).toBe(true)
    })

    it('无入口调用时不可达函数全删(可达剪枝)', () => {
        const bin = opt_bin('public add:number(a:number,b:number){return a+b;}\npublic m:number(){return add(1,2);}\n', 1)
        const bs = blocks(bin)
        //根块不调用任何函数,m/add均不可达,全部删除
        expect(bs.has(0)).toBe(true)
        expect(bs.size).toBe(1)
    })

    it('函数槽初始化 load 跨块保留(根块非空)', () => {
        const bin = opt_bin('public add:number(a:number,b:number){return a+b;}\npublic m:number(){return add(1,2);}\n', 0)
        const root = blocks(bin).get(0)
        //根块含函数变量槽初始化load(槽=函数块id)
        expect(root?.some((c: any) => in_range(c, RANGE('load')))).toBe(true)
    })
})
