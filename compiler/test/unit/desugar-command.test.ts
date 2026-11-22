import {describe, expect, it} from 'vitest'
import {run_to_desugar} from '../helpers'
import {
    AAssign, AddExpression, GotoCommand, IfStatement, InequalExpression, LabelCommand,
    ListCommand, NullLiteral, Variable
} from '../../src/utils'

//跑管线到 desugar,取 main 函数 lambda 体里的语句列表
const desugar_body = (body: string) => {
    const desugared = run_to_desugar(`app: module { main: void() { ${body} } }`) as any
    const main_var = desugared[0].children[0].children[0] as Variable
    return main_var.value.body.commands
}

describe('desugar command: while 降糖', () => {
    it('while 展开为 label/goto/if 结构', () => {
        const commands = desugar_body('while (c) { }') as any[]
        const wl = commands[0] as ListCommand
        expect(wl).toBeInstanceOf(ListCommand)
        expect(wl.commands[0]).toBeInstanceOf(LabelCommand)
        expect(wl.commands[0].name).toBe('while')
        expect(wl.commands[3]).toBeInstanceOf(IfStatement)
        const cond = wl.commands[3].condition as InequalExpression
        expect(cond.op).toBe('!=')
        expect(cond.right).toBeInstanceOf(NullLiteral)
        expect(wl.commands[3].commands.name).toBe('while')
        expect(wl.commands[4]).toBeInstanceOf(LabelCommand)
        expect(wl.commands[4].name).toBe('break')
    })

    it('continue 降糖为 goto continue 标签', () => {
        const commands = desugar_body('while (c) { continue; }') as any[]
        const body = (commands[0] as ListCommand).commands[1] as ListCommand
        expect(body.commands[0]).toBeInstanceOf(GotoCommand)
        expect(body.commands[0].name).toBe('continue')
    })

    it('break 降糖为 goto break 标签', () => {
        const commands = desugar_body('while (c) { break; }') as any[]
        const body = (commands[0] as ListCommand).commands[1] as ListCommand
        expect(body.commands[0]).toBeInstanceOf(GotoCommand)
        expect(body.commands[0].name).toBe('break')
    })
})

describe('desugar command: 赋值降糖', () => {
    it('VarDecl 降糖为 AAssign', () => {
        const commands = desugar_body('var x: number = 1 + 2;') as any[]
        expect(commands[0]).toBeInstanceOf(AAssign)
        expect(commands[0].data.name).toBe('x')
        expect(commands[0].value.op).toBe('+')
    })

    it('无重载的乘法赋值保留原表达式节点', () => {
        const commands = desugar_body('var x: number = 1; x = x * 3;') as any[]
        expect(commands[1].value.op).toBe('*')
        expect(commands[1].value.left.name).toBe('x')
    })
})

describe('desugar command: do-while 降糖', () => {
    it('do-while 先体后条件且 continue 落在条件前', () => {
        const commands = desugar_body('do { x = 1; } while (c);') as any[]
        //结构: 体(一次) + while(体, 条件),两者的 while 结构在嵌套 ListCommand 里
        expect(commands[0]).toBeInstanceOf(ListCommand)
        //D_DoWhile 的 ListCommand 再包一层: [体, while 结构]
        const while_part = (commands[0] as ListCommand).commands[1] as ListCommand
        expect(while_part.commands[0]).toBeInstanceOf(LabelCommand)
        expect(while_part.commands[0].name).toBe('while')
    })
})

describe('desugar command: 表达式语句', () => {
    it('表达式语句降糖为对哑变量的赋值', () => {
        const commands = desugar_body('x;') as any[]
        const expr_cmd = commands[0] as AAssign
        expect(expr_cmd.data.name).toBe(';Im air')
    })
})
