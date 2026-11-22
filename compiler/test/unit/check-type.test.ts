import {describe, expect, it} from 'vitest'
import {run_to_check} from '../helpers'
import {NumberType, ListCommand, BinaryExpression, ReferenceType} from '../../src/utils'

const body_commands = (body: string) => {
    const {files} = run_to_check(`app: module { main: void() { ${body} } }`)
    const module_block = files[0].children[0] as any
    const fn = module_block.children[0]
    const commands = fn.commands
    return commands instanceof ListCommand ? commands.commands : [commands]
}

describe('check type 轮: 类型标注', () => {
    it('变量声明的值表达式被标注 number', () => {
        const [decl] = body_commands('var x: number = 1 + 2;') as any[]
        expect(decl.value.type).toBeInstanceOf(NumberType)
    })

    it('乘法表达式标注 number', () => {
        const commands = body_commands('var x: number = 1; x = x * 3;') as any[]
        const assign = commands[1]
        expect(assign.value).toBeInstanceOf(BinaryExpression)
        expect(assign.value.type).toBeInstanceOf(NumberType)
        expect(assign.value.op).toBe('*')
    })

    it('标识符经引用包装后仍可解析到声明类型', () => {
        const commands = body_commands('var x: number = 1; var y: number = x;') as any[]
        const y_decl = commands[1]
        //标识符类型是引用包装(设计行为):剥引用后为声明类型
        expect(y_decl.value.type).toBeInstanceOf(ReferenceType)
    })

    it('直接函数调用的重载决议写出 call_target', () => {
        const {files} = run_to_check('app: module { f: number(a: number) { return a; } main: void() { var r: number = f(1); } }')
        const module_block = files[0].children[0] as any
        const main_fn = module_block.children[1]
        const decl = main_fn.commands.commands[0]
        expect(decl.value.call_target).toBe('app.f@0')
        expect(decl.value.type).toBeInstanceOf(NumberType)
    })

    it('成员调用的重载决议写出 call_target', () => {
        const {files} = run_to_check('app: module { util: module { f: void() { } } main: void() { util.f(); } }')
        const module_block = files[0].children[0] as any
        const main_fn = module_block.children[1]
        const expr_stmt = main_fn.commands.commands[0]
        expect(expr_stmt.data.call_target).toBe('app.util.f@0')
    })
})
