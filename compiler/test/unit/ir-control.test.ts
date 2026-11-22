import {describe, expect, it} from 'vitest'
import {run_to_ir} from '../helpers'
import {CZ, GotoCommand as IrGoto, JMP, MOV, NOT} from '../../src/utils'

const ir_blocks = (src: string) => {
    const tool = run_to_ir(src) as any
    return [...tool.code.entries()].map(([bid, ins]) => ({bid, ins}))
}
const main_blocks = (src: string) => ir_blocks(`app: module { main: ()=>void = ()=>void { ${src} }; }`).filter(b => b.bid > 0)

describe('ir control: goto/label 块结构', () => {
    it('goto 与 label 落在同一块号', () => {
        const blocks = main_blocks('goto skip; skip: var x: number = 1;')
        const all = blocks.flatMap(b => b.ins)
        const gotos = all.filter(i => i instanceof IrGoto || i.constructor.name === 'JMP')
        //goto 与 label 边界各产生一条 JMP
        expect(gotos.length).toBe(2)
        expect(gotos[0].target.data).toBe(gotos[1].target.data)
    })

    it('label 边界封块并开新块', () => {
        const blocks = main_blocks('goto skip; skip: var x: number = 1;')
        //lambda 体至少两个块(前段 + label 新块)
        expect(blocks.length).toBeGreaterThanOrEqual(2)
    })
})

describe('ir control: if 的 CZ/NOT/CZ 编排', () => {
    it('if 产生 then 块与 else 块的两个条件调用', () => {
        const blocks = main_blocks('var x: number = 1; if (x) { x = 2; }')
        const all = blocks.flatMap(b => b.ins)
        const czs = all.filter(i => i instanceof CZ)
        expect(czs.length).toBe(2)
        const nots = all.filter(i => i instanceof NOT)
        expect(nots.length).toBe(1)
    })
})

describe('ir control: while 的循环结构', () => {
    it('while 产生条件跳转回环', () => {
        const blocks = main_blocks('var x: number = 1; while (x) { x = x - 1; }')
        const all = blocks.flatMap(b => b.ins)
        //条件(x != null) 的 != 编码为 BINARY 之外的 UB 槽,但 NOT/CZ 链必须存在
        const czs = all.filter(i => i instanceof CZ)
        expect(czs.length).toBe(2)
        const nots = all.filter(i => i instanceof NOT)
        expect(nots.length).toBe(1)
        //无条件 JMP 存在(回环或继续)
        const jmps = all.filter(i => i.constructor.name === 'JMP' || (i as any).constructor === (new JMP(null as any) as any).constructor)
        expect(jmps.length).toBeGreaterThan(0)
    })
})
