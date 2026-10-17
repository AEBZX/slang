import {describe, expect, it} from 'vitest'
import generate from '../../src/generate'
import {
    BINARY, BIT_NOT, CALL, CMP, CZ, DELETE, GC, IN, IRTree, JMP, JZ, LOAD, MOV, NOT,
    OFFSET_ADDR, OFFSET_GET, OFFSET_SET, OFFSET_STR_ADDR, OFFSET_STR_GET, OFFSET_STR_SET,
    OUT, PARAM_LOAD, PARAM_SET, POP, PUSH, RET, THREAD, TZ, IRArgs
} from '../../src/utils'

const reg = IRArgs.reg
const val = IRArgs.value
//操作码 = (类基址 + 类型偏移) * 8 + 操作数形式偏移
const id_of = (base: number, type = 0, form = 0) => (base + type) * 8 + form
//形式偏移:三个操作数的 reg/value 就是三位
const F = (a: string, b: string, c: string) => (a == 'value' ? 4 : 0) + (b == 'value' ? 2 : 0) + (c == 'value' ? 1 : 0)

//取某条指令的编码器
function encoder(ir: IRTree) {
    const v = (generate as any).ref.get(ir.constructor)
    expect(v, ir.constructor.name + ' 没有编码器').toBeTypeOf('function')
    return v as (data: IRTree) => Buffer
}
//编码成 16 字节:指令 opcode + 三个 u32 操作数
function encode(ir: IRTree): number[] {
    const buf = encoder(ir)(ir)
    expect(buf.length).toBe(16)
    return [0, 4, 8, 12].map(o => buf.readUInt32BE(o))
}
const opcode_of = (ir: IRTree) => encode(ir)[0]

describe('generate/指令编码', () => {
    it('mov 目标槽 + 取值源', () => {
        expect(encode(new MOV(reg(7), val(8)))).toEqual([id_of(1, 0, F('reg', 'value', 'reg')), 7, 8, 0])
    })

    it('load 两个操作数,缺的补 0', () => {
        expect(encode(new LOAD(reg(7), reg(9)))).toEqual([id_of(0), 7, 9, 0])
    })

    it('binary 结果槽 + 两个取值操作数', () => {
        expect(encode(new BINARY('add', reg(1), val(2), val(3))))
            .toEqual([id_of(2, 0, F('reg', 'value', 'value')), 1, 2, 3])
        //xor 类型偏移 9
        expect(opcode_of(new BINARY('xor', reg(1), val(2), val(3)))).toBe(id_of(2, 9, F('reg', 'value', 'value')))
    })

    it('cmp 三个操作数都参与', () => {
        expect(encode(new CMP(reg(1), val(2), reg(3))))
            .toEqual([id_of(12, 0, F('reg', 'value', 'reg')), 1, 2, 3])
    })

    it('只有一两个操作数的指令不再崩', () => {
        expect(opcode_of(new RET(reg(1)))).toBe(id_of(21))
        expect(opcode_of(new PUSH(reg(1)))).toBe(id_of(22))
        expect(encode(new POP())).toEqual([id_of(23), 0, 0, 0])
        expect(encode(new GC())).toEqual([id_of(32), 0, 0, 0])
        expect(encode(new DELETE(reg(2)))).toEqual([id_of(33), 2, 0, 0])
    })

    it('控制流按操作数形式分变体', () => {
        expect(opcode_of(new JMP(reg(1), reg(2)))).toBe(id_of(15))
        expect(opcode_of(new CALL(reg(1), reg(2)))).toBe(id_of(16))
        expect(opcode_of(new THREAD(reg(1), reg(2)))).toBe(id_of(17))
        expect(opcode_of(new JZ(reg(1), reg(2), val(3)))).toBe(id_of(18, 0, F('reg', 'reg', 'value')))
        expect(opcode_of(new CZ(reg(1), reg(2), val(3)))).toBe(id_of(19, 0, F('reg', 'reg', 'value')))
        expect(opcode_of(new TZ(reg(1), reg(2), val(3)))).toBe(id_of(20, 0, F('reg', 'reg', 'value')))
    })

    it('一元与 param 指令', () => {
        expect(opcode_of(new NOT(reg(1), val(2)))).toBe(id_of(13, 0, F('reg', 'value', 'reg')))
        expect(opcode_of(new BIT_NOT(reg(1), val(2)))).toBe(id_of(14, 0, F('reg', 'value', 'reg')))
        expect(opcode_of(new PARAM_SET(reg(1), val(2)))).toBe(id_of(34, 0, F('reg', 'value', 'reg')))
        expect(opcode_of(new PARAM_LOAD(reg(1), reg(2)))).toBe(id_of(35))
    })

    it('io 指令', () => {
        expect(opcode_of(new IN(val(1), reg(2)))).toBe(id_of(30, 0, F('value', 'reg', 'reg')))
        expect(opcode_of(new OUT(val(1), val(2)))).toBe(id_of(31, 0, F('value', 'value', 'reg')))
    })

    it('offset 家族里已注册的两个', () => {
        expect(opcode_of(new OFFSET_SET(reg(1), reg(2), val(3)))).toBe(id_of(24, 0, F('reg', 'reg', 'value')))
        expect(opcode_of(new OFFSET_GET(reg(1), val(2), val(3)))).toBe(id_of(25, 0, F('reg', 'value', 'value')))
    })
})

describe('generate/操作码不撞号', () => {
    it('每类指令各占 8 个操作码,互不重叠', () => {
        const forms: [string, () => IRTree][] = [
            ['MOV', () => new MOV(reg(1), reg(2))],
            ['LOAD', () => new LOAD(reg(1), reg(2))],
            ['CMP', () => new CMP(reg(1), reg(2), reg(3))],
            ['NOT', () => new NOT(reg(1), reg(2))],
            ['BIT_NOT', () => new BIT_NOT(reg(1), reg(2))],
            ['JMP', () => new JMP(reg(1), reg(2))],
            ['CALL', () => new CALL(reg(1), reg(2))],
            ['THREAD', () => new THREAD(reg(1), reg(2))],
            ['JZ', () => new JZ(reg(1), reg(2), reg(3))],
            ['CZ', () => new CZ(reg(1), reg(2), reg(3))],
            ['TZ', () => new TZ(reg(1), reg(2), reg(3))],
            ['RET', () => new RET(reg(1))],
            ['PUSH', () => new PUSH(reg(1))],
            ['POP', () => new POP()],
            ['OFFSET_SET', () => new OFFSET_SET(reg(1), reg(2), reg(3))],
            ['OFFSET_GET', () => new OFFSET_GET(reg(1), reg(2), reg(3))],
            ['IN', () => new IN(reg(1), reg(2))],
            ['OUT', () => new OUT(reg(1), reg(2))],
            ['GC', () => new GC()],
            ['DELETE', () => new DELETE(reg(1))],
            ['PARAM_SET', () => new PARAM_SET(reg(1), reg(2))],
            ['PARAM_LOAD', () => new PARAM_LOAD(reg(1), reg(2))]
        ]
        const ops = ['add', 'sub', 'mul', 'div', 'mod', 'shl', 'shr', 'and', 'or', 'xor']
        const seen = new Map<number, string>()
        const push = (op: number, name: string) => {
            expect(seen.get(op), `${name} 与 ${seen.get(op)} 撞号 ${op}`).toBeUndefined()
            seen.set(op, name)
        }
        for (const id of ops)
            for (const f of [reg, val])
                for (const g of [reg, val])
                    for (const h of [reg, val])
                        push(opcode_of(new BINARY(id, f(1), g(2), h(3))), `BINARY/${id}/${f(0).type},${g(0).type},${h(0).type}`)
        for (const [name, make] of forms) push(opcode_of(make()), name)
    })
})

describe('generate/已知缺陷:B12 部分指令没有编码器', () => {
    //known-issue:B12 —— 生成器只注册了 OFFSET_SET/OFFSET_GET,
    //OFFSET_ADDR 与三个 OFFSET_STR_* 取不到编码器,整条流里一出现就会让 Buffer.concat 拿到 undefined
    it('OFFSET_ADDR 与 OFFSET_STR_* 也有编码器', () => {
        expect(opcode_of(new OFFSET_ADDR(reg(1), val(2), val(3)))).toBe(id_of(26, 0, F('reg', 'value', 'value')))
        expect(opcode_of(new OFFSET_STR_SET(reg(1), reg(2), val(3)))).toBe(id_of(27, 0, F('reg', 'reg', 'value')))
        expect(opcode_of(new OFFSET_STR_GET(reg(1), val(2), val(3)))).toBe(id_of(28, 0, F('reg', 'value', 'value')))
        expect(opcode_of(new OFFSET_STR_ADDR(reg(1), val(2), val(3)))).toBe(id_of(29, 0, F('reg', 'value', 'value')))
    })
})

describe('generate/字节码外壳', () => {
    const src = `public m:module{
        public static f:number(a:number){ var b:number=a+1; return b; }
    }`

    it('文件头 + 常量池 + 代码段的分界都在', async () => {
        const {bin_of} = await import('./helper-ir')
        const buf = bin_of(src)
        const text = buf.toString('latin1')
        expect(text.startsWith('SLANG1.0.0')).toBe(true)
        expect(text).toContain('POOL_START')
        expect(text).toContain('POOL_END')
        expect(text).toContain('CODE_START')
        expect(text.indexOf('POOL_START')).toBeLessThan(text.indexOf('POOL_END'))
        expect(text.indexOf('POOL_END')).toBeLessThan(text.indexOf('CODE_START'))
    })

    it('常量池能按 (id,类型,长度,数据) 读回来', async () => {
        const {bin_of, opt_of} = await import('./helper-ir')
        const tool = opt_of(src)
        const buf = bin_of(src)
        let offset = buf.indexOf('POOL_START') + 'POOL_START'.length
        const pool = new Map<number, number | string>()
        while (offset + 8 <= buf.length) {
            if (buf.slice(offset, offset + 8).toString('latin1') == 'POOL_END') break
            const id = buf.readUInt32BE(offset)
            const type = buf.readUInt8(offset + 4)
            const len = buf.readUInt32BE(offset + 5)
            const data = buf.slice(offset + 9, offset + 9 + len)
            pool.set(id, type == 1 ? data.readDoubleBE(0) : data.toString('utf-8'))
            offset += 9 + len
        }
        expect(pool.size).toBe(tool.pool.size)
        for (const [id, value] of tool.pool) expect(pool.get(id)).toBe(value)
    })

    it('每个块以 0xFFFFFFFF 开头、0xFFFFFFFE 收尾,块数等于指令流块数', async () => {
        const {bin_of, opt_of} = await import('./helper-ir')
        const tool = opt_of(src)
        const buf = bin_of(src)
        const codeStart = buf.indexOf('CODE_START') + 'CODE_START'.length
        let offset = codeStart
        let blocks = 0
        while (offset + 16 <= buf.length && buf.readUInt32BE(offset) == 0xFFFFFFFF) {
            blocks++
            offset += 16
            while (offset + 16 <= buf.length && buf.readUInt32BE(offset) != 0xFFFFFFFE) offset += 16
            expect(buf.readUInt32BE(offset)).toBe(0xFFFFFFFE)
            offset += 16
        }
        expect(blocks).toBe(tool.command.size)
        expect(offset).toBe(buf.length)
    })
})
