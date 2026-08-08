import { describe, expect, it } from 'vitest'
import { lexer } from '../../utils/lexer'
import cst_parse from '../../parser/cst'
import ast_parse from '../../parser/ast'
import { ast_data, File } from '../../utils'
import check from '../../check'
import desugar from '../../desugar'
import hir from '../../hir'
import ir from '../../ir'

function ir_of(src: string): { count: number; code: Map<number, [any[], number[]]>; h: any[] } {
    const files = [ast_parse(cst_parse(lexer(src)) as ast_data) as File]
    check(files)
    const [count, h] = hir(<File[]>desugar(files))
    return { count, code: ir(count, h).code, h }
}

function body_blocks(src: string): any[] {
    // 返回所有非根块(block 0 是根)
    const r = ir_of(src)
    return [...r.code.entries()].filter(([k]) => k !== 0)
}

describe('IR 字节码生成', () => {
    it('算术表达式生成 load/add/ret', () => {
        const blocks = body_blocks('public m:number(){return 1+2;}\n')
        // 只有一个函数块
        expect(blocks.length).toBe(1)
        const cmds = blocks[0][1][0]
        expect(cmds.some((c: any) => c[0] == 'load')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'add')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'param_set')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'ret')).toBe(true)
    })

    it('函数定义生成独立块并加载参数', () => {
        const blocks = body_blocks('public add:number(a:number,b:number){return a+b;}\n')
        expect(blocks.length).toBe(1)
        const [cmds, params] = blocks[0][1]
        // 两个参数
        expect(params.length).toBe(2)
        expect(cmds.some((c: any) => c[0] == 'param_load')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'add')).toBe(true)
    })

    it('变量声明与读取生成 mov', () => {
        const blocks = body_blocks('public m:number(){var x:number=5;return x;}\n')
        expect(blocks.length).toBe(1)
        const cmds = blocks[0][1][0]
        expect(cmds.some((c: any) => c[0] == 'mov')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'load')).toBe(true)
    })

    it('生成结果含常量池和根块', () => {
        const r = ir_of('public m:number(){return 1+2;}\n')
        expect(r.code.has(0)).toBe(true)
        expect(r.count).toBeGreaterThan(0)
    })

    it('字符串字面量生成 load/ret', () => {
        const blocks = body_blocks('public m:string(){return "hi";}\n')
        const cmds = blocks[0][1][0]
        expect(cmds.some((c: any) => c[0] == 'load')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'param_set')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'ret')).toBe(true)
    })

    it('比较运算符生成 cmp', () => {
        const blocks = body_blocks('public m:boolean(a:number,b:number){return a>b;}\n')
        const cmds = blocks[0][1][0]
        expect(cmds.some((c: any) => c[0] == 'cmp')).toBe(true)
    })

    it('取反生成 not', () => {
        const blocks = body_blocks('public m:boolean(a:boolean){return !a;}\n')
        const cmds = blocks[0][1][0]
        expect(cmds.some((c: any) => c[0] == 'not')).toBe(true)
    })

    it('static main 标记入口且 lambda 块为 id 0', () => {
        const r = ir_of('public static main:void(){var x:number=1;}\n')
        // HIR 的 HVariable entry=true
        expect(r.h.some((e: any) => e.entry)).toBe(true)
        // main 的 lambda 块独占 id 0(含 main 的 body 指令)
        expect(r.code.has(0)).toBe(true)
        const cmds = r.code.get(0)![0]
        expect(cmds.length).toBeGreaterThan(0)
    })

    it('非 static main 不标记入口', () => {
        const r = ir_of('public main:void(){}\n')
        expect(r.h.some((e: any) => e.entry)).toBe(false)
    })

    it('map 字面量 [k:v] 生成 offset_set', () => {
        const blocks = body_blocks('public foo:void(){var m:number{}= [a:1];}\n')
        const cmds = blocks[0][1][0]
        expect(cmds.some((c: any) => c[0] == 'offset_set')).toBe(true)
    })

    it('类生成构造块,含成员初始化与返回 this', () => {
        const blocks = body_blocks('public A:class{public f:number(){return 1;}}\n')
        // 类块 + 成员方法块
        expect(blocks.length).toBe(2)
        const clsBlock = blocks.find(([k]) => (k as number) != 0 && blocks.indexOf(blocks.find(b => b[1][0].some((c: any) => c[0] == 'offset_set')))!=-1)
        // 构造块含 offset_set(成员初始化)和 ret
        const clsCmds = blocks.find(([, v]) => v[0].some((c: any) => c[0] == 'offset_set'))?.[1][0]
        expect(clsCmds?.some((c: any) => c[0] == 'offset_set')).toBe(true)
        expect(clsCmds?.some((c: any) => c[0] == 'ret')).toBe(true)
    })
})
