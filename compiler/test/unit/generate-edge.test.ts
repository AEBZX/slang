//编码边界:空池/空块/空指令流/大槽号/长指令流都要产出结构正确的字节码
import {describe, expect, it} from 'vitest'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import generate from '../../src/generate'
import {OPTTool} from '../../src/optimize/tool'
import {BINARY, IRArgs, IRTree, LOAD, MOV, RET} from '../../src/utils'

const bin = (tool: any): Buffer => {
    generate.local = join(tmpdir(), `slang-edge-${process.pid}.sbin`)
    return generate.run(tool) as Buffer
}
//池按 IRTool 的形态给(值 -> id):OPTTool 的构造会把它反过来
const tool_of = (flow: [number, IRTree[]][], pool: [any, any][] = [], size = 100) =>
    new OPTTool(size as any, new Map(flow), new Map(pool) as any)

//读常量池:返回 [id, 类型(1=数字/0=字符串), 值][]
function read_pool(buf: Buffer): [number, number, any][] {
    const out: [number, number, any][] = []
    let offset = buf.indexOf('POOL_START') + 'POOL_START'.length
    while (offset + 9 <= buf.length) {
        if (buf.slice(offset, offset + 8).toString('latin1') == 'POOL_END') break
        const id = buf.readUInt32BE(offset)
        const type = buf.readUInt8(offset + 4)
        const len = buf.readUInt32BE(offset + 5)
        const data = buf.slice(offset + 9, offset + 9 + len)
        out.push([id, type, type == 1 ? data.readDoubleBE(0) : data.toString('utf-8')])
        offset += 9 + len
    }
    return out
}
//读代码段:返回 [块号, [操作码...]][]
function read_code(buf: Buffer): [number, number[]][] {
    const start = buf.indexOf('CODE_START') + 'CODE_START'.length
    const out: [number, number[]][] = []
    let offset = start
    while (offset + 16 <= buf.length && buf.readUInt32BE(offset) == 0xFFFFFFFF) {
        const bid = buf.readUInt32BE(offset + 4)
        offset += 16
        const ops: number[] = []
        while (offset + 16 <= buf.length && buf.readUInt32BE(offset) != 0xFFFFFFFE) {
            ops.push(buf.readUInt32BE(offset))
            offset += 16
        }
        offset += 16
        out.push([bid, ops])
    }
    return out
}

describe('generate/边界·空输入', () => {
    it('没有块也没有池:只有文件头和两段标记', () => {
        const buf = bin(tool_of([]))
        expect(buf.toString('latin1').startsWith('SLANG1.0.0')).toBe(true)
        expect(buf.includes('POOL_START')).toBe(true)
        expect(buf.includes('CODE_START')).toBe(true)
        expect(read_code(buf)).toEqual([])
    })

    it('一个块、零条指令', () => {
        const buf = bin(tool_of([[0, []]]))
        expect(read_code(buf)).toEqual([[0, []]])
    })

    it('有指令但池是空的', () => {
        const buf = bin(tool_of([[0, [new RET(IRArgs.reg(1))]]]))
        expect(read_code(buf)).toEqual([[0, [168]]])
    })

    it('一个块和多条指令时字节数精确', () => {
        const many = Array.from({length: 100}, () => new BINARY('add', IRArgs.reg(1), IRArgs.reg(2), IRArgs.reg(3)))
        const one = bin(tool_of([[0, [new BINARY('add', IRArgs.reg(1), IRArgs.reg(2), IRArgs.reg(3))]]]))
        const hundred = bin(tool_of([[0, many]]))
        expect(hundred.length - one.length).toBe(99 * 16)
    })

    it('一千条指令的顺序与内容都对', () => {
        const many = Array.from({length: 1000}, () => new BINARY('add', IRArgs.reg(1), IRArgs.reg(2), IRArgs.reg(3)))
        const code = read_code(bin(tool_of([[0, many]])))
        expect(code.length).toBe(1)
        expect(code[0][1].length).toBe(1000)
        expect(new Set(code[0][1])).toEqual(new Set([16]))
    })
})

describe('generate/边界·池与槽号', () => {
    it('只有字符串池', () => {
        const buf = bin(tool_of([[0, [new LOAD(IRArgs.reg(1), IRArgs.reg(0))]]], [['abc', 0]]))
        expect(read_pool(buf)).toEqual([[0, 0, 'abc']])
        expect(read_code(buf)).toEqual([[0, [0]]])
    })

    it('只有数字池', () => {
        const buf = bin(tool_of([[0, [new LOAD(IRArgs.reg(1), IRArgs.reg(0))]]], [[42, 0]]))
        expect(read_pool(buf)).toEqual([[0, 1, 42]])
        expect(read_code(buf)).toEqual([[0, [0]]])
    })

    it('接近 u32 上限的槽号能原样写进去', () => {
        const buf = bin(tool_of([[0, [new MOV(IRArgs.reg(0xfffffff0), IRArgs.reg(0xfffffff1))]]]))
        const start = buf.indexOf('CODE_START') + 'CODE_START'.length + 16
        expect(buf.readUInt32BE(start)).toBe(8)
        expect(buf.readUInt32BE(start + 4)).toBe(0xfffffff0)
        expect(buf.readUInt32BE(start + 8)).toBe(0xfffffff1)
    })

    it('多个块按块号顺序写出', () => {
        const buf = bin(tool_of([[3, [new RET(IRArgs.reg(1))]], [5, [new RET(IRArgs.reg(1))]]]))
        expect(read_code(buf).map(([bid]) => bid)).toEqual([3, 5])
    })
})
