import {describe, expect, it} from 'vitest'
import {parse, parse_type} from './helper'

const kids = (src: string) => (parse(src) as any).children.map((c: any) => c.constructor.name)
const M = (body: string) => `public m:module{ ${body} }`

describe('parser/声明·块', () => {
    it('模块', () => {
        expect(kids('public m:module{ }')).toEqual(['Module'])
    })

    it('类与类成员', () => {
        expect(kids('public C:class{ public a:number; }')).toEqual(['Class'])
        expect(kids('public C:class{ public static f:number(x:number){ return x; } }')).toEqual(['Class'])
    })

    it('泛型类', () => {
        expect(kids('public C:class<T>{ public a:@T; }')).toEqual(['Class'])
    })

    it('类可以 implements', () => {
        expect(kids('public C:class implements number{ }')).toEqual(['Class'])
    })

    it('接口:方法用分号结尾,没有函数体', () => {
        expect(kids('public I:interface{ public static f:number(x:number); }')).toEqual(['Interface'])
    })

    it('枚举', () => {
        expect(kids('public E:enum{A,B}')).toEqual(['Enum'])
    })

    it('函数与变量', () => {
        expect(kids(M('public static f:number(a:number){ return a; }'))).toEqual(['Module'])
        expect(kids(M('public static a:number;'))).toEqual(['Module'])
    })

    it('泛型函数', () => {
        expect(kids(M('public static f:<T>T(x:@T){ return x; }'))).toEqual(['Module'])
    })

    it('多个块并列', () => {
        expect(kids('public a:module{ } public b:module{ }')).toEqual(['Module', 'Module'])
    })
})

describe('parser/声明·link', () => {
    it('link 模块路径 as 别名', () => {
        expect(kids('link a.b as c; public m:module{ }')).toEqual(['Module'])
    })
})

describe('parser/类型', () => {
    it('基础类型', () => {
        expect(parse_type('number').constructor.name).toBe('NumberType')
        expect(parse_type('string').constructor.name).toBe('StringType')
        expect(parse_type('boolean').constructor.name).toBe('BooleanType')
        expect(parse_type('void').constructor.name).toBe('VoidType')
    })

    it('数组/映射/指针后缀', () => {
        expect(parse_type('number[]').constructor.name).toBe('ArrayType')
        expect(parse_type('number{}').constructor.name).toBe('MapType')
        expect(parse_type('number*').constructor.name).toBe('PointType')
    })

    it('后缀可以叠加,最外层是最后一个后缀', () => {
        expect(parse_type('number[]{}').constructor.name).toBe('MapType')
        expect(parse_type('number{}[]').constructor.name).toBe('ArrayType')
    })

    it('类类型:点路径与泛型参数', () => {
        expect(parse_type('C.D').constructor.name).toBe('ClassType')
        expect(parse_type('C<T>').constructor.name).toBe('ClassType')
    })

    it('lambda 类型:参数要带名字和类型', () => {
        expect(parse_type('(x:number)=>number').constructor.name).toBe('LambdaType')
        expect(parse_type('(x:number,y:string)=>void').constructor.name).toBe('LambdaType')
    })

    it('泛型参数类型 @T', () => {
        expect(parse_type('@T').constructor.name).toBe('GenericType')
    })
})
