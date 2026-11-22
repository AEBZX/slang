import {describe, expect, it} from 'vitest'
import {run_to_hir} from '../helpers'
import {HGoto, HLabel, HModule, HVariable} from '../../src/utils'

//跑到 hir,取 main 的 lambda 体语句列表
const hir_body = (body: string) => {
    const [, hir_modules] = run_to_hir(`app: module { main: void() { ${body} } }`) as any
    const main_fn = hir_modules[0].children[0].children[0] as any
    return main_fn.value.commands.commands
}

describe('hir label: 预扫描与块号', () => {
    it('HLabel 与 HGoto 共享同一块号(前向引用)', () => {
        const commands = hir_body('goto skip; skip: var x: number = 1;') as any[]
        const goto = commands[0] as HGoto
        const label = commands[1] as HLabel
        expect(goto).toBeInstanceOf(HGoto)
        expect(label).toBeInstanceOf(HLabel)
        expect(goto.label).toBe(label.name)
        expect(goto.label).toBeGreaterThan(0)
    })

    it('同函数内两个 label 块号不同', () => {
        const commands = hir_body('goto a; a: goto b; b: var x: number = 1;') as any[]
        expect(commands[0].label).not.toBe(commands[2].label)
    })
})

describe('hir label: HVariable 的全局槽与 entry', () => {
    it('main 的 entry 标记为真', () => {
        const [, hir_modules] = run_to_hir('app: module { main: void() { } }') as any
        const app = hir_modules[0].children[0]
        const main_var = app.children[0] as HVariable
        expect(main_var).toBeInstanceOf(HVariable)
        expect(main_var.entry).toBe(true)
    })

    it('语句列表为数组(每元素一条 H 命令)', () => {
        const commands = hir_body('var x: number = 1;') as any[]
        expect(Array.isArray(commands)).toBe(true)
        expect(commands[0].data.name).toBeGreaterThan(0)
    })

    it('顶层是 HModule 树', () => {
        const [, hir_modules] = run_to_hir('app: module { }') as any
        expect(hir_modules[0]).toBeInstanceOf(HModule)
    })
})
