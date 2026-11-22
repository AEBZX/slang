import {describe, expect, it} from 'vitest'
import compile from '../../src/index'
import {run_to_check} from '../helpers'
import {NumberType} from '../../src/utils'

describe('check 管线集成: 合法程序', () => {
    it('类型标注写入 AST(VarDecl 的值表达式)', () => {
        const {files} = run_to_check('app: module { main: void() { var x: number = 1 + 2; } }')
        const module_block = files[0].children[0] as any
        const fn = module_block.children[0]
        const commands = fn.commands.commands
        expect(commands[0].value.type).toBeDefined()
    })

    it('call_target 写入调用节点', () => {
        const {files} = run_to_check('app: module { f: void() { } main: void() { f(); } }')
        const module_block = files[0].children[0] as any
        const fn = module_block.children[1]
        const expr = fn.commands.commands[0]
        expect(expr.data.call_target).toBe('app.f@0')
    })

    it('重载决议选择第二个重载并标注返回类型', () => {
        const {files} = run_to_check('app: module { f: void() { } f: number(a: number) { return a; } main: void() { var r: number = f(1); } }')
        const module_block = files[0].children[0] as any
        const fn = module_block.children[2]
        const decl = fn.commands.commands[0]
        expect(decl.value.call_target).toBe('app.f@1')
        expect(decl.value.type).toBeInstanceOf(NumberType)
    })
})

describe('check 管线集成: 错误路径', () => {
    it('check 错误以异常形式抛出且消息带 check 报错 前缀', () => {
        expect(() => compile(['app: module { main: void() { y = 1; } }'])).toThrow(/check 报错/)
    })
})
