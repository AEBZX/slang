//系统测试:把真实程序的产物整体解码一遍,每个字节都要有解释
import {describe, expect, it} from 'vitest'
import {decode, OPCODES} from '../sbin'
import {bin_of, ir_of, opt_of} from '../unit/helper-ir'
import {LOAD} from '../../src/utils'

const PROGRAMS: [string, string][] = [
    ['常量', 'public m:module{ public static f:number(a:number){ return 1+2*3; } }'],
    ['参数', 'public m:module{ public static f:number(a:number){ return a*2; } }'],
    ['分支', 'public m:module{ public static f:number(a:number){ if(a>0)return 1; else return 2; } }'],
    ['循环', 'public m:module{ public static f:number(a:number){ var s:number=0; while(a>0){ s=s+a; a=a-1; } return s; } }'],
    ['数组', 'public m:module{ public static f:number(a:number){ var d:number[]=[1,2]; d[0]=a; return d[1]; } }'],
    ['自增', 'public m:module{ public static f:number(a:number){ var b:number=1; b++; ++b; return b; } }'],
    ['switch', 'public m:module{ public static f:number(a:number){ switch(a){case 1=>a=10;default=>a=20;} return a; } }'],
    ['字符串', 'public m:module{ public static f:number(a:number){ var s:string="hi"; return a; } }'],
    ['调用', 'public m:module{ public static g:number(x:number){ return x; } public static f:number(a:number){ return g(a); } }'],
    ['多模块', 'public a:module{ public static v:number; } public b:module{ public static f:number(x:number){ return x; } }']
]

describe('system/sbin 解码', () => {
    for (const [name, src] of PROGRAMS) {
        it(name + ' 的产物能完整解码', () => {
            const bin = bin_of(src)
            const s = decode(bin)          // 解不干净会抛错
            expect(s.pool.size).toBe(opt_of(src).pool.size)
            expect(s.blocks.size).toBe(opt_of(src).command.size)
            expect(s.order.length).toBe(s.blocks.size)
        })

        it(name + ' 的每个操作码都在已知集合里', () => {
            const s = decode(bin_of(src))
            for (const [bid, list] of s.blocks)
                for (const ins of list)
                    expect(OPCODES.has(ins.opcode), `块 ${bid} 操作码 ${ins.opcode}`).toBe(true)
        })

        it(name + ' 的池 id 引用都成立', () => {
            const s = decode(bin_of(src))
            const ids = new Set(s.pool.keys())
            const tool = opt_of(src)
            //LOAD 的第一个操作数是源池 id
            for (const list of tool.command.values())
                for (const ir of list)
                    if (ir instanceof LOAD && ir.data.type == 'reg')
                        expect(ids.has(ir.data.data), `池 id ${ir.data.data}`).toBe(true)
        })
    }

    it('产物里的块数与优化后的指令流一致', () => {
        for (const [name, src] of PROGRAMS) {
            const s = decode(bin_of(src))
            expect(s.blocks.size, name).toBe(opt_of(src).command.size)
            //块号集合也一致(编码不合并、不丢块)
            expect(new Set(s.order), name).toEqual(new Set(opt_of(src).command.keys()))
        }
    }, 30000)

    it('产物大小等于头部 + 池 + 代码段之和', () => {
        for (const [name, src] of PROGRAMS) {
            const bin = bin_of(src)
            const s = decode(bin)
            const pool_bytes = [...s.pool.values()]
                .reduce((a, e) => a + 9 + (e.type == 1 ? 8 : Buffer.byteLength(e.value as string, 'utf-8')), 0)
            const code_bytes = [...s.blocks.values()].reduce((a, l) => a + 32 + l.length * 16, 0)
            const fixed = 'SLANG1.0.0'.length + 'POOL_START'.length + 'POOL_END'.length + 'CODE_START'.length
            expect(bin.length, name).toBe(fixed + pool_bytes + code_bytes)
        }
    })

    it('截断的产物会被解码器发现', () => {
        const bin = bin_of(PROGRAMS[0][1])
        expect(() => decode(bin.slice(0, bin.length - 1))).toThrow()
        expect(() => decode(bin.slice(0, 20))).toThrow()
    })

    it('改坏操作码会被解码器发现', () => {
        const bin = BinWithBadOpcode(PROGRAMS[0][1])
        expect(() => decode(bin)).toThrow(/未知操作码/)
    })
})

//把第一条指令的操作码改成明显非法的值
function BinWithBadOpcode(src: string): Buffer {
    const bin = Buffer.from(bin_of(src))
    const start = bin.indexOf('CODE_START') + 'CODE_START'.length
    bin.writeUInt32BE(0xFFFF, start + 16)
    return bin
}
