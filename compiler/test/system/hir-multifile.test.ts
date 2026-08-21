//多文件/前向引用 HIR 回归:入口块移末尾 + 全部块符号预注册
//修复前:main.sl 引用 mathlib.sl 的函数时 scope.get 返回 null(HIdentifierExpr.name=null),
//IR 调用目标为 null → VM call 跳块0死循环;入口先于被调函数处理时槽加载晚于调用
import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import * as path from 'path'
import { lexer } from '../../utils/lexer'
import parser from '../../parser'
import check from '../../check'
import desugar from '../../desugar'
import hir from '../../hir'
import { HIdentifierExpr, HVariable } from '../../utils'

function compile_files(names: string[], codes: string[]) {
    const dir = mkdtempSync(path.join(tmpdir(), 'hir-mf-'))
    names.forEach((n, i) => writeFileSync(path.join(dir, n), codes[i]))
    const files = names.map(f => parser(lexer(require('fs').readFileSync(path.join(dir, f), 'utf-8'))) as any)
    check(files)
    const h = hir(desugar(files) as any[])
    rmSync(dir, { recursive: true, force: true })
    return h[1] as any[]
}

describe('多文件/前向引用 HIR', () => {
    it('跨文件函数引用不产生 null id', () => {
        const flat = compile_files(
            ['main.sl', 'mathlib.sl'],
            ['public static main:void(){var x:number=add(1,2);var y:number=fib(5);}\n',
             'public fib:number(n:number){return n;}\npublic add:number(a:number,b:number){return a+b;}\n'])
        const nulls: string[] = []
        const walk = (o: any) => {
            if (!o || typeof o !== 'object') return
            if (o.constructor?.name === 'HIdentifierExpr' && o.name == null) nulls.push('null')
            for (const k of Object.keys(o)) {
                const v = o[k]
                if (v instanceof Map) v.forEach(x => walk(x))
                else if (Array.isArray(v)) v.forEach(x => walk(x))
                else walk(v)
            }
        }
        for (const n of flat) walk(n)
        expect(nulls).toEqual([])
    })

    it('入口块(static main)位于扁平数组末尾,函数槽先加载', () => {
        //main.sl 在文件序前部:入口必须排到末尾,IR 根块才先加载函数槽再生成 main 体
        const flat = compile_files(
            ['main.sl', 'mathlib.sl'],
            ['public static main:void(){var x:number=add(1,2);}\n',
             'public add:number(a:number,b:number){return a+b;}\n'])
        const entryIdx = flat.findIndex(h => h instanceof HVariable && h.entry)
        expect(entryIdx).toBeGreaterThanOrEqual(0)
        expect(entryIdx).toBe(flat.length - 1)
        //被调函数 add 的槽 id 与 main 内引用一致
        const addSlot = (flat.find(h => h instanceof HVariable && !h.entry) as HVariable).name
        const refs: number[] = []
        const walk = (o: any) => {
            if (!o || typeof o !== 'object') return
            if (o.constructor?.name === 'HIdentifierExpr' && typeof o.name === 'number') refs.push(o.name)
            for (const k of Object.keys(o)) {
                const v = o[k]
                if (v instanceof Map) v.forEach(x => walk(x))
                else if (Array.isArray(v)) v.forEach(x => walk(x))
                else walk(v)
            }
        }
        walk(flat[entryIdx])
        expect(refs).toContain(addSlot)
    })
})
