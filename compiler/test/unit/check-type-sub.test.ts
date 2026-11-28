import {describe, expect, it} from 'vitest'
import {type_sub, Scope} from '../../src/check/tool'
import {NumberType, BooleanType, VoidType, ReferenceType, ArrayType, LambdaType, ClassType} from '../../src/utils'

const make_scope = () => new Scope(null, new Scope(null, null))
const num = () => new NumberType()
const bool = () => new BooleanType()

describe('check type_sub: 基础判定', () => {
    it('同种字面量类型是子类型', () => {
        expect(type_sub(num(), num(), make_scope())).toBe(true)
    })

    it('不同字面量类型不是子类型', () => {
        expect(type_sub(num(), bool(), make_scope())).toBe(false)
    })

    it('undefined 参数安全返回 false(不崩溃)', () => {
        expect(type_sub(num(), undefined as any, make_scope())).toBe(false)
        expect(type_sub(undefined as any, num(), make_scope())).toBe(false)
    })

    it('VoidType 作为子类型恒相容', () => {
        expect(type_sub(new VoidType(), num(), make_scope())).toBe(true)
    })
})

describe('check type_sub: 包装类型', () => {
    it('引用双向剥离(number 可赋给 number& 反之亦然)', () => {
        const scope = make_scope()
        expect(type_sub(new ReferenceType(num()), num(), make_scope())).toBe(true)
        expect(type_sub(num(), new ReferenceType(num()), make_scope())).toBe(true)
    })

    it('数组按元素逐位相容', () => {
        //同种包装类型做元素级比较,不再整体快捷相容
        expect(type_sub(new ArrayType(num()), new ArrayType(num()), make_scope())).toBe(true)
        expect(type_sub(new ArrayType(num()), new ArrayType(bool()), make_scope())).toBe(false)
    })
})

describe('check type_sub: lambda', () => {
    it('lambda 按参数/返回值逐位相容', () => {
        const scope = make_scope()
        const a = new LambdaType(new Map(), new Map([['x', num()]]), num())
        const b = new LambdaType(new Map(), new Map([['x', num()]]), num())
        expect(type_sub(a, b, scope)).toBe(true)
        const bad_ret = new LambdaType(new Map(), new Map([['x', num()]]), bool())
        expect(type_sub(a, bad_ret, scope)).toBe(false)
    })
})

describe('check type_sub: ClassType', () => {
    it('ClassType 同类相容,跨类不相容(除非 implements)', () => {
        expect(type_sub(new ClassType(['app','c']), new ClassType(['app','c']), make_scope())).toBe(true)
        expect(type_sub(new ClassType(['app','c']), new ClassType(['app','d']), make_scope())).toBe(false)
    })
})
