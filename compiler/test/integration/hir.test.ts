import {describe, expect, it} from 'vitest'
import {run_to_hir} from '../helpers'
import {HGoto, HLabel, HVariable} from '../../src/utils'

describe('hir 管线集成', () => {
    it('HModule 树与 main 的 entry 标记', () => {
        const [, hir_modules] = run_to_hir('app: module { main: void() { } }') as any
        const root = hir_modules[0]
        expect(root.name).toBe(-1)
        const app = root.children[0]
        expect(app.name).toBeGreaterThan(0)
        expect((app.children[0] as HVariable).entry).toBe(true)
    })

    it('前向 goto 的 HGoto 与 HLabel 块号一致', () => {
        const [, hir_modules] = run_to_hir('app: module { main: void() { goto skip; skip: var x: number = 1; } }') as any
        const commands = hir_modules[0].children[0].children[0].value.commands.commands
        expect(commands[0]).toBeInstanceOf(HGoto)
        expect(commands[1]).toBeInstanceOf(HLabel)
        expect(commands[0].label).toBe(commands[1].name)
    })
})
