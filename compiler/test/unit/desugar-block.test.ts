import {describe, expect, it} from 'vitest'
import {run_to_desugar} from '../helpers'
import {LambdaExpression, LambdaType, ListCommand, Module, NumberType, Return, Variable} from '../../src/utils'

describe('desugar block: 函数降糖', () => {
    it('函数降为 Variable(name@index) 且值为 lambda', () => {
        const desugared = run_to_desugar('app: module { f: void() { } }') as any
        const fn_var = desugared[0].children[0].children[0] as Variable
        expect(fn_var).toBeInstanceOf(Variable)
        expect(fn_var.name).toBe('f@0')
        expect(fn_var.t).toBeInstanceOf(LambdaType)
        expect(fn_var.value).toBeInstanceOf(LambdaExpression)
    })

    it('constructor 追加隐式 return this', () => {
        const desugared = run_to_desugar('app: module { i: interface { } c: class implements i { constructor: void() { } } }') as any
        const module_block = desugared[0].children[0]
        const class_block = module_block.children[1]
        const ctor = class_block.children[0] as Variable
        expect(ctor.name).toBe('constructor@0')
        const body = ctor.value.body
        const last = body.commands[body.commands.length - 1]
        expect(last).toBeInstanceOf(Return)
        expect(last.data.name).toBe('this')
    })
})

describe('desugar block: enum 降糖', () => {
    it('enum 展开为一组 number 变量', () => {
        const desugared = run_to_desugar('app: module { e: enum { A, B } }') as any
        //D_Enum 产出 Module('e'),变量在其 children 里
        const enum_module = desugared[0].children[0].children[0] as Module
        expect(enum_module.name).toBe('e')
        const enum_var = enum_module.children[0] as Variable
        expect(enum_var.t).toBeInstanceOf(NumberType)
        expect(enum_var.value.value).toBe('0')
        const enum_var2 = enum_module.children[1] as Variable
        expect(enum_var2.value.value).toBe('1')
    })
})

describe('desugar block: value 降糖', () => {
    it('value 块转为固定名字的 module', () => {
        const desugared = run_to_desugar("value number { operation '+' (a: number, b: number) => number { } }") as any
        const value_module = desugared[0].children[0] as Module
        expect(value_module).toBeInstanceOf(Module)
        expect(value_module.name).toBe('number')
        expect((value_module.children[0] as Variable).name).toBe('operation@0')
    })
})
