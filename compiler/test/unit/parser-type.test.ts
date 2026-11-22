import {describe, expect, it} from 'vitest'
import parser from '../../src/parser'
import {lexer, tokens} from '../../src/utils'
import {ArrayType, BooleanType, ClassType, GenericType, LambdaType, NumberType, PointType, ReferenceType, VoidType} from '../../src/utils'

const parse_type = (src: string) => {
    const file = parser.run([lexer(`m: ${src};`, tokens)])[0] as any
    return file.children[0].t
}

describe('parser 类型语法', () => {
    it('基础字面量类型', () => {
        expect(parse_type('number')).toBeInstanceOf(NumberType)
        expect(parse_type('boolean')).toBeInstanceOf(BooleanType)
        expect(parse_type('void')).toBeInstanceOf(VoidType)
    })

    it('数组/指针/引用后缀', () => {
        const array = parse_type('number[]') as ArrayType
        expect(array).toBeInstanceOf(ArrayType)
        expect(array.t).toBeInstanceOf(NumberType)
        expect(parse_type('number*')).toBeInstanceOf(PointType)
        expect(parse_type('number&')).toBeInstanceOf(ReferenceType)
    })

    it('后缀可叠加', () => {
        const nested = parse_type('number[]&') as ReferenceType
        expect(nested).toBeInstanceOf(ReferenceType)
        expect(nested.t).toBeInstanceOf(ArrayType)
    })

    it('泛型 @T', () => {
        const generic = parse_type('@T') as GenericType
        expect(generic).toBeInstanceOf(GenericType)
        expect(generic.generic).toBe('T')
    })

    it('类路径与泛型实参', () => {
        const class_type = parse_type('a.b.C<number>') as ClassType
        expect(class_type).toBeInstanceOf(ClassType)
        expect(class_type.local).toEqual(['a', 'b', 'C'])
        expect(class_type.generic).toHaveLength(1)
        expect(class_type.generic[0]).toBeInstanceOf(NumberType)
    })

    it('lambda 类型', () => {
        const lambda = parse_type('()=>void') as LambdaType
        expect(lambda).toBeInstanceOf(LambdaType)
        expect(lambda.params.size).toBe(0)
        expect(lambda.returnType).toBeInstanceOf(VoidType)
    })

    it('lambda 类型带参数', () => {
        const lambda = parse_type('(x: number)=>boolean') as LambdaType
        expect(lambda.params.size).toBe(1)
        expect(lambda.returnType).toBeInstanceOf(BooleanType)
    })
})
