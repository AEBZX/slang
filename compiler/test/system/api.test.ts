//系统测试:走公开 API(compiler/src/index.ts)的完整编译链路
import {afterAll, describe, expect, it} from 'vitest'
import {readFileSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import compile from '../../src'

const SRC = ['public m:module{ public static f:number(a:number){ var b:number=a+1*2; if(b>3)b=0; return b; } }']
const ROUNDS = ['lexer', 'parser', 'check', 'desugar', 'hir', 'ir', 'optimize', 'generate']
const paths: string[] = []
function out(name: string) {
    const p = join(tmpdir(), `slang-api-${name}-${process.pid}.sbin`)
    paths.push(p)
    return p
}

describe('system/api·公开编译入口', () => {
    afterAll(() => {
        for (const p of paths) rmSync(p, {force: true})
    })

    it('能编出字节码文件并返回产物', () => {
        const local = out('basic')
        const ret: any = compile(SRC, local)
        const buf = readFileSync(local)
        expect(buf.toString('latin1').startsWith('SLANG1.0.0')).toBe(true)
        expect(buf.length).toBeGreaterThan(0)
        expect(Buffer.isBuffer(ret)).toBe(true)
        expect(ret.length).toBe(buf.length)
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
        compile(SRC, out('spy'), [spy])
        expect(seen).toEqual(ROUNDS)
    })

    it('插件拿到的是 8 个工具,顺序固定', () => {
        let names: string[] = []
        const look = (tools: any[]) => {
            names = tools.map(t => t.name)
            return tools
        }
        compile(SRC, out('names'), [look])
        expect(names).toEqual(ROUNDS)
    })

    it('插件原样返回时产物与不使用插件完全一致', () => {
        const a = out('plain')
        const b = out('ident')
        compile(SRC, a)
        compile(SRC, b, [tools => tools])
        expect(readFileSync(b).equals(readFileSync(a))).toBe(true)
    })

    it('多次插件会依次执行', () => {
        const order: number[] = []
        compile(SRC, out('multi'), [tools => (order.push(1), tools), tools => (order.push(2), tools)])
        expect(order).toEqual([1, 2])
    })

    it('同一程序两次编译产物一致', () => {
        const a = out('det1')
        const b = out('det2')
        compile(SRC, a)
        compile(SRC, b)
        expect(readFileSync(b).equals(readFileSync(a))).toBe(true)
    })

    it('多文件输入会一起参与编译', () => {
        const local = out('multi-file')
        const ret: any = compile([
            'public a:module{ public static v:number; }',
            'public b:module{ public static f:number(x:number){ return x; } }'
        ], local)
        expect(ret.length).toBeGreaterThan(0)
        expect(readFileSync(local).toString('latin1').startsWith('SLANG1.0.0')).toBe(true)
    })
})
