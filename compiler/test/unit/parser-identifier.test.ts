import {describe, expect, it} from 'vitest'
import {parse, parse_function, parse_type, type_str} from './helper'

//把类型源码解析成类型节点并渲染回字符串
const T = (src: string) => type_str(parse_type(src))

describe('parser/类型', () => {
    it('四个基本类型', () => {
        expect(T('number')).toBe('number')
        expect(T('boolean')).toBe('boolean')
        expect(T('string')).toBe('string')
        expect(T('void')).toBe('void')
    })

    it('括号包裹的类型', () => {
        expect(T('(number)')).toBe('number')
        expect(T('((number))')).toBe('number')
    })

    it('数组后缀,可叠加', () => {
        expect(T('number[]')).toBe('number[]')
        expect(T('number[][]')).toBe('number[][]')
    })

    it('Map 后缀', () => {
        expect(T('number{}')).toBe('number{}')
        expect(T('string{}')).toBe('string{}')
    })

    it('指针后缀', () => {
        expect(T('number*')).toBe('number*')
        expect(T('number**')).toBe('number**')
    })

    it('后缀可以混合并按书写顺序包裹', () => {
        expect(T('number[]{}')).toBe('number[]{}')
        expect(T('number{}[]')).toBe('number{}[]')
        expect(T('number*[]')).toBe('number*[]')
    })

    it('点分类型名', () => {
        expect(T('std.math.Item')).toBe('std.math.Item')
        expect(T('Item')).toBe('Item')
    })

    it('带泛型实参的类型', () => {
        expect(T('Box<number>')).toBe('Box<number>')
        expect(T('Box<number,string>')).toBe('Box<number,string>')
        expect(T('Box<std.math.Item>')).toBe('Box<std.math.Item>')
    })

    it('泛型参数的泛型形参', () => {
        expect(T('Box<@T>')).toBe('Box<@T>')
        expect(T('@T')).toBe('@T')
    })

    it('泛型类型可以带后缀', () => {
        expect(T('Box<number>[]')).toBe('Box<number>[]')
        expect(T('Box<number>*')).toBe('Box<number>*')
    })

    it('函数类型', () => {
        expect(T('()=>void')).toBe('()=>void')
        expect(T('(a:number)=>number')).toBe('(a:number)=>number')
        expect(T('(a:number,b:string)=>boolean')).toBe('(a:number,b:string)=>boolean')
    })

    it('函数类型的参数与返回值也可以是复合类型', () => {
        expect(T('(a:number[])=>string{}')).toBe('(a:number[])=>string{}')
        expect(T('(a:Box<number>)=>std.math.Item')).toBe('(a:Box<number>)=>std.math.Item')
    })

    it('返回类型按类型解析,而不是把 => 后的东西吃掉', () => {
        //回归:参数表槽位错位会导致返回值解析成参数
        expect(T('(a:number)=>string')).toBe('(a:number)=>string')
    })

    it('函数类型的空实参表合法', () => {
        expect(T('()=>number')).toBe('()=>number')
    })

    it('参数类型可以是泛型形参', () => {
        expect(T('(a:@T)=>@T')).toBe('(a:@T)=>@T')
    })

    //已知缺陷:compiler/parser/cst/identifier.ts:8
    //LambdaType 写成 $.c('Generic',$.r('GenericList')),但 $.c 的签名是 choose_rule(...data),
    //没有 name 形参 —— 'Generic' 变成了 choose 的第一个「字面量分支」。
    //parse_choose 在第一个分支抛错时直接结束并返回 null,于是 GenericList 那条根本没被尝试,
    //泛型函数类型(lambda type)永远解析不出来。
    //对照 cst/expr.ts:12 的 LambdaExpression 写的是 $.c($.r('GenericList')),是对的。
    it.fails('函数类型声明泛型形参', () => {
        expect(T('<T>(a:@T)=>@T')).toBe('<T>(a:@T)=>@T')
    })

    it.fails('函数类型的泛型形参 + 空实参表', () => {
        expect(T('<T>()=>@T')).toBe('<T>()=>@T')
    })
})

describe('parser/类型在声明位置', () => {
    it('函数参数类型', () => {
        const fn = parse_function('', 'number(a:number[],b:std.math.Item)')
        expect(type_str(fn.params.get('a'))).toBe('number[]')
        expect(type_str(fn.params.get('b'))).toBe('std.math.Item')
    })

    it('函数返回类型', () => {
        expect(type_str(parse_function('', 'string{}()').return_type)).toBe('string{}')
    })

    it('无参数表时参数为空', () => {
        expect(parse_function('', 'void()').params.size).toBe(0)
    })

    it('顶层变量声明的类型', () => {
        expect(type_str(parse('v:number*;').children[0].t)).toBe('number*')
    })
})
