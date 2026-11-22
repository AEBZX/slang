import {describe, expect, it} from 'vitest'
import {Scope} from '../../src/check/tool'
import {NumberType} from '../../src/utils'

const make_root = () => new Scope(null, new Scope(null, null))

describe('check Scope: enter/leave 与显式传参', () => {
    it('enter 产生子作用域并继承函数返回类型', () => {
        const root = make_root()
        root.ret = new NumberType()
        const child = root.enter()
        expect(child.parent).toBe(root)
        expect(child.ret).toBeInstanceOf(NumberType)
        expect(child.leave()).toBe(root)
    })

    it('enter(func) 标记函数作用域边界', () => {
        const root = make_root()
        const fn_scope = root.enter(true)
        expect(fn_scope.func).toBe(true)
        expect(root.enter().func).toBe(false)
    })
})

describe('check Scope: label 注册与延迟结算', () => {
    it('label 注册到函数作用域,子作用域经父链可见', () => {
        const root = make_root()
        const fn_scope = root.enter(true)
        const list_scope = fn_scope.enter()
        list_scope.register_label('skip', {} as any)
        expect(fn_scope.label.includes('skip')).toBe(true)
        expect(list_scope.label.includes('skip')).toBe(false)
    })

    it('leave 时未定义的延迟 goto 报错', () => {
        const root = make_root()
        const fn_scope = root.enter(true)
        fn_scope.delay_set('nowhere', {} as any)
        fn_scope.leave()
        //thr 经 global 链写入第二根作用域的 error
        expect(root.global.error.length).toBeGreaterThan(0)
    })

    it('延迟 goto 在 label 定义后正常结算', () => {
        const root = make_root()
        const fn_scope = root.enter(true)
        const list_scope = fn_scope.enter()
        list_scope.delay_set('skip', {} as any)
        fn_scope.register_label('skip', {} as any)
        fn_scope.leave()
        expect(root.global.error).toHaveLength(0)
    })

    it('同一函数内重复 label 报错', () => {
        const root = make_root()
        const fn_scope = root.enter(true)
        fn_scope.register_label('dup', {} as any)
        fn_scope.register_label('dup', {} as any)
        expect(root.global.error.length).toBeGreaterThan(0)
    })
})

describe('check Scope: 循环标记', () => {
    it('_loop 沿父链传播', () => {
        const root = make_root()
        const loop_scope = root.enter()
        loop_scope._loop = true
        const body_scope = loop_scope.enter()
        expect(body_scope.loop()).toBe(true)
        expect(root.loop()).toBe(false)
    })
})

describe('check Scope: 符号表', () => {
    it('set/get 沿父链解析', () => {
        const root = make_root()
        root.set('x', new NumberType())
        const child = root.enter()
        expect(child.get('x')).toBeInstanceOf(NumberType)
    })

    it('子作用域的新符号不回写父作用域', () => {
        const root = make_root()
        const child = root.enter()
        child.set('y', new NumberType())
        expect(root.get('y')).toBeNull()
    })
})
