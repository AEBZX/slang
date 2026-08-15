import { describe, expect, it } from 'vitest'
import compile from '../../index'

//新导出格式:{BIN,POOL}
//  POOL: Map<number, number|string> 常量池(id->值)
//  BIN : 指令数组,每条为[opcode,a,b,c] 4元组,block_start/block_end 均真实输出
describe('compiler 字节码导出', () => {
    it('返回 {BIN,POOL},POOL 含字符串常量,首指令为 block_start(156)', () => {
        const { BIN, POOL } = compile(['public static main:string(){return "hi";}\n'], 0)
        //常量池:字符串 "hi" 已收录
        expect(POOL).toBeInstanceOf(Map)
        expect(POOL.size).toBeGreaterThan(0)
        expect([...POOL.values()]).toContain('hi')
        //命令段:入口块以 block_start(opcode=156) 开头
        expect(BIN.length).toBeGreaterThan(0)
        expect(BIN[0]).toEqual([156, 0, 0, 0])
    })
    it('数字常量以 number 值存入 POOL', () => {
        const { POOL } = compile(['public static main:number(){return 1+2;}\n'], 0)
        expect([...POOL.values()].some(v => typeof v == 'number')).toBe(true)
    })
    it('BIN 每条指令均为 4 元组,无 null 占位', () => {
        const { BIN } = compile(['public static main:number(){return 1+2;}\n'], 0)
        expect(BIN.length).toBeGreaterThan(0)
        for (const c of BIN) {
            expect(c).toHaveLength(4)
            for (const n of c) expect(n).toBeTypeOf('number')
        }
    })
    it('BIN 结尾为真实 block_end 指令(158)', () => {
        const { BIN } = compile(['public static main:number(){return 1+2;}\n'], 0)
        expect(BIN[BIN.length - 1]).toEqual([158, 0, 0, 0])
    })
})
