import {describe, expect, it} from 'vitest'
import peephole from '../../src/optimize/peephole'
import {OPTTool} from '../../src/optimize/tool'
import {BINARY, CMP, IRArgs, MOV, NOT} from '../../src/utils'
import {new_opt} from './helper-ir'
import {CmpDict} from '../../src/ir/tool'

const reg = IRArgs.reg
const val = IRArgs.value
//跑一遍窥孔轮,返回改写后的指令流
function peep(data: any, tool: OPTool = new_opt(data)): any[] {
    const visit = peephole[1].get(data.constructor)
    expect(visit, data.constructor.name + ' 没注册').toBeTypeOf('function')
    visit(data, tool, 0, 0)
    tool.flush()
    return tool.command.get(0)
}
//结果槽 3,两个读操作数分别读槽 4、5
const binary = (id: string) => new BINARY(id, reg(3), val(4), val(5))
//同一个槽读两次
const self = (id: string) => new BINARY(id, reg(3), val(4), val(4))
//右边是立即数
const with_const = (id: string, v: number) => new BINARY(id, reg(3), val(4), reg(v))

describe('optimize/窥孔·普通运算保持原样', () => {
    for (const id of ['add', 'sub', 'mul', 'div', 'mod', 'shl', 'shr', 'and', 'or', 'xor'])
        it(id + ' 两个不同操作数不动', () => {
            const data = binary(id)
            expect(peep(data)).toEqual([data])
        })

    it('cmp 两个不同操作数不动', () => {
        const data = new CMP(reg(4), val(5), reg(CmpDict.get('>')))
        expect(peep(data)).toEqual([data])
    })
})

describe('optimize/窥孔·结果等于另一个操作数', () => {
    for (const id of ['add', 'sub', 'or', 'xor', 'shl', 'shr'])
        it(id + ' 右边是 0 → 结果就是左边的值', () => {
            expect(peep(with_const(id, 0))).toEqual([new MOV(reg(3), val(4))])
        })

    it('mul 右边是 1 → 结果就是左边的值', () => {
        expect(peep(with_const('mul', 1))).toEqual([new MOV(reg(3), val(4))])
    })

    it('and 读同一个槽两次 → 结果就是那个值', () => {
        expect(peep(self('and'))).toEqual([new MOV(reg(3), val(4))])
    })

    it('or 读同一个槽两次 → 结果就是那个值', () => {
        expect(peep(self('or'))).toEqual([new MOV(reg(3), val(4))])
    })
})

describe('optimize/窥孔·结果恒为 0', () => {
    for (const id of ['sub', 'xor'])
        it(id + ' 读同一个槽两次 → 0', () => {
            expect(peep(self(id))).toEqual([new MOV(reg(3), reg(0))])
        })

    for (const id of ['and', 'mul'])
        it(id + ' 右边是 0 → 0', () => {
            expect(peep(with_const(id, 0))).toEqual([new MOV(reg(3), reg(0))])
        })
})

describe('optimize/窥孔·比较', () => {
    for (const op of ['>', '<', '!='])
        it('a' + op + 'a 恒为 0', () => {
            const data = new CMP(reg(4), val(4), reg(CmpDict.get(op)))
            expect(peep(data)).toEqual([new MOV(reg(4), reg(0))])
        })

    for (const op of ['<=', '>=', '=='])
        it('a' + op + 'a 恒为 1', () => {
            const data = new CMP(reg(4), val(4), reg(CmpDict.get(op)))
            expect(peep(data)).toEqual([new MOV(reg(4), reg(1))])
        })

    it('左值槽 4 和立即数 4 不是同一个操作数', () => {
        const data = new CMP(reg(4), reg(4), reg(CmpDict.get('==')))
        expect(peep(data)).toEqual([data])
    })
})

describe('optimize/窥孔·立即数不能被当成槽', () => {
    it('mov 槽3, 读槽3 → 删掉', () => {
        expect(peep(new MOV(reg(3), val(3)))).toEqual([])
    })

    //mov reg 1, reg 1 是"把立即数 1 写进槽 1",不是自我赋值;删掉会让槽 1 没人写
    it('mov 槽1, 立即数1 必须保留', () => {
        const data = new MOV(reg(1), reg(1))
        expect(peep(data)).toEqual([data])
    })

    it('mov 槽3, 读槽4 保留', () => {
        const data = new MOV(reg(3), val(4))
        expect(peep(data)).toEqual([data])
    })
})

describe('optimize/窥孔·注册情况', () => {
    it('只注册了 mov/binary/cmp 三类', () => {
        expect([...peephole[1].keys()].map(k => k.name).sort()).toEqual(['BINARY', 'CMP', 'MOV'])
        expect(peephole[0]).toBe('peephole')
    })

    it('not 不在这轮里', () => {
        expect(peephole[1].get(NOT)).toBeUndefined()
    })
})
