//编码契约:每条指令的 16 字节表示(操作码 + 三个操作数字)
import {describe, expect, it} from 'vitest'
import generate from '../../src/generate'
import {OPTTool} from '../../src/optimize/tool'
import {
    BINARY, BIT_NOT, CALL, CMP, CZ, DELETE, GC, IN, IRArgs, IRTree, JMP, JZ, LOAD, MOV, NOT,
    OFFSET_ADDR, OFFSET_GET, OFFSET_SET, OFFSET_STR_ADDR, OFFSET_STR_GET, OFFSET_STR_SET,
    OUT, PARAM_LOAD, PARAM_SET, POP, PUSH, RET, THREAD, TZ
} from '../../src/utils'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

const reg = (n: number) => IRArgs.reg(n)
const val = (n: number) => IRArgs.value(n)

//把一批指令编成字节码,取出代码段里的 [操作码, 操作数1, 操作数2, 操作数3]
function encode(list: IRTree[]): number[][] {
    const tool: any = new OPTTool(100, new Map([[0, list]]), new Map())
    generate.local = join(tmpdir(), `slang-opcode-${process.pid}.sbin`)
    const buf: Buffer = generate.run(tool) as any
    const start = buf.indexOf('CODE_START') + 'CODE_START'.length
    const out: number[][] = []
    let offset = start
    //块头
    offset += 16
    while (offset + 16 <= buf.length && buf.readUInt32BE(offset) != 0xFFFFFFFE) {
        out.push([
            buf.readUInt32BE(offset), buf.readUInt32BE(offset + 4),
            buf.readUInt32BE(offset + 8), buf.readUInt32BE(offset + 12)
        ])
        offset += 16
    }
    return out
}
const one = (ir: IRTree) => encode([ir])[0]

describe('generate/指令编码', () => {
    //操作码 = (指令基址 + 类型偏移)*8 + 操作数形式偏移,形式:value 记 4/2/1
    const OPS: [string, IRTree, number][] = [
        ['LOAD', new LOAD(reg(1), reg(2)), 0],
        ['MOV', new MOV(reg(1), reg(2)), 8],
        ['BINARY add', new BINARY('add', reg(1), reg(2), reg(3)), 16],
        ['BINARY xor', new BINARY('xor', reg(1), reg(2), reg(3)), (2 + 9) * 8],
        ['CMP', new CMP(reg(1), reg(2), reg(3)), 96],
        ['NOT', new NOT(reg(1), reg(2)), 104],
        ['BIT_NOT', new BIT_NOT(reg(1), reg(2)), 112],
        ['JMP', new JMP(reg(1), reg(2)), 120],
        ['CALL', new CALL(reg(1), reg(2)), 128],
        ['THREAD', new THREAD(reg(1), reg(2)), 136],
        ['JZ', new JZ(reg(1), reg(2), reg(3)), 144],
        ['CZ', new CZ(reg(1), reg(2), reg(3)), 152],
        ['TZ', new TZ(reg(1), reg(2), reg(3)), 160],
        ['RET', new RET(reg(1)), 168],
        ['PUSH', new PUSH(reg(1)), 176],
        ['POP', new POP(), 184],
        ['OFFSET_SET', new OFFSET_SET(reg(1), reg(2), reg(3)), 192],
        ['OFFSET_GET', new OFFSET_GET(reg(1), reg(2), reg(3)), 200],
        ['OFFSET_ADDR', new OFFSET_ADDR(reg(1), reg(2), reg(3)), 208],
        ['OFFSET_STR_SET', new OFFSET_STR_SET(reg(1), reg(2), reg(3)), 216],
        ['OFFSET_STR_GET', new OFFSET_STR_GET(reg(1), reg(2), reg(3)), 224],
        ['OFFSET_STR_ADDR', new OFFSET_STR_ADDR(reg(1), reg(2), reg(3)), 232],
        ['IN', new IN(reg(1), reg(2)), 240],
        ['OUT', new OUT(reg(1), reg(2)), 248],
        ['GC', new GC(), 256],
        ['DELETE', new DELETE(reg(1)), 264],
        ['PARAM_SET', new PARAM_SET(reg(1), reg(2)), 272],
        ['PARAM_LOAD', new PARAM_LOAD(reg(1), reg(2)), 280]
    ]
    for (const [name, ir, opcode] of OPS)
        it(name + ' 的操作码是 ' + opcode, () => {
            expect(one(ir)[0]).toBe(opcode)
        })

    it('value 形式的操作数把形式位加进操作码', () => {
        //MOV reg, value -> 8 + 2
        expect(one(new MOV(reg(1), val(2)))[0]).toBe(10)
        //BINARY add reg, value, reg -> 16 + 2
        expect(one(new BINARY('add', reg(1), val(2), reg(3)))[0]).toBe(18)
        //三个都是 value -> 8 + 7
        expect(one(new BINARY('add', val(1), val(2), val(3)))[0]).toBe(23)
        //CMP reg, value, reg -> 96 + 2
        expect(one(new CMP(reg(1), val(2), reg(3)))[0]).toBe(98)
    })

    it('操作数原样写进后 12 字节', () => {
        expect(one(new MOV(reg(7), val(9)))).toEqual([10, 7, 9, 0])
        expect(one(new BINARY('mul', reg(1), reg(2), reg(3)))).toEqual([(2 + 2) * 8, 1, 2, 3])
    })

    it('缺的操作数补 reg 0', () => {
        expect(one(new RET(reg(1)))).toEqual([168, 1, 0, 0])
        expect(one(new POP())).toEqual([184, 0, 0, 0])
        expect(one(new GC())).toEqual([256, 0, 0, 0])
    })

    it('每条指令都占 16 字节', () => {
        const all = encode(OPS.map(([, ir]) => ir))
        expect(all.length).toBe(OPS.length)
        //多指令时每条各占一行
        expect(all.map(x => x[0])).toEqual(OPS.map(([, , op]) => op))
    })
})
