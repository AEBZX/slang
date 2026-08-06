import { describe, it, expect } from 'vitest'
import {
    ArrayFix,
    FixType,
    LambdaType,
    MapFix,
    NumberType,
    Scope,
    StringType,
    type_merge,
    VoidType
} from '../../utils'

function make_scope(): Scope {
    return new Scope(null, new Scope(null, null))
}

// ==================== Scope ====================
describe('Scope', () => {
    it('get 未命中返回 undefined 而非崩溃', () => {
        const root = make_scope()
        expect(root.get('x')).toBeUndefined()
    })

    it('get_sym 未命中返回 undefined 而非崩溃', () => {
        const root = make_scope()
        expect(root.get_sym(new NumberType())).toBeUndefined()
    })

    it('子作用域向上查找', () => {
        const root = make_scope()
        const child = root.enter()
        root.set('a', new NumberType())
        expect(child.get('a')).toBeInstanceOf(NumberType)
        expect(root.get_sym(new NumberType())).toBeUndefined()
    })

    it('thr 写入全局错误', () => {
        const root = make_scope()
        const child = root.enter()
        child.thr('err1')
        expect(root.global.error).toContain('err1')
    })
})

// ==================== type_merge ====================
describe('type_merge', () => {
    it('相同基本类型合并', () => {
        const scope = make_scope()
        expect(type_merge(new NumberType(), new NumberType(), scope)).toBeInstanceOf(NumberType)
    })

    it('不同基本类型返回 VoidType', () => {
        const scope = make_scope()
        expect(type_merge(new NumberType(), new StringType(), scope)).toBeInstanceOf(VoidType)
    })

    it('混合类型(如 FixType 与基本类型)不返回 undefined', () => {
        const scope = make_scope()
        const f = new FixType(new NumberType(), [new ArrayFix()])
        expect(type_merge(f, new NumberType(), scope)).toBeInstanceOf(VoidType)
    })

    it('相同 LambdaType 合并返回该 LambdaType', () => {
        const scope = make_scope()
        const lt = new LambdaType(new Map(), new VoidType(), false)
        expect(type_merge(lt, lt, scope)).toBeInstanceOf(LambdaType)
    })

    it('FixType 合并后不共享 fix 数组', () => {
        const scope = make_scope()
        const f1 = new FixType(new NumberType(), [new ArrayFix()])
        const f2 = new FixType(new NumberType(), [new ArrayFix()])
        const merged = type_merge(f1, f2, scope) as FixType
        expect(merged).toBeInstanceOf(FixType)
        merged.fix.push(new MapFix())
        expect(f1.fix).toHaveLength(1)
        expect(f2.fix).toHaveLength(1)
    })

    it('FixType 基础类型不兼容返回 VoidType', () => {
        const scope = make_scope()
        const f1 = new FixType(new NumberType(), [new ArrayFix()])
        const f2 = new FixType(new StringType(), [new ArrayFix()])
        expect(type_merge(f1, f2, scope)).toBeInstanceOf(VoidType)
    })
})
