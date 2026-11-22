import {describe, expect, it} from 'vitest'
import {run_to_ir} from '../helpers'
import {JMP, MOV} from '../../src/utils'

describe('ir 管线集成', () => {
    it('block 0 含 bootstrap JMP(经 main 槽间接)', () => {
        const tool = run_to_ir('app: module { main: void() { } }') as any
        const bootstrap = tool.code.get(0).find((i: any) => i.constructor.name === 'JMP')
        expect(bootstrap).toBeDefined()
        expect(bootstrap.target.type).toBe('value')
        expect(tool.entry_id).toBe(bootstrap.target.data)
    })

    it('lambda 体在独立块中', () => {
        const tool = run_to_ir('app: module { main: void() { var x: number = 1; } }') as any
        const body_blocks = [...tool.code.keys()].filter(bid => bid !== 0)
        expect(body_blocks.length).toBeGreaterThanOrEqual(1)
        const all_ins = [...tool.code.values()].flat()
        expect(all_ins.some((i: any) => i instanceof MOV)).toBe(true)
    })
})
