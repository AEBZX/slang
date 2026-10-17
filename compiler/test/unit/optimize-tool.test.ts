import {describe, expect, it} from 'vitest'
import {
    BINARYMap,
    CMPMap,
    OPTTool,
    copy,
    cprop,
    cprop_offset_record,
    cprop_param_record,
    cprop_record,
    is_constant,
    mov_rep,
    to_load,
    to_peephole_l,
    to_r,
    to_v,
    value
} from '../../src/optimize/tool'
import {BINARY, GC, IRArgs, LOAD, MOV, NOT, OFFSET_GET} from '../../src/utils'
import {dump_ir} from './helper-ir'

const reg = IRArgs.reg
const val = IRArgs.value

describe('optimize/二元运算表', () => {
    it('十个运算符都在且结果正确', () => {
        const cases: [string, number, number, number][] = [
            ['add', 2, 3, 5],
            ['sub', 2, 3, -1],
            ['mul', 2, 3, 6],
            ['div', 7, 2, 3.5],
            ['mod', 7, 2, 1],
            ['shl', 1, 3, 8],
            ['shr', 8, 2, 2],
            ['and', 6, 3, 2],
            ['or', 6, 3, 7],
            ['xor', 6, 3, 5]
        ]
        for (const [op, a, b, want] of cases) {
            const fn = BINARYMap.get(op)
            expect(fn, op + ' 缺失').toBeTypeOf('function')
            expect(fn(a, b)).toBe(want)
        }
        expect(BINARYMap.size).toBe(10)
    })
})

describe('optimize/比较表', () => {
    it('六个编号对应六种比较', () => {
        expect(CMPMap.get(0)(1, 1)).toBe(1)
        expect(CMPMap.get(0)(1, 2)).toBe(0)
        expect(CMPMap.get(1)(2, 1)).toBe(1)
        expect(CMPMap.get(1)(1, 2)).toBe(0)
        expect(CMPMap.get(2)(1, 1)).toBe(1)
        expect(CMPMap.get(2)(1, 2)).toBe(0)
        expect(CMPMap.get(3)(1, 2)).toBe(1)
        expect(CMPMap.get(3)(1, 1)).toBe(0)
        expect(CMPMap.get(4)(1, 2)).toBe(1)
        expect(CMPMap.get(4)(2, 1)).toBe(0)
        expect(CMPMap.get(5)(1, 1)).toBe(1)
        expect(CMPMap.get(5)(2, 1)).toBe(0)
    })

    it('字符串按内容比较', () => {
        expect(CMPMap.get(0)('a', 'a')).toBe(1)
        expect(CMPMap.get(3)('a', 'b')).toBe(1)
    })
})

describe('optimize/操作数形式', () => {
    it('is_constant 只认全 reg', () => {
        expect(is_constant(reg(1), reg(2))).toBe(true)
        expect(is_constant(reg(1), val(2))).toBe(false)
        expect(is_constant(val(1))).toBe(false)
    })

    it('to_v/to_r 就地改形式', () => {
        const a = reg(3)
        expect(to_v(a)).toBe(a)
        expect(a.type).toBe('value')
        expect(to_r(a)).toBe(a)
        expect(a.type).toBe('reg')
    })

    it('to_peephole_l 对 value 返回 null(它不能当左值)', () => {
        expect(to_peephole_l(reg(1))).toEqual(reg(1).type == 'reg' ? to_peephole_l(reg(1)) : null)
        expect(to_peephole_l(val(1))).toBe(null)
        const a = reg(4)
        const l = to_peephole_l(a)
        expect(l).toBe(a)
        expect(a.type).toBe('value')
    })

    it('value 只认 reg,value 形式还拿不到常量', () => {
        expect(value(reg(7))).toBe(7)
        expect(value(val(7))).toBeNaN()
    })
})

describe('optimize/OPTTool', () => {
    it('构造时把 value->id 反成 id->value', () => {
        const tool = new OPTTool(9, new Map(), new Map([[7, 3], ['a', 5]]))
        expect(tool.pool.get(3)).toBe(7)
        expect(tool.pool.get(5)).toBe('a')
        expect(tool.index).toBe(9)
    })

    it('id/pool_id 都从 index 往后发号,已入池的复用', () => {
        const tool = new OPTTool(4, new Map(), new Map([[7, 3]]))
        expect(tool.pool_id(7)).toBe(3)
        expect(tool.pool_id(8)).toBe(4)
        expect(tool.pool.get(4)).toBe(8)
        expect(tool.id()).toBe(5)
    })

    it('sweep 记下改写,同一位置只认第一次(刻意设计)', () => {
        const a = new GC()
        const b = new GC()
        const tool = new OPTTool(1, new Map([[0, [new GC()]]]), new Map())
        tool.sweep(0, 0, a)
        tool.sweep(0, 0, b)
        expect(tool.changed).toBe(true)
        tool.flush()
        expect(tool.command.get(0)).toEqual([a])
    })

    it('flush 写回指令流并清空待办', () => {
        const old = [new GC(), new GC(), new GC()]
        const tool = new OPTTool(1, new Map([[0, old]]), new Map())
        tool.sweep(0, 1, new MOV(reg(1), reg(2)), new MOV(reg(3), reg(4)))
        tool.flush()
        expect(tool.command.get(0).map(dump_ir)).toEqual([
            'GC', 'MOV left=r1 right=r2', 'MOV left=r3 right=r4', 'GC'
        ])
        expect(tool.changed).toBe(false)
        //再 flush 一次不该重复插入
        tool.flush()
        expect(tool.command.get(0).length).toBe(4)
    })

    it('flush 同一块内多个下标不会互相错位', () => {
        const tool = new OPTTool(1, new Map([[0, [new GC(), new GC(), new GC(), new GC()]]]), new Map())
        //前面插两条,后面删一条
        tool.sweep(0, 0, new MOV(reg(1), reg(2)), new MOV(reg(3), reg(4)))
        tool.sweep(0, 3)
        tool.flush()
        expect(tool.command.get(0).map(i => i.constructor.name)).toEqual(['MOV', 'MOV', 'GC', 'GC'])
    })

    it('flush 只动被扫过的块', () => {
        const tool = new OPTTool(1, new Map([[0, [new GC()]], [1, [new GC(), new GC()]]]), new Map())
        tool.sweep(0, 0, new MOV(reg(1), reg(2)))
        tool.flush()
        expect(tool.command.get(1).length).toBe(2)
    })

    it('clear 清掉所有传播表', () => {
        const tool = new OPTTool(1, new Map(), new Map())
        tool.cpy_rep_table.set(1, val(2))
        tool.cpy_set_table.set(1, {left: 'left', command: null})
        tool.cprop_table.set(1, 1)
        tool.cprop_offset_table.set('1:2', 1)
        tool.cprop_param_table.set(1, 1)
        tool.clear()
        expect(tool.cpy_rep_table.size).toBe(0)
        expect(tool.cpy_set_table.size).toBe(0)
        expect(tool.cprop_table.size).toBe(0)
        expect(tool.cprop_offset_table.size).toBe(0)
        expect(tool.cprop_param_table.size).toBe(0)
    })
})

describe('optimize/传播小工具', () => {
    it('copy 按槽号查表,只对读槽(value 形式)生效', () => {
        const tool = new OPTTool(1, new Map(), new Map())
        const a = val(1)
        const b = val(2)
        expect(copy(a, tool)).toBe(a)
        tool.cpy_rep_table.set(1, b)
        expect(copy(a, tool)).toBe(b)
        //字面量(reg 形式)不参与替换
        expect(copy(reg(1), tool)).toEqual(reg(1))
    })

    it('mov_rep 把 mov 变成写 b 的那条指令', () => {
        const tool = new OPTTool(1, new Map(), new Map())
        const binary = new BINARY('add', reg(9), reg(1), reg(2))
        //表按槽号做键
        tool.cpy_set_table.set(5, {left: 'result', command: binary})
        const mov = new MOV(reg(9), val(5))
        expect(mov_rep(mov, tool)).toBe(binary)
        expect(binary.result).toEqual(reg(9))
        //查不到就原样返回
        expect(mov_rep(new MOV(reg(1), val(6)), tool)).toEqual(new MOV(reg(1), val(6)))
    })

    it('传播表按对象身份做键,同值不同实例命中不了', () => {
        const tool = new OPTTool(1, new Map(), new Map())
        cprop_record(reg(3), reg(7), tool)
        //同值的新实例查不到
        expect(tool.cprop_table.has(val(3))).toBe(false)
        expect(tool.cprop_table.size).toBe(1)
    })


    it('cprop_record 记下的常量能被 cprop 换出来', () => {
        const tool = new OPTTool(1, new Map(), new Map())
        cprop_record(reg(3), reg(7), tool)
        //读槽(value 形式)换成字面量,另一个实例也能命中(表按槽号)
        expect(cprop(val(3), tool)).toEqual(reg(7))
        expect(cprop(val(3), tool)).toEqual(reg(7))
        //字面量(reg 形式)不动
        expect(cprop(reg(3), tool)).toEqual(reg(3))
    })
    it('cprop_param_record 记下参数值', () => {
        const tool = new OPTTool(1, new Map(), new Map())
        cprop_param_record(reg(1), reg(9), tool)
        expect([...tool.cprop_param_table]).toEqual([[1, 9]])
    })

    it('cprop_offset_record 按「对象槽:键槽」记下 offset 值', () => {
        const tool = new OPTTool(1, new Map(), new Map())
        const target = reg(1)
        const offset = reg(2)
        cprop_offset_record([target, offset], reg(9), tool)
        expect([...tool.cprop_offset_table]).toEqual([['1:2', 9]])
        //记录时不能把操作数的形式改掉
        expect(target.type).toBe('reg')
        expect(offset.type).toBe('reg')
    })
})

describe('optimize/to_load', () => {
    it('字符串操作数换成槽并插一条 load', () => {
        const tool = new OPTTool(10, new Map([[0, []]]), new Map())
        const mov = new MOV(reg(1), reg('key' as any))
        tool.command.get(0).push(mov)
        to_load(mov, 'right', tool, 0, 0)
        //搬进槽之后操作数要从槽里读(value),写成 reg 就变成"数字槽号"了
        expect(mov.right.type).toBe('value')
        expect(mov.right.data).toBe(10)
        const flow = tool.command.get(0)
        expect(flow.length).toBe(1)
        tool.flush()
        expect(tool.command.get(0).map(i => i.constructor.name)).toEqual(['LOAD', 'MOV'])
        expect(tool.command.get(0)[0]).toBeInstanceOf(LOAD)
    })

    it('整数操作数和 value 形式都不动', () => {
        const tool = new OPTTool(10, new Map([[0, []]]), new Map())
        const a = new MOV(reg(1), reg(3))
        to_load(a, 'right', tool, 0, 0)
        expect(a.right).toEqual(reg(3))
        const b = new MOV(reg(1), val(3))
        to_load(b, 'right', tool, 0, 0)
        expect(b.right).toEqual(val(3))
        expect(tool.changed).toBe(false)
    })
})
