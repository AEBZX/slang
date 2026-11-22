import {describe, expect, it} from 'vitest'
import {run_to_ir} from '../helpers'
import {CALL, PARAM_LOAD, PARAM_SET, RET} from '../../src/utils'

const ir_blocks = (src: string) => {
    const tool = run_to_ir(src) as any
    return [...tool.code.entries()].map(([bid, ins]) => ({bid, ins}))
}

describe('ir call: 调用方约定', () => {
    it('实参写入槽 index+1(槽 0 是返回值)', () => {
        const blocks = ir_blocks('app: module { f: number(a: number) { return a; } main: void() { f(1); } }')
        const all = blocks.flatMap(b => b.ins)
        const param_sets = all.filter(i => i instanceof PARAM_SET && i.param.data !== 0)
        expect(param_sets.length).toBe(1)
        expect(param_sets[0].param.data).toBe(1)
    })

    it('CALL 经目标槽间接跳转且为函数帧', () => {
        const blocks = ir_blocks('app: module { f: number(a: number) { return a; } main: void() { f(1); } }')
        const all = blocks.flatMap(b => b.ins)
        const calls = all.filter(i => i instanceof CALL)
        expect(calls.length).toBe(1)
        expect(calls[0].target.type).toBe('value')
        expect(calls[0].frame.data).toBe(1)
    })
})

describe('ir call: 被调方约定', () => {
    it('形参从槽 index+1 载入,返回值写槽 0,以 RET 结束', () => {
        const blocks = ir_blocks('app: module { f: number(a: number) { return a; } main: void() { f(1); } }')
        const f_body = blocks.find(b => b.ins.some(i => i instanceof PARAM_LOAD && i.param.data === 1))
        expect(f_body).toBeDefined()
        const loads = f_body!.ins.filter(i => i instanceof PARAM_LOAD)
        expect(loads[0].param.data).toBe(1)
        const ret_set = f_body!.ins.filter(i => i instanceof PARAM_SET)
        expect(ret_set.length).toBeGreaterThan(0)
        expect(ret_set[0].param.data).toBe(0)
        const ret = f_body!.ins.filter(i => i instanceof RET)
        expect(ret.length).toBe(1)
    })
})

describe('ir call: 模块成员调用', () => {
    it('嵌套模块函数的 call_target 可解析', () => {
        const blocks = ir_blocks('app: module { util: module { f: void() { } } main: void() { util.f(); } }')
        const all = blocks.flatMap(b => b.ins)
        const calls = all.filter(i => i instanceof CALL)
        expect(calls.length).toBe(1)
    })
})
