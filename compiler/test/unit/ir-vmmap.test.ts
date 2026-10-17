//vm(...) 的内联指令表:每个键对应的 IR 节点与操作数形态都必须钉住
import {describe, expect, it} from 'vitest'
import {BINARY, BIT_NOT, CALL, CMP, CZ, DELETE, GC, IN, IRArgs, JMP, JZ, LOAD, MOV, NOT,
    OFFSET_ADDR, OFFSET_GET, OFFSET_SET, OFFSET_STR_ADDR, OFFSET_STR_GET, OFFSET_STR_SET,
    OUT, PARAM_LOAD, PARAM_SET, POP, PUSH, RET, THREAD, TZ} from '../../src/utils'
import {VMMap} from '../../src/ir/tool'

const A = IRArgs.reg(1)
const B = IRArgs.reg(2)
const C = IRArgs.reg(3)

//键 -> 生成的 IR 节点
const TABLE: [string, any][] = [
    ['mov', MOV],
    ['add', BINARY], ['sub', BINARY], ['mul', BINARY], ['div', BINARY], ['mod', BINARY],
    ['shl', BINARY], ['shr', BINARY], ['and', BINARY], ['or', BINARY], ['xor', BINARY],
    ['load', LOAD],
    ['not', NOT], ['bit_not', BIT_NOT],
    ['cmp', CMP],
    ['jmp', JMP], ['call', CALL], ['thread', THREAD],
    ['jz', JZ], ['cz', CZ], ['tz', TZ],
    ['ret', RET],
    ['push', PUSH], ['pop', POP],
    ['param_load', PARAM_LOAD], ['param_set', PARAM_SET],
    ['offset_set', OFFSET_SET], ['offset_get', OFFSET_GET], ['offset_addr', OFFSET_ADDR],
    ['str_offset_set', OFFSET_STR_SET], ['str_offset_get', OFFSET_STR_GET], ['str_offset_addr', OFFSET_STR_ADDR],
    ['delete', DELETE], ['gc', GC],
    ['in', IN], ['out', OUT]
]

describe('ir/vm 内联指令表', () => {
    it('覆盖表里的每个键', () => {
        expect(new Set(VMMap.keys())).toEqual(new Set(TABLE.map(([k]) => k)))
    })

    for (const [key, cls] of TABLE)
        it(`vm("${key}") → ${cls.name}`, () => {
            const make: any = VMMap.get(key)
            expect(make).toBeDefined()
            expect(make(A, B, C)).toBeInstanceOf(cls)
        })

    it('二元运算带上正确的运算符名', () => {
        for (const op of ['add', 'sub', 'mul', 'div', 'mod', 'shl', 'shr', 'and', 'or', 'xor']) {
            const ir: any = (VMMap.get(op) as any)(A, B, C)
            expect(ir.id).toBe(op)
        }
    })

    it('load 的源保持池 id(不取槽值)', () => {
        const ir: any = (VMMap.get('load') as any)(A, B, C)
        expect(ir.reg.type).toBe('reg')
        expect(ir.data.type).toBe('reg')
        expect(ir.data.data).toBe(B.data)
    })

    it('push 操作槽本身,param_load 的索引取槽值', () => {
        const push: any = (VMMap.get('push') as any)(A, B, C)
        expect(push.target.type).toBe('reg')
        const load: any = (VMMap.get('param_load') as any)(A, B, C)
        expect(load.data.type).toBe('reg')
        expect(load.param.type).toBe('value')
    })

    it('jz / cz / tz 的条件取槽值', () => {
        for (const key of ['jz', 'cz', 'tz']) {
            const ir: any = (VMMap.get(key) as any)(A, B, C)
            expect(ir.cond.type).toBe('value')
            expect(ir.target.type).toBe('value')
        }
    })

    it('pop 与 gc 不带操作数', () => {
        const pop: any = (VMMap.get('pop') as any)(A, B, C)
        const gc: any = (VMMap.get('gc') as any)(A, B, C)
        expect(pop).toBeInstanceOf(POP)
        expect(gc).toBeInstanceOf(GC)
    })
})
