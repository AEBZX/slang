import {describe, expect, it} from 'vitest'
import {run_to_check} from '../helpers'

//check 错误以异常形式抛出,捕获后断言消息
const censor_errors = (src: string): string[] => {
    try {
        const {scope} = run_to_check(src)
        return scope.global.error
    } catch (e: any) {
        return String(e.message).split('\n').slice(1)
    }
}

describe('check censor: 结构校验', () => {
    it('合法程序无错误', () => {
        expect(censor_errors('app: module { main: void() { var x: number = 1; } }')).toHaveLength(0)
    })

    it('文件顶层只能是 value/module', () => {
        expect(censor_errors('bad: class { }').some(e => e.includes('文件顶层'))).toBe(true)
    })

    it('break 在循环外报错', () => {
        expect(censor_errors('app: module { main: void() { break; } }').some(e => e.includes('break/continue'))).toBe(true)
    })

    it('break 在循环内合法', () => {
        expect(censor_errors('app: module { main: void() { while (1) { break; } } }')).toHaveLength(0)
    })

    it('continue 在 while 内合法', () => {
        expect(censor_errors('app: module { main: void() { while (1) { continue; } } }')).toHaveLength(0)
    })

    it('continue 在 for 内合法', () => {
        expect(censor_errors('app: module { main: void() { for (var i: number = 0; i < 3; i = i + 1;) { continue; } } }')).toHaveLength(0)
    })

    it('引用类型必须初始化', () => {
        expect(censor_errors('app: module { main: void() { var r: number&; } }').some(e => e.includes('引用类型必须初始化'))).toBe(true)
    })

    it('enum 成员重名报错', () => {
        expect(censor_errors('app: module { e: enum { A, A } }').some(e => e.includes('enum'))).toBe(true)
    })

    it('未定义变量报错', () => {
        expect(censor_errors('app: module { main: void() { y = 1; } }').some(e => e.includes('未定义的变量'))).toBe(true)
    })
})
