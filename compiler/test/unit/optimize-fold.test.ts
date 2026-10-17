import {describe, expect, it} from 'vitest'
import fold from '../../src/optimize/contant/fold'
import {OPTTool} from '../../src/optimize/tool'
import {BINARY, BIT_NOT, CALL, CMP, CZ, IRArgs, JMP, JZ, LOAD, MOV, NOT, OFFSET_GET, PARAM_LOAD, THREAD, TZ} from '../../src/utils'
import {new_opt} from './helper-ir'
import {CmpDict} from '../../src/ir/tool'

const reg = IRArgs.reg
const val = IRArgs.value
const map = fold[1]
//取这轮负责这条指令的 visitor(ControlStreamCond 这类按父类注册)
const visit = (data: any) => {
    let v = map.get(data.constructor)
    if (v == null)
        for (const [k, fn] of map)
            if (data instanceof k) v = fn
    expect(v, data.constructor.name + ' 没在这轮注册').toBeTypeOf('function')
    return v
}
//跑一条指令(顺便往表里塞已知常量),返回改写后的指令流
function run(data: any, consts: [number, number][] = [], prep?: (tool: OPTTool) => void): any[] {
    const tool = new_opt(data)
    for (const [slot, v] of consts) tool.cprop_table.set(slot, v)
    if (prep) prep(tool)
    visit(data)(data, tool, 0, 0)
    tool.flush()
    return tool.command.get(0)
}

describe('optimize/折叠·二元运算', () => {
    it('两个操作数都已知 → 直接得出常量', () => {
        const data = new BINARY('add', reg(3), val(4), val(5))
        expect(run(data, [[4, 1], [5, 2]])).toEqual([new MOV(reg(3), reg(3))])
    })

    it('字面量操作数也参与折叠', () => {
        const data = new BINARY('mul', reg(3), reg(6), reg(7))
        expect(run(data)).toEqual([new MOV(reg(3), reg(42))])
    })

    it('有一个操作数未知就不动', () => {
        const data = new BINARY('add', reg(3), val(4), val(5))
        expect(run(data, [[4, 1]])).toEqual([data])
    })

    it('未知运算符不动', () => {
        const data = new BINARY('nope', reg(3), reg(6), reg(7))
        expect(run(data)).toEqual([data])
    })
})

describe('optimize/折叠·一元取反', () => {
    it('not 0 → 1', () => {
        expect(run(new NOT(reg(3), reg(0)))).toEqual([new MOV(reg(3), reg(1))])
    })

    it('not 非0 → 0', () => {
        expect(run(new NOT(reg(3), reg(5)))).toEqual([new MOV(reg(3), reg(0))])
    })

    it('bit_not 按位取反', () => {
        expect(run(new BIT_NOT(reg(3), reg(5)))).toEqual([new MOV(reg(3), reg(~5))])
    })

    it('操作数未知不动', () => {
        const data = new NOT(reg(3), val(4))
        expect(run(data)).toEqual([data])
    })
})

describe('optimize/折叠·比较', () => {
    it('左值槽已知 + 右值常量 → 得出 0/1', () => {
        const data = new CMP(reg(4), reg(3), reg(CmpDict.get('>')))
        expect(run(data, [[4, 5]])).toEqual([new MOV(reg(4), reg(1))])
    })

    it('左值未知就不动', () => {
        const data = new CMP(reg(4), reg(3), reg(CmpDict.get('>')))
        expect(run(data)).toEqual([data])
    })

    it('运算符编号未落在表里就不动', () => {
        const data = new CMP(reg(4), reg(3), reg(99))
        expect(run(data, [[4, 5]])).toEqual([data])
    })
})

describe('optimize/折叠·条件跳转', () => {
    it('条件恒真:cz 换成无条件的 call', () => {
        expect(run(new CZ(reg(1), reg(0), reg(1)))[0]).toBeInstanceOf(CALL)
    })

    it('条件恒真:jz 换成 jmp', () => {
        expect(run(new JZ(reg(1), reg(0), reg(1)))[0]).toBeInstanceOf(JMP)
    })

    it('条件恒真:tz 换成 thread', () => {
        expect(run(new TZ(reg(1), reg(0), reg(1)))[0]).toBeInstanceOf(THREAD)
    })

    it('条件恒假:整条删掉', () => {
        expect(run(new CZ(reg(1), reg(0), reg(0)))).toEqual([])
    })

    it('条件未知不动', () => {
        const data = new CZ(reg(1), reg(0), val(9))
        expect(run(data)).toEqual([data])
    })
})

describe('optimize/折叠·offset 与 param', () => {
    it('offset 常量表里有 → 换成 load', () => {
        const data = new OFFSET_GET(reg(3), val(4), val(5))
        const out = run(data, [], tool => {
            tool.cprop_offset_table.set('4:5', 7)
            tool.r_pool.set(7, 20)
            tool.pool.set(20, 7)
        })
        expect(out[0]).toBeInstanceOf(LOAD)
        expect((out[0] as LOAD).data).toEqual(reg(20))
    })

    it('offset 表里没有就不动', () => {
        const data = new OFFSET_GET(reg(3), val(4), val(5))
        expect(run(data)).toEqual([data])
    })

    it('参数值已知 → 换成 load,常量 0 也要认', () => {
        const data = new PARAM_LOAD(reg(3), reg(1))
        const out = run(data, [], tool => tool.cprop_param_table.set(1, 0))
        expect(out[0]).toBeInstanceOf(LOAD)
    })

    it('参数值未知不动', () => {
        const data = new PARAM_LOAD(reg(3), reg(1))
        expect(run(data)).toEqual([data])
    })
})

describe('optimize/折叠·注册表', () => {
    it('注册了七类', () => {
        expect([...map.keys()].map(k => k.name).sort())
            .toEqual(['BINARY', 'BIT_NOT', 'CMP', 'ControlStreamCond', 'NOT', 'OFFSET_GET', 'PARAM_LOAD'])
        expect(fold[0]).toBe('constant_fold')
    })
})
