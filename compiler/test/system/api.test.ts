//系统测试:走公开 API(compiler/src/index.ts)的完整编译链路
//新 API:compile(源码, 插件) 直接返回 Buffer,不落盘(生成器不再写文件)
import {describe, expect, it} from 'vitest'
import compile from '../../src'

const SRC = ['public m:module{ public static f:number(a:number){ var b:number=a+1*2; if(b>3)b=0; return b; } }']
const ROUNDS = ['lexer', 'parser', 'check', 'desugar', 'hir', 'ir', 'optimize', 'generate']

describe('system/api·公开编译入口', () => {
    it('返回字节码产物', () => {
        const ret: any = compile(SRC)
        expect(Buffer.isBuffer(ret)).toBe(true)
        expect(ret.toString('latin1').startsWith('SLANG1.0.0')).toBe(true)
        expect(ret.length).toBeGreaterThan('SLANG1.0.0'.length + 4)
    })

    it('插件按注册顺序看到全部轮次', () => {
        const seen: string[] = []
        const spy = (tools: any[]) => {
            for (const t of tools) {
                const orig = t.run.bind(t)
                t.run = (data: any) => {
                    seen.push(t.name)
                    return orig(data)
                }
            }
            return tools
        }
        compile(SRC, [spy])
        expect(seen).toEqual(ROUNDS)
    })

    it('插件拿到的是 8 个工具,顺序固定', () => {
        let names: string[] = []
        const look = (tools: any[]) => {
            names = tools.map(t => t.name)
            return tools
        }
        compile(SRC, [look])
        expect(names).toEqual(ROUNDS)
    })

    it('插件原样返回时产物与不使用插件完全一致', () => {
        const plain: any = compile(SRC)
        const ident: any = compile(SRC, [tools => tools])
        expect(ident.equals(plain)).toBe(true)
    })

    it('多次插件会依次执行', () => {
        const order: number[] = []
        compile(SRC, [tools => (order.push(1), tools), tools => (order.push(2), tools)])
        expect(order).toEqual([1, 2])
    })

    it('同一程序两次编译产物一致', () => {
        const a: any = compile(SRC)
        const b: any = compile(SRC)
        expect(b.equals(a)).toBe(true)
    })

    it('有诊断时直接抛错,不产出字节码', () => {
        expect(() => compile(['public m:module{ public static f:number(a:number){ return zzz; } }']))
            .toThrow(/check 报错/)
    })

    it('诊断里带着行号列号', () => {
        let msg = ''
        try { compile(['public m:module{\n public static f:number(a:number){\n  return zzz; } }']) }
        catch (e: any) { msg = e.message }
        expect(msg).toMatch(/at line:\d+:\d+/)
    })

    it('多文件输入会一起参与编译', () => {
        const ret: any = compile([
            'public a:module{ public static v:number; }',
            'public b:module{ public static f:number(x:number){ return x; } }'
        ])
        expect(Buffer.isBuffer(ret)).toBe(true)
        expect(ret.toString('latin1').startsWith('SLANG1.0.0')).toBe(true)
    })
})
