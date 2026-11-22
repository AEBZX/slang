import {describe, expect, it} from 'vitest'
import {run_to_generate} from '../helpers'

describe('generate 管线集成', () => {
    it('出码含完整二进制标记链', () => {
        const buf = run_to_generate('app: module { main: void() { } }')
        const text = buf.toString('latin1')
        for (const mark of ['SLANG', 'bzx-ins1', 'POOL_START', 'POOL_END', 'CODE_START', 'BLOCK_START', 'BLOCK_END', 'CODE_END'])
            expect(text).toContain(mark)
    })

    it('字面量进常量池', () => {
        const buf = run_to_generate('app: module { main: void() { var x: number = 77; } }')
        const pool_start = buf.indexOf('POOL_START') + 'POOL_START'.length
        expect(buf.readUInt32BE(pool_start)).toBe(77)
    })
})
