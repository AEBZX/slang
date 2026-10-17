import {describe, expect, it} from 'vitest'
import {parse, check_src} from './helper'
import {BINARY, CALL} from '../../src/utils'
import {all_of, ir_of} from './helper-ir'

const VALUE = `value number{ operation +(a:number,b:number)=>number{ return a-b; } }`
const M = (body: string) => `public m:module{ public static f:number(a:number){ ${body} } }`
const kids = (src: string) => (parse(src) as any).children.map((c: any) => c.constructor.name)

describe('parser/value 块', () => {
    it('空 value 块', () => {
        expect(kids('value number{ }')).toEqual(['Value'])
    })

    it('operation 与 cast 都在 value 块里', () => {
        expect(kids(VALUE)).toEqual(['Value'])
        expect(kids(`value string{ cast string(a:number)=>string{ return a; } }`)).toEqual(['Value'])
    })

    it('一个 value 块里可以有多条', () => {
        expect(kids(`value number{
            operation +(a:number,b:number)=>number{ return a; }
            operation -(a:number,b:number)=>number{ return a; }
            cast string(a:number)=>string{ return a; }
        }`)).toEqual(['Value'])
    })

    it('lambda 表达式要写 => 返回类型', () => {
        expect(kids(M('var g:(x:number)=>number=(x:number)=>number{ return x; }; return g(a);')))
            .toEqual(['Module'])
    })
})

describe('check/自定义运算符与转换', () => {
    it('定义了 operation 后,用 + 不报错', () => {
        expect(check_src(VALUE + M('return a+1;'))).toEqual([])
    })

    it('operation 的返回类型不符会报错', () => {
        const bad = `value number{ operation +(a:number,b:number)=>number{ return "s"; } }` + M('return a+1;')
        expect(check_src(bad).length).toBeGreaterThan(0)
    })

    it('operation 的形参类型写错会被接受(用不上就是普通函数)', () => {
        const other = `value number{ operation +(a:string,b:string)=>string{ return a; } }` + M('return a+1;')
        expect(check_src(other)).toEqual([])
    })

    it('cast 定义后可以写出来', () => {
        const src = `value number{ cast string(a:number)=>string{ return "x"; } }` + M('return a;')
        expect(check_src(src)).toEqual([])
    })
})

describe('集成/自定义 operation 会走调用而不是内建运算', () => {
    it('有自定义 + 时,源码里的 + 变成 CALL', () => {
        const tool = ir_of(VALUE + M('return a+1;'))
        expect(all_of(tool, CALL).length).toBeGreaterThan(0)
        expect(all_of(tool, BINARY).filter((b: BINARY) => b.id == 'add').length).toBe(0)
    })

    it('没有自定义 + 时,+ 就是内建的二元运算', () => {
        const tool = ir_of(M('return a+1;'))
        expect(all_of(tool, BINARY).filter((b: BINARY) => b.id == 'add').length).toBeGreaterThan(0)
    })
})
