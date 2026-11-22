import {describe, expect, it} from 'vitest'
import parser from '../../src/parser'
import {lexer, tokens} from '../../src/utils'
import {
    Class, Enum, Function, Link, Module, NumberType, Operation, Variable, Value
} from '../../src/utils'

const parse_file = (src: string) => parser.run([lexer(src, tokens)])[0] as any

describe('parser 块与文件', () => {
    it('link 语句', () => {
        const file = parse_file('link a.b as c;')
        expect(file.links).toHaveLength(1)
        const link = file.links[0] as Link
        expect(link.module).toEqual(['a', 'b'])
        expect(link.as).toBe('c')
    })

    it('module 块与嵌套', () => {
        const file = parse_file('app: module { util: module { } }')
        const app = file.children[0] as Module
        expect(app).toBeInstanceOf(Module)
        expect(app.name).toBe('app')
        expect(app.children[0].name).toBe('util')
    })

    it('块修饰符 private', () => {
        const file = parse_file('app: module { helper: module { } }')
        const app = file.children[0] as Module
        expect(app.modifiers).toBeDefined()
        const inner = parse_file('app: module { secret: module { } }').children[0].children[0]
        expect(inner).toBeInstanceOf(Module)
    })

    it('class 带泛型与 implements', () => {
        const file = parse_file('app: module { c: class<T> implements I { } }')
        const class_block = file.children[0].children[0] as Class
        expect(class_block).toBeInstanceOf(Class)
        expect(class_block.generic.has('T')).toBe(true)
        expect(class_block.implement).toBeDefined()
    })

    it('enum 成员列表', () => {
        const file = parse_file('app: module { e: enum { A, B } }')
        const enum_block = file.children[0].children[0] as Enum
        expect(enum_block).toBeInstanceOf(Enum)
        expect(enum_block.children).toEqual(['A', 'B'])
    })

    it('函数声明', () => {
        const file = parse_file('app: module { f: number(a: number) { return a; } }')
        const fn = file.children[0].children[0] as Function
        expect(fn).toBeInstanceOf(Function)
        expect(fn.return_type).toBeInstanceOf(NumberType)
        expect(fn.params.size).toBe(1)
        expect(fn.commands).toBeDefined()
    })

    it('变量声明块', () => {
        const file = parse_file('app: module { v: number = 1; }')
        const variable = file.children[0].children[0] as Variable
        expect(variable).toBeInstanceOf(Variable)
        expect(variable.t).toBeInstanceOf(NumberType)
        expect(variable.value).toBeDefined()
    })

    it('value 块含 operation', () => {
        const file = parse_file('value number { operation \'+\' (a: number, b: number) => number { } }')
        const value_block = file.children[0] as Value
        expect(value_block).toBeInstanceOf(Value)
        expect(value_block.value).toBeInstanceOf(NumberType)
        expect(value_block.children[0]).toBeInstanceOf(Operation)
    })
})
