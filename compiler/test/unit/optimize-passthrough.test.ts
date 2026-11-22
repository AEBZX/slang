import {describe, expect, it} from 'vitest'
import optimizeInst from '../../src/optimize'
import {run_to_ir} from '../helpers'

//在同一个 IRTool 上执行 optimize,验证透传
const optimize_same = (src: string) => {
    const ir_tool = run_to_ir(src) as any
    const opt_tool = optimizeInst.run(ir_tool) as any
    return {ir_tool, opt_tool}
}

describe('optimize: 透传行为', () => {
    it('OPTTool 与 IRTool 共享同一 code 映射', () => {
        const {ir_tool, opt_tool} = optimize_same('app: module { main: void() { var x: number = 1; } }')
        expect(opt_tool.code).toBe(ir_tool.code)
    })

    it('常量池原样保留', () => {
        const {ir_tool, opt_tool} = optimize_same('app: module { main: void() { var x: number = 5; } }')
        expect(opt_tool.pool).toBe(ir_tool.const_pool)
        expect([...opt_tool.pool]).toContain(5)
    })

    it('id 计数不变', () => {
        const {ir_tool, opt_tool} = optimize_same('app: module { main: void() { var x: number = 1; x = 2; } }')
        expect(opt_tool.index).toBe(ir_tool._id)
    })
})
