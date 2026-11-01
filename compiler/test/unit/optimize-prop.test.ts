import {describe, expect, it} from 'vitest'
import prop from '../../src/optimize/contant/prop'
import {OPTTool} from '../../src/optimize/tool'
import {BINARY, CMP, CZ, IRArgs, LOAD, MOV, NOT, OFFSET_GET, OFFSET_SET, OUT, PARAM_LOAD, PARAM_SET, PUSH} from '../../src/utils'
import {new_opt} from './helper-ir'
import {CmpDict} from '../../src/ir/tool'

const reg = IRArgs.reg
const val = IRArgs.value
const map = prop[1]
const visit = (data: any) => {
    let v = map.get(data.constructor)
    if (v == null)
        for (const [k, fn] of map)
            if (data instanceof k) v = fn
    expect(v, data.constructor.name + ' 没在这轮注册').toBeTypeOf('function')
    return v
}
function run(data: any, prep?: (tool: OPTool) => void): { flow: any[], tool: OPTool } {
    const tool = new_opt(data)
    if (prep) prep(tool)
    visit(data)(data, tool, 0, 0)
    tool.flush()
    return {flow: tool.command.get(0), tool}
}
//池里 id 20 的值是 1
const with_pool = (tool: OPTool) => {
    tool.r_pool.set(1, 20)
    tool.pool.set(20, 1)
}

describe('optimize/传播·load', () => {
    it('数字常量 → 换成 mov,并记住这个槽', () => {
        const {flow, tool} = run(new LOAD(reg(3), reg(20)), with_pool)
        expect(flow).toEqual([new MOV(reg(3), reg(1))])
        expect(tool.cprop_table.get(3)).toBe(1)
    })

    it('字符串常量 → 不换成 mov,槽的记录也清掉', () => {
        const {flow, tool} = run(new LOAD(reg(3), reg(21)), t => {
            t.r_pool.set('abc', 21)
            t.pool.set(21, 'abc')
            t.cprop_table.set(3, 9)
        })
        expect(flow[0]).toBeInstanceOf(LOAD)
        expect(tool.cprop_table.has(3)).toBe(false)
    })
})

describe('optimize/传播·mov', () => {
    it('记住左值槽的常量', () => {
        const {tool} = run(new MOV(reg(3), reg(7)))
        expect(tool.cprop_table.get(3)).toBe(7)
    })

    it('右值是已知槽时换成字面量', () => {
        const {flow} = run(new MOV(reg(3), val(4)), t => t.cprop_table.set(4, 5))
        expect((flow[0] as MOV).right).toEqual(reg(5))
    })

    it('右值未知就原样', () => {
        const {flow} = run(new MOV(reg(3), val(4)))
        expect((flow[0] as MOV).right).toEqual(val(4))
    })
})

describe('optimize/传播·其它指令读操作数', () => {
    it('binary 的两个操作数都换', () => {
        const data = new BINARY('add', reg(3), val(4), val(5))
        const {flow} = run(data, t => {
            t.cprop_table.set(4, 1)
            t.cprop_table.set(5, 2)
        })
        const out = flow[0] as BINARY
        expect(out.left).toEqual(reg(1))
        expect(out.right).toEqual(reg(2))
    })

    it('cmp 只换右值(左值就地写回)', () => {
        const data = new CMP(reg(3), val(4), reg(CmpDict.get('==')))
        const {flow} = run(data, t => t.cprop_table.set(4, 7))
        const out = flow[0] as CMP
        expect(out.left).toEqual(reg(3))
        expect(out.right).toEqual(reg(7))
    })

    it('not 换右值', () => {
        const data = new NOT(reg(3), val(4))
        const {flow} = run(data, t => t.cprop_table.set(4, 1))
        expect((flow[0] as NOT).right).toEqual(reg(1))
    })

    it('条件跳转的条件换', () => {
        const data = new CZ(reg(1), reg(0), val(4))
        const {flow} = run(data, t => t.cprop_table.set(4, 1))
        expect((flow[0] as CZ).cond).toEqual(reg(1))
    })

    it('offset_get 的对象与键都换', () => {
        const data = new OFFSET_GET(reg(3), val(4), val(5))
        const {flow} = run(data, t => {
            t.cprop_table.set(4, 1)
            t.cprop_table.set(5, 2)
        })
        const out = flow[0] as OFFSET_GET
        expect(out.data).toEqual(reg(1))
        expect(out.offset).toEqual(reg(2))
    })

    it('param_load 的参数号换', () => {
        const data = new PARAM_LOAD(reg(3), val(4))
        const {flow} = run(data, t => t.cprop_table.set(4, 2))
        expect((flow[0] as PARAM_LOAD).param).toEqual(reg(2))
    })
})

describe('optimize/传播·写指令让记录失效', () => {
    it('push 之后这个槽不可信', () => {
        const {tool} = run(new PUSH(reg(3)), t => t.cprop_table.set(3, 1))
        expect(tool.cprop_table.has(3)).toBe(false)
    })

    it('io 之后整张表清空', () => {
        const data = new OUT(reg(1), reg(2))
        const {tool} = run(data, t => {
            t.cprop_table.set(3, 1)
            t.cprop_param_table.set(1, 1)
            t.cprop_offset_table.set('1:2', 1)
        })
        expect(tool.cprop_table.size).toBe(0)
        expect(tool.cprop_param_table.size).toBe(0)
        expect(tool.cprop_offset_table.size).toBe(0)
    })
})

describe('optimize/传播·记录', () => {
    it('param_set 记下参数值', () => {
        const {tool} = run(new PARAM_SET(reg(1), reg(5)))
        expect(tool.cprop_param_table.get(1)).toBe(5)
    })

    it('offset_set 记下「对象:键」的值', () => {
        const {tool} = run(new OFFSET_SET(reg(1), reg(2), reg(5)))
        expect(tool.cprop_offset_table.get('1:2')).toBe(5)
    })

    it('offset_set 的值未知时清掉旧记录', () => {
        //右值是读槽形式且该槽未知 → 记不住,旧记录要作废
        const {tool} = run(new OFFSET_SET(reg(1), reg(2), val(9)), t => t.cprop_offset_table.set('1:2', 9))
        expect(tool.cprop_offset_table.has('1:2')).toBe(false)
    })
})

describe('optimize/传播·注册表', () => {
    it('注册了十五类', () => {
        expect(map.size).toBe(15)
        expect(prop[0]).toBe('constant_prop')
    })
})
