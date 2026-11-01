import {describe, expect, it} from 'vitest'
import copy_round from '../../src/optimize/copy'
import {OPTTool} from '../../src/optimize/tool'
import {BINARY, CMP, DELETE, IN, IRArgs, MOV, NOT, OFFSET_GET, PARAM_LOAD, RET} from '../../src/utils'
import {new_opt} from './helper-ir'
import {CmpDict} from '../../src/ir/tool'

const reg = IRArgs.reg
const val = IRArgs.value
const map = copy_round[1]
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

describe('optimize/拷贝·mov', () => {
    it('记住「读槽X 等于读 R」', () => {
        const {tool} = run(new MOV(reg(3), val(4)))
        expect(tool.cpy_rep_table.get(3)).toEqual(val(4))
    })

    it('即使源槽有产出指令,mov 也保留(删掉会让目标槽没人写)', () => {
        const producer = new BINARY('add', reg(5), val(1), val(2))
        const data = new MOV(reg(9), val(5))
        const {flow} = run(data, t => t.cpy_set_table.set(5, {left: 'result', command: producer}))
        expect(flow.length).toBe(1)
        //产出指令的结果槽不被改动
        expect(producer.result).toEqual(reg(5))
    })

    it('没有产出指令就留着,并换掉已记录的右值', () => {
        const {flow} = run(new MOV(reg(3), val(4)), t => t.cpy_rep_table.set(4, val(7)))
        expect(flow.length).toBe(1)
        expect((flow[0] as MOV).right).toEqual(val(7))
    })

    it('左值是 value 形式时目标槽号未知,不记也不猜', () => {
        const {tool} = run(new MOV(val(3), val(4)), t => t.cpy_rep_table.set(3, val(1)))
        //已有的记录保持原样:那个槽(编号未知)的内容才是真正的目标
        expect(tool.cpy_rep_table.get(3)).toEqual(val(1))
    })
})

describe('optimize/拷贝·产出指令登记', () => {
    it('binary 登记结果槽', () => {
        const data = new BINARY('add', reg(3), val(4), val(5))
        const {tool} = run(data)
        expect(tool.cpy_set_table.get(3)).toEqual({left: 'result', command: data})
    })

    it('not 登记目标槽', () => {
        const data = new NOT(reg(3), val(4))
        const {tool} = run(data)
        expect(tool.cpy_set_table.get(3)).toEqual({left: 'left', command: data})
    })

    it('cmp 登记目标槽', () => {
        const data = new CMP(reg(3), val(4), reg(CmpDict.get('==')))
        const {tool} = run(data)
        expect(tool.cpy_set_table.get(3)).toEqual({left: 'left', command: data})
    })

    it('offset_get 登记目标槽', () => {
        const data = new OFFSET_GET(reg(3), val(4), val(5))
        const {tool} = run(data)
        expect(tool.cpy_set_table.get(3)).toEqual({left: 'target', command: data})
    })

    it('结果是 value 形式(写穿)时不登记', () => {
        const {tool} = run(new BINARY('add', val(3), val(4), val(5)))
        expect(tool.cpy_set_table.size).toBe(0)
    })
})

describe('optimize/拷贝·读操作数替换', () => {
    it('binary/cmp/not 的右值都按表替换', () => {
        const {flow} = run(new BINARY('add', reg(3), val(4), val(5)), t => {
            t.cpy_rep_table.set(4, val(1))
            t.cpy_rep_table.set(5, val(2))
        })
        const out = flow[0] as BINARY
        expect(out.left).toEqual(val(1))
        expect(out.right).toEqual(val(2))
    })

    it('ret/param_load 的帧与参数号也替换', () => {
        const {flow} = run(new RET(val(4)), t => t.cpy_rep_table.set(4, val(1)))
        expect((flow[0] as RET).frame).toEqual(val(1))
        const second = run(new PARAM_LOAD(reg(3), val(4)), t => t.cpy_rep_table.set(4, val(2)))
        expect((second.flow[0] as PARAM_LOAD).param).toEqual(val(2))
    })

    it('io 的操作数替换', () => {
        const {flow} = run(new IN(val(4), reg(5)), t => t.cpy_rep_table.set(4, val(1)))
        expect((flow[0] as IN).oper).toEqual(val(1))
    })
})

describe('optimize/拷贝·释放让记录失效', () => {
    it('delete 清掉该槽的登记和指向它的记录', () => {
        const {tool} = run(new DELETE(reg(3)), t => {
            t.cpy_set_table.set(3, {left: 'result', command: null})
            t.cpy_rep_table.set(3, val(1))
            t.cpy_rep_table.set(4, reg(3))
        })
        expect(tool.cpy_set_table.has(3)).toBe(false)
        expect(tool.cpy_rep_table.has(3)).toBe(false)
        expect(tool.cpy_rep_table.has(4)).toBe(false)
    })
})

describe('optimize/拷贝·注册表', () => {
    it('注册了十五类', () => {
        expect(map.size).toBe(15)
        expect(copy_round[0]).toBe('copy')
    })
})
