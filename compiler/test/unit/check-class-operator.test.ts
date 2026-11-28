import {describe, expect, it} from 'vitest'
import {run_to_check, run_to_desugar} from '../helpers'
import {NumberType, Operation, Variable} from '../../src/utils'

const CLASS_WITH_ADD = `app: module {
    c: class {
        add: operation '+' (x: c, y: c) => c { return x; }
    }
    main: void() {
        var a: c = new c();
        var b: c = new c();
        var s: c = a + b;
    }
}`

describe('check class: operation/cast 成员', () => {
    it('带 operation 成员的 class 通过 check', () => {
        const {scope} = run_to_check(CLASS_WITH_ADD)
        expect(scope.global.error).toHaveLength(0)
    })

    it('实例二元运算命中类 operation', () => {
        const {files} = run_to_check(CLASS_WITH_ADD)
        const module_block = files[0].children[0] as any
        const main_fn = module_block.children[1]
        const decl = main_fn.commands.commands[2]
        //引用串为相对名:运算符@序号
        expect(decl.value.oper).toBe('+@0')
    })

    it('operation 成员在 desugar 后挂到类内并带运算符名', () => {
        const desugared = run_to_desugar(CLASS_WITH_ADD) as any
        const class_block = desugared[0].children[0].children[0]
        const op_member = class_block.children[0] as Variable
        expect(op_member).toBeInstanceOf(Variable)
        expect(op_member.name).toBe('+@0')
    })
})

describe('check class: cast 成员', () => {
    it('带 cast 成员的 class 通过 check 且成员被解析', () => {
        const {files, scope} = run_to_check(`app: module {
    c: class {
        to: cast number (x: c) => number { return 1; }
    }
    main: void() {
        var a: c = new c();
    }
}`)
        expect(scope.global.error).toHaveLength(0)
        const module_block = files[0].children[0] as any
        const class_block = module_block.children[0]
        expect(class_block.children[0].constructor.name).toBe('Cast')
        expect(class_block.children[0].name).toBe('to')
        expect(class_block.children[0].t).toBeInstanceOf(NumberType)
    })
})

describe('check class: 普通成员不受影响', () => {
    it('带函数与变量成员的 class 通过 check', () => {
        const {scope} = run_to_check('app: module { c: class { f: void() { } v: number = 1; } main: void() { } }')
        expect(scope.global.error).toHaveLength(0)
        const {files} = run_to_check('app: module { c: class { f: void() { } } main: void() { } }')
        const fn = (files[0].children[0] as any).children[0].children[0]
        //跨模块 instanceof 不可靠,用构造名断言(check 阶段未降糖,name 仍为 f)
        expect(fn.constructor.name).toBe('Function')
        expect(fn.name).toBe('f')
    })

    it('operation 成员仍可经 Operation 节点被 censor 识别', () => {
        const {files} = run_to_check(CLASS_WITH_ADD)
        const class_block = (files[0].children[0] as any).children[0]
        const op_node = class_block.children[0]
        expect(op_node).toBeInstanceOf(Operation)
    })
})
