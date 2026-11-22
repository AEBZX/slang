import {describe, expect, it} from 'vitest'
import {run_to_hir} from '../helpers'
import {HAssign, HIdentifierExpr, HModule, HNumberLiteral, HVariable} from '../../src/utils'

//跑到 hir,取 main 体的语句数组
const hir_body = (body: string) => {
    const [, hir_modules] = run_to_hir(`app: module { main: void() { ${body} } }`) as any
    const main_var = hir_modules[0].children[0].children[0] as HVariable
    return {main_var, commands: main_var.value.commands.commands}
}

describe('hir variable: 懒分配槽', () => {
    it('首次赋值分配槽号并写入 HIdentifierExpr', () => {
        const {commands} = hir_body('var x: number = 1; x = 2;')
        expect(commands[0].data).toBeInstanceOf(HIdentifierExpr)
        expect(commands[0].data.name).toBeGreaterThan(0)
    })

    it('同名变量复用同一槽', () => {
        const {commands} = hir_body('var x: number = 1; x = 2;')
        const first_slot = commands[0].data.name
        expect(commands[1].data.name).toBe(first_slot)
        expect(commands[1].data).toBeInstanceOf(HIdentifierExpr)
    })

    it('不同变量得到不同槽', () => {
        const {commands} = hir_body('var x: number = 1; var y: number = 2;')
        expect(commands[0].data.name).not.toBe(commands[1].data.name)
    })

    it('数字字面量保留在 HNumberLiteral', () => {
        const {commands} = hir_body('var x: number = 1;')
        expect(commands[0].value).toBeInstanceOf(HNumberLiteral)
    })
})

describe('hir variable: entry 与 HModule 树', () => {
    it('main@0 形式的函数同样标记 entry', () => {
        const [, hir_modules] = run_to_hir('app: module { main: void() { } }') as any
        const app = hir_modules[0].children[0]
        expect(app).toBeInstanceOf(HModule)
        expect((app.children[0] as HVariable).entry).toBe(true)
    })

    it('赋值语句为 HAssign', () => {
        const {commands} = hir_body('var x: number = 1;')
        expect(commands[0]).toBeInstanceOf(HAssign)
    })
})
