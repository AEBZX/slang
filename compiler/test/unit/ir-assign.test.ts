import {describe, expect, it} from 'vitest'
import {run_to_ir} from '../helpers'
import {BINARY, MOV} from '../../src/utils'

//跑到 ir,取 main lambda 的指令数组(block id 大于 bootstrap 块的那个)
const ir_blocks = (src: string) => {
    const tool = run_to_ir(src) as any
    return [...tool.code.entries()].map(([bid, ins]) => ({bid, ins}))
}

const main_body_blocks = (src: string) => {
    const blocks = ir_blocks(`app: module { main: ()=>void = ()=>void { ${src} }; }`)
    return blocks.filter(b => b.bid > 0).sort((a, b) => a.bid - b.bid)
}

describe('ir assign: 赋值指令模式', () => {
    it('x = 1 产生 MOV 与间接写', () => {
        const blocks = main_body_blocks('var x: number = 1;')
        const body_ins = blocks[0].ins
        const movs = body_ins.filter(i => i instanceof MOV)
        expect(movs.length).toBeGreaterThanOrEqual(2)
        //间接写: MOV(value(地址槽), value/right)
        const indirect = body_ins.find(i => i instanceof MOV && i.left.type === 'value')
        expect(indirect).toBeDefined()
    })

    it('x = x + 1 产生 BINARY.add 与地址间接写', () => {
        const blocks = main_body_blocks('var x: number = 1; x = x + 1;')
        const all = blocks.flatMap(b => b.ins)
        const binary = all.filter(i => i instanceof BINARY && i.id === 'add')
        expect(binary.length).toBeGreaterThan(0)
        const indirect = all.find(i => i instanceof MOV && i.left.type === 'value')
        expect(indirect).toBeDefined()
    })
})

describe('ir assign: 同一变量的槽复用', () => {
    it('两次赋值写同一变量槽', () => {
        const blocks = main_body_blocks('var x: number = 1; x = 2;')
        const all = blocks.flatMap(b => b.ins)
        const indirect_writes = all.filter(i => i instanceof MOV && i.left.type === 'value')
        expect(indirect_writes.length).toBe(2)
        //每次间接写前都有 MOV(地址槽, reg(变量槽)) 填地址,两次的源变量槽相同
        const addr_sources = indirect_writes.map(w => {
            const fill = all.find(i => i instanceof MOV && i.left.type === 'reg' && i.left.data === (w as MOV).left.data && i !== w)
            return (fill as MOV).right.data
        })
        expect(addr_sources[0]).toBe(addr_sources[1])
    })
})
