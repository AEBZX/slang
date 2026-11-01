//集成:编译器入口(src/index.ts),含插件机制
import {describe, expect, it} from 'vitest'
import compile from '../../src/index'
import PeepholeTool from '../../src/utils/lib/tool'

const SRC = `public m:module{
    public static f:number(a:number){
        var b:number=a+1;
        if(b>2)b=2;
        return b;
    }
}`

describe('compiler/入口', () => {
    it('跑完整条流水线并返回 sbin 产物', () => {
        const buf = compile([SRC]) as Buffer
        expect(Buffer.isBuffer(buf)).toBe(true)
        expect(buf.toString('latin1').startsWith('SLANG1.0.0')).toBe(true)
        expect(buf.length).toBeGreaterThan('SLANG1.0.0'.length + 4)
    })

    it('入口对外的形状:源码数组 + 可选插件数组', () => {
        //多文件编译不报错
        const other = `public n:module{ public static g:number(x:number){ return x; } }`
        const buf = compile([SRC, other]) as Buffer
        expect(buf.length).toBeGreaterThan(0)
    })
})

describe('compiler/插件机制', () => {
    it('插件能拿到完整工具链', () => {
        let seen: string[] = []
        compile([SRC], [(tools) => {
            seen = tools.map(t => t?.name)
            return tools
        }])
        expect(seen).toEqual(['lexer', 'parser', 'check', 'desugar', 'hir', 'ir', 'optimize', 'generate'])
    })

    it('插件可以替换某一级(这里把 generate 换成桩)', () => {
        class Stub extends PeepholeTool {
            constructor() {
                super('generate')
            }
            run(_param: any) {
                return 'STUB'
            }
        }
        const out = compile([SRC], [(tools) => {
            tools[7] = new Stub()
            return tools
        }])
        expect(out).toBe('STUB')
    })
})
