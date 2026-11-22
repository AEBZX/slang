import {describe, expect, it} from 'vitest'
import {type_is, Scope} from '../../src/check/tool'
import {NumberType, BooleanType, VoidType, ArrayType, ReferenceType, PointType, LambdaType} from '../../src/utils'

const make_scope = () => new Scope(null, new Scope(null, null))
const num = () => new NumberType()
const bool = () => new BooleanType()

describe('check type_is: 字面量类型', () => {
    it('同种字面量类型相容(结构比较,非实例比较)', () => {
        expect(type_is(num(), num(), make_scope())).toBeInstanceOf(NumberType)
    })

    it('不同字面量类型不相容', () => {
        expect(type_is(num(), bool(), make_scope())).toBeInstanceOf(VoidType)
    })

    it('与 void 相容并返回另一侧', () => {
        expect(type_is(num(), new VoidType(), make_scope())).toBeInstanceOf(NumberType)
        expect(type_is(new VoidType(), num(), make_scope())).toBeInstanceOf(NumberType)
    })
})

describe('check type_is: 包装类型递归剥离', () => {
    it('引用类型剥离后比较', () => {
        expect(type_is(new ReferenceType(num()), num(), make_scope())).toBeInstanceOf(NumberType)
    })

    it('双层引用剥离', () => {
        expect(type_is(new ReferenceType(new ReferenceType(num())), num(), make_scope())).toBeInstanceOf(NumberType)
    })

    it('数组归并返回元素类型', () => {
        //type_is 是归并语义:数组的公共超类型是其元素类型
        expect(type_is(new ArrayType(num()), new ArrayType(num()), make_scope())).toBeInstanceOf(NumberType)
        expect(type_is(new ArrayType(num()), new ArrayType(bool()), make_scope())).toBeInstanceOf(VoidType)
    })

    it('指针归并返回元素类型', () => {
        expect(type_is(new PointType(num()), new PointType(num()), make_scope())).toBeInstanceOf(NumberType)
    })

    it('lambda 归并返回 lambda,参数失配时参数位为 void', () => {
        const mk = () => new LambdaType(new Map(), new Map([['a', num()]]), num())
        const merged = type_is(mk(), mk(), make_scope()) as LambdaType
        expect(merged).toBeInstanceOf(LambdaType)
        const other = new LambdaType(new Map(), new Map([['a', bool()]]), num())
        const merged_bad = type_is(mk(), other, make_scope()) as LambdaType
        expect(merged_bad).toBeInstanceOf(LambdaType)
        expect(merged_bad.params.get('a')).toBeInstanceOf(VoidType)
    })
})
