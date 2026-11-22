import {describe, expect, it} from 'vitest'
import {run_to_generate} from '../helpers'

describe('generate: 二进制结构', () => {
    it('头为 SLANG 魔数 + bzx-ins1 版本', () => {
        const buf = run_to_generate('app: module { main: void() { } }')
        expect(buf.subarray(0, 5).toString()).toBe('SLANG')
        expect(buf.subarray(5, 13).toString()).toBe('bzx-ins1')
    })

    it('含 POOL_START/POOL_END 与 CODE_START/CODE_END 标记', () => {
        const buf = run_to_generate('app: module { main: void() { var x: number = 5; } }')
        const text = buf.toString('latin1')
        expect(text).toContain('POOL_START')
        expect(text).toContain('POOL_END')
        expect(text).toContain('CODE_START')
        expect(text).toContain('CODE_END')
        expect(text).toContain('BLOCK_START')
        expect(text).toContain('BLOCK_END')
    })

    it('常量池收录字面量', () => {
        const buf = run_to_generate('app: module { main: void() { var x: number = 42; } }')
        //POOL_START 后的第一个 u32BE 即常量 42
        const pool_start = buf.indexOf('POOL_START') + 'POOL_START'.length
        expect(buf.readUInt32BE(pool_start)).toBe(42)
    })

    it('指令为 16 字节对齐(块内指令数 × 16 = 块长)', () => {
        const buf = run_to_generate('app: module { main: void() { } }')
        //第一个 BLOCK_START 之后的 u32BE 是块号,其后紧跟指令流直到 BLOCK_END
        const bs = buf.indexOf('BLOCK_START') + 'BLOCK_START'.length
        const block_id = buf.readUInt32BE(bs)
        expect(block_id).toBe(0)
        const next_end = buf.indexOf('BLOCK_END', bs)
        const ins_bytes = next_end - (bs + 4)
        expect(ins_bytes % 16).toBe(0)
    })
})
