//check 的工具层:Scope 作用域引擎与类型工具函数,单测不经过 visitor
import {describe, expect, it} from 'vitest'
import {Round0} from '../../src/check/censor'
import {Round1, Round2} from '../../src/check/symbol'
import {Scope, param_is, pick_best, type_is, type_merge, type_same} from '../../src/check/tool'
import {check_rounds, parse, run_check} from './helper'
import {
    ArrayType,
    BooleanType,
    ClassType,
    EnumType,
    MapType,
    NumberType,
    PointType,
    StringType,
    VoidType
} from '../../src/utils'

const ROUNDS: [number, Map<any, any>][] = [[0, Round0], [1, Round1], [2, Round2]]
const M = (body: string) => `public m:module{ ${body} }`

describe('check/作用域与引擎', () => {
    it('scope.get 会先查本地,再沿 parent,最后查 global', () => {
        const scope = check_rounds([parse(M('public static v:number=1;'))], ROUNDS)
        expect(scope.get('m.v')).toBeTruthy()
        const inner = (scope as any).enter()
        inner.set('local', 'x')
        expect(inner.get('local')).toBe('x')
        expect(inner.get('m.v')).toBeTruthy()
        expect(inner.leave()).toBe(scope)
    })

    it('get 支持 up. 前缀向上一层找', () => {
        const scope = check_rounds([parse(M('public static v:number=1;'))], ROUNDS)
        scope.set('x', 'outer')
        const inner = (scope as any).enter()
        expect(inner.get('up.x')).toBe('outer')
    })

    it('root() 一路走到最外层', () => {
        const scope = check_rounds([parse(M(''))], ROUNDS)
        const inner = (scope as any).enter().enter()
        expect(inner.root()).toBe(scope)
    })

    it('Check.run 返回的 scope.error 带上收集到的诊断', () => {
        const scope: any = run_check([parse(M('public static f:void(){ undefined_name; }'))])
        expect(scope.error.join('')).toContain('未定义的变量')
    })

    it('诊断记在最外层作用域上,不会漏到 global 里', () => {
        const scope: any = run_check([parse(M('public static f:void(){ undefined_name; }'))])
        expect(scope.global.error).toEqual([])
    })
})

describe('check/tool·类型工具', () => {
    const scope = () => new Scope(null, new Scope(null, null)) as Scope

    it('type_same:同构才算同类型', () => {
        expect(type_same(new NumberType(), new NumberType())).toBe(true)
        expect(type_same(new NumberType(), new StringType())).toBe(false)
        expect(type_same(new ArrayType(new NumberType()), new ArrayType(new NumberType()))).toBe(true)
        expect(type_same(new ArrayType(new NumberType()), new ArrayType(new StringType()))).toBe(false)
        expect(type_same(new ClassType(['A']), new ClassType(['A']))).toBe(true)
        expect(type_same(new ClassType(['m', 'A']), new ClassType(['A']))).toBe(true)
        expect(type_same(new ClassType(['A']), new ClassType(['B']))).toBe(false)
    })

    it('type_same:PointType 单侧盒子会先解包', () => {
        expect(type_same(new PointType(new NumberType()), new NumberType())).toBe(true)
        expect(type_same(new NumberType(), new PointType(new NumberType()))).toBe(true)
    })

    it('type_same:null 只与 null 相同', () => {
        expect(type_same(null, null)).toBe(true)
        expect(type_same(new NumberType(), null)).toBe(false)
    })

    it('type_merge:Void 与任何类型合并都得到另一边', () => {
        const s = scope()
        expect(type_merge(new VoidType(), new NumberType(), s).constructor.name).toBe('NumberType')
        expect(type_merge(new NumberType(), new VoidType(), s).constructor.name).toBe('NumberType')
    })

    it('type_merge:不同基本类型合不出结果', () => {
        const s = scope()
        expect(type_merge(new NumberType(), new StringType(), s).constructor.name).toBe('VoidType')
    })

    it('type_merge:同构的 FixType 合出同构结果', () => {
        const s = scope()
        const m = type_merge(new ArrayType(new NumberType()), new ArrayType(new NumberType()), s)
        expect(m.constructor.name).toBe('ArrayType')
        expect((m as any).t.constructor.name).toBe('NumberType')
    })

    it('type_merge:构造器不同的 FixType 合不出结果', () => {
        const s = scope()
        expect(type_merge(new ArrayType(new NumberType()), new MapType(new NumberType()), s).constructor.name)
            .toBe('VoidType')
    })

    it('type_is / type_:Void 只与 Void 兼容', () => {
        const s = scope()
        expect(type_is(new NumberType(), new NumberType(), s)).toBe(true)
        expect(type_is(new NumberType(), new StringType(), s)).toBe(false)
        expect(type_is(new VoidType(), new VoidType(), s)).toBe(true)
        expect(type_is(new VoidType(), new NumberType(), s)).toBe(false)
    })

    it('param_is:形参个数与逐个可赋值', () => {
        const s = scope()
        expect(param_is([new NumberType()], new Map([['a', new NumberType()]]), s)).toBe(true)
        expect(param_is([new StringType()], new Map([['a', new NumberType()]]), s)).toBe(false)
        expect(param_is([], new Map([['a', new NumberType()]]), s)).toBe(false)
    })

    it('pick_best:数量不符返回 null,唯一可匹配返回 0', () => {
        const s = scope()
        const sets = [[new NumberType()], [new StringType()]]
        expect(pick_best(s, sets, [new NumberType()])).toBe(0)
        expect(pick_best(s, sets, [new BooleanType()])).toBe(null)
    })

    it('pick_best:多个可匹配时报歧义(-1)', () => {
        const s = scope()
        //两个完全一样的候选,谁都不比谁更具体
        const sets = [[new NumberType()], [new NumberType()]]
        expect(pick_best(s, sets, [new NumberType()])).toBe(-1)
    })

    it('type_same 能区分枚举与同名的 ClassType(点分后缀一致即同一)', () => {
        expect(type_same(new EnumType(['m', 'E']), new ClassType(['m', 'E']))).toBe(true)
        expect(type_same(new EnumType(['E']), new ClassType(['m', 'E']))).toBe(true)
    })
})
