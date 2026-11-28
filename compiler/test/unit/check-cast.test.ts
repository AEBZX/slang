import {describe, expect, it} from 'vitest'
import {run_to_check, run_to_desugar} from '../helpers'
import {NumberType} from '../../src/utils'

//cast 语义:cast 以"输出类型"决议,使用点按目标类型查询;
//引用串为相对名 cast@<id>,脱糖落地为 <值>.cast@<id>() 成员调用(接收者绑定第一形参)
const CAST_CLASS = `app: module {
    c: class {
        to: cast number (x: c) => number { return 1; }
    }
    main: void() {
        var a: c = new c();
        var n: number = a;
    }
}`

describe('check cast: 隐式转换', () => {
    it('类 cast 用于变量声明的隐式转换', () => {
        const {files, scope} = run_to_check(CAST_CLASS)
        expect(scope.global.error).toHaveLength(0)
        const decl = (files[0].children[0] as any).children[1].commands.commands[1]
        //cast 串与转换后类型都记在被转换的表达式上
        expect(decl.value.cast).toBe('cast@0')
        expect(decl.value.type).toBeInstanceOf(NumberType)
    })

    it('类 cast 用于 return 转换', () => {
        const {files, scope} = run_to_check(`app: module {
    c: class {
        to: cast number (x: c) => number { return 1; }
    }
    f: number() {
        var a: c = new c();
        return a;
    }
}`)
        expect(scope.global.error).toHaveLength(0)
        const ret = (files[0].children[0] as any).children[1].commands.commands[1]
        expect(ret.data.cast).toBe('cast@0')
    })
})

describe('check cast: 显式转换与 value 块', () => {
    it('(number)a 显式强转命中 cast 成员', () => {
        const {files, scope} = run_to_check(`app: module {
    c: class {
        to: cast number (x: c) => number { return 1; }
    }
    main: void() {
        var a: c = new c();
        var n: number = (number)a;
    }
}`)
        expect(scope.global.error).toHaveLength(0)
        const decl = (files[0].children[0] as any).children[1].commands.commands[1]
        expect(decl.value.type).toBeInstanceOf(NumberType)
        //cast 串记在 TypePrefix 节点上
        expect(decl.value.cast).toBe('cast@0')
    })

    it('value 块 cast 在 desugar 后为 Module(number) 下的 cast@N', () => {
        const desugared = run_to_desugar(`value number {
    cast boolean (x: number) => boolean { return true; }
}`) as any
        const value_module = desugared[0].children[0]
        expect(value_module.name).toBe('number')
        expect(value_module.children[0].constructor.name).toBe('Variable')
        expect(value_module.children[0].name).toBe('cast@0')
    })
})

describe('check cast: 脱糖落地', () => {
    it('cast 使用点脱糖为 a.cast@N() 成员调用且实参标记被消费', () => {
        const desugared = run_to_desugar(CAST_CLASS) as any
        //脱糖后 main 是 Variable:value=LambdaExpression(body=ListCommand)
        const value = desugared[0].children[0].children[1].value.body.commands[1].value
        //ArgumentsPostfix(a.cast@0)(),接收者经 D_Arguments 补进参数区首位
        expect(value.constructor.name).toBe('ArgumentsPostfix')
        expect(value.expr.name).toBe('cast@0')
        expect(value.expr.expr.name).toBe('a')
        expect(value.args).toHaveLength(1)
        expect(value.args[0].name).toBe('a')
        //cast 标记已被包装消费,不能残留(残留会无限递归)
        expect(value.args[0].cast).toBeFalsy()
    })
})

describe('check cast: 决议失败', () => {
    it('两个同参数同输出的 cast 无法具体性决议', () => {
        const {scope} = run_to_check(`app: module {
    c: class {
        a: cast number (x: c) => number { return 1; }
        b: cast number (x: c) => number { return 2; }
    }
    main: void() {
        var v: c = new c();
        var n: number = v;
    }
}`)
        expect(scope.global.error.length).toBeGreaterThan(0)
    })

    it('无 cast 时跨类型赋值报错', () => {
        const {scope} = run_to_check(`app: module {
    c: class { }
    main: void() {
        var a: c = new c();
        var n: number = a;
    }
}`)
        expect(scope.global.error.length).toBeGreaterThan(0)
    })
})
