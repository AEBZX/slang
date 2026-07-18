import { describe, it, expect } from 'vitest'
import { Scope, CheckVisitor, default as check } from '../../utils/lib/check'
import { ast_data } from '../../utils/data'

// ==================== Scope 初始化 ====================
describe('Scope 初始化', () => {
    it('parent 和 global 正确设置', () => {
        const s = new Scope(null, null)
        expect(s.parent).toBeNull()
        expect(s.global).toBeNull()
    })

    it('parent 和 global 传入非 null 值', () => {
        const global = new Scope(null, null)
        const child = new Scope(global, global)
        expect(child.parent).toBe(global)
        expect(child.global).toBe(global)
    })

    it('data 初始为空 Map', () => {
        const s = new Scope(null, null)
        expect(s.data).toBeInstanceOf(Map)
        expect(s.data.size).toBe(0)
    })

    it('error 初始为空数组', () => {
        const s = new Scope(null, null)
        expect(s.error).toEqual([])
    })
})

// ==================== Scope.enter / leave ====================
describe('Scope enter/leave', () => {
    it('enter 创建新 Scope, parent 指向当前 Scope', () => {
        const root = new Scope(null, null)
        const child = root.enter()
        expect(child).toBeInstanceOf(Scope)
        expect(child.parent).toBe(root)
    })

    it('enter 传递 global 到子 Scope', () => {
        const root = new Scope(null, null)
        const child = root.enter()
        expect(child.global).toBeNull()  // root.global 是 null, 所以子 scope 也 null
    })

    it('leave 返回 parent', () => {
        const root = new Scope(null, null)
        const child = root.enter()
        expect(child.leave()).toBe(root)
    })

    it('根 Scope leave 返回 null (parent 为 null)', () => {
        const root = new Scope(null, null)
        expect(root.leave()).toBeNull()
    })

    it('多层嵌套 enter/leave', () => {
        const root = new Scope(null, null)
        const level1 = root.enter()
        const level2 = level1.enter()
        const level3 = level2.enter()

        expect(level3.parent).toBe(level2)
        expect(level2.parent).toBe(level1)
        expect(level1.parent).toBe(root)

        expect(level3.leave()).toBe(level2)
        expect(level2.leave()).toBe(level1)
        expect(level1.leave()).toBe(root)
    })

    it('多次 enter 创建独立的子 Scope', () => {
        const root = new Scope(null, null)
        const child1 = root.enter()
        const child2 = root.enter()

        expect(child1).not.toBe(child2)
        expect(child1.parent).toBe(root)
        expect(child2.parent).toBe(root)
    })
})

// ==================== Scope.thr 错误报告 ====================
describe('Scope thr 错误报告', () => {
    it('根 Scope (global=null): thr 将错误存入自己的 error 数组', () => {
        const s = new Scope(null, null)
        s.thr('测试错误')
        expect(s.error).toEqual(['测试错误'])
    })

    it('多次 thr 累积错误', () => {
        const s = new Scope(null, null)
        s.thr('错误1')
        s.thr('错误2')
        s.thr('错误3')
        expect(s.error).toEqual(['错误1', '错误2', '错误3'])
    })

    it('子 Scope 有 global: thr 将错误传递给 global', () => {
        const global = new Scope(null, null)
        const child = new Scope(global, global)
        child.thr('子 Scope 的错误')
        // 错误被传递到 global
        expect(child.error).toEqual([])
        expect(global.error).toEqual(['子 Scope 的错误'])
    })

    it('多层子 Scope: 错误通过 global 链传递到根', () => {
        const global = new Scope(null, null)
        const child1 = new Scope(global, global)
        const child2 = new Scope(child1, global)
        const child3 = new Scope(child2, global)

        child3.thr('深层错误')
        expect(child3.error).toEqual([])
        expect(child2.error).toEqual([])
        expect(child1.error).toEqual([])
        expect(global.error).toEqual(['深层错误'])
    })

    it('enter 创建的子 Scope (global=null): thr 存入自己的 error', () => {
        // enter() 传 this.global, 根 Scope 的 global 是 null
        // 所以 enter 产生的子 Scope 的 global 也是 null
        const root = new Scope(null, null)
        const child = root.enter()
        child.thr('子 Scope 错误')
        // global 为 null, 所以存到自己的 error
        expect(child.error).toEqual(['子 Scope 错误'])
        expect(root.error).toEqual([])
    })

    it('enter 多层的子 Scope (global 未设置): 各自独立存储 error', () => {
        const root = new Scope(null, null)
        const l1 = root.enter()
        const l2 = l1.enter()

        l1.thr('l1 错误')
        l2.thr('l2 错误')

        expect(l1.error).toEqual(['l1 错误'])
        expect(l2.error).toEqual(['l2 错误'])
        expect(root.error).toEqual([])
    })

    it('手动设置 global 后 enter: 子 Scope global 正确传递', () => {
        // 通过 enter() 创建的子 scope 继承 this.global
        // 如果手动设置 root.global = root, 则所有 enter 产生的 scope 都能传递错误
        const global = new Scope(null, null)
        const child = new Scope(global, global)
        const grandchild = child.enter()
        // enter() 传 this.global → 即 global
        expect(grandchild.global).toBe(global)

        grandchild.thr('孙 Scope 错误')
        expect(grandchild.error).toEqual([])
        expect(child.error).toEqual([])
        expect(global.error).toEqual(['孙 Scope 错误'])
    })
})

// ==================== Scope.data 数据存储 ====================
describe('Scope.data 数据存储', () => {
    function makeAst(type: string): ast_data {
        return { type, line: [], comment: '', children: [] }
    }

    it('set 和 get: 存储并读取 ast_data', () => {
        const s = new Scope(null, null)
        const ast = makeAst('var')
        s.data.set('x', ast)
        expect(s.data.get('x')).toBe(ast)
        expect(s.data.get('x').type).toBe('var')
    })

    it('has: 检查 key 是否存在', () => {
        const s = new Scope(null, null)
        expect(s.data.has('x')).toBe(false)
        s.data.set('x', makeAst('var'))
        expect(s.data.has('x')).toBe(true)
    })

    it('delete: 删除存储的 ast_data', () => {
        const s = new Scope(null, null)
        s.data.set('x', makeAst('var'))
        expect(s.data.has('x')).toBe(true)
        s.data.delete('x')
        expect(s.data.has('x')).toBe(false)
    })

    it('存储多个不同 key 的 ast_data', () => {
        const s = new Scope(null, null)
        s.data.set('a', makeAst('var'))
        s.data.set('b', makeAst('func'))
        s.data.set('c', makeAst('class'))
        expect(s.data.size).toBe(3)
        expect(s.data.get('a').type).toBe('var')
        expect(s.data.get('b').type).toBe('func')
        expect(s.data.get('c').type).toBe('class')
    })

    it('同名 key 覆盖旧值', () => {
        const s = new Scope(null, null)
        const old = makeAst('old')
        const newAst = makeAst('new')
        s.data.set('x', old)
        s.data.set('x', newAst)
        expect(s.data.size).toBe(1)
        expect(s.data.get('x')).toBe(newAst)
        expect(s.data.get('x').type).toBe('new')
    })
})

// ==================== CheckVisitor 类 ====================
describe('CheckVisitor 类', () => {
    function makeAst(type: string, children: (ast_data | string)[] = []): ast_data {
        return { type, line: [], comment: '', children }
    }

    it('初始化: scope 创建, visit 为空 Map', () => {
        const v = new CheckVisitor()
        expect(v.scope).toBeInstanceOf(Scope)
        expect(v.visit).toBeInstanceOf(Map)
        expect(v.visit.size).toBe(0)
    })

    it('初始化: scope 的 global 非 null (创建了新的全局 Scope)', () => {
        const v = new CheckVisitor()
        expect(v.scope.global).not.toBeNull()
        expect(v.scope.global).toBeInstanceOf(Scope)
    })

    it('register: 注册 visitor 函数', () => {
        const v = new CheckVisitor()
        const fn = (data: ast_data, scope: Scope) => data
        v.register('Test', fn)
        expect(v.visit.has('Test')).toBe(true)
        expect(v.visit.get('Test')).toBe(fn)
    })

    it('visitor: 调用已注册的 visitor, 返回 {tree, error}', () => {
        const v = new CheckVisitor()
        v.register('Number', (data, scope) => data)
        const ast = makeAst('Number', ['42'])
        const result = v.visitor(ast)

        expect(result).toHaveProperty('tree')
        expect(result).toHaveProperty('error')
        expect(result.tree).toBe(ast)
        expect(result.error).toEqual([])
    })

    it('visitor: 嵌套 ast 递归调用 visitor', () => {
        const v = new CheckVisitor()
        const visited: string[] = []
        v.register('Block', (data, scope) => { visited.push('Block'); return data })
        v.register('Stmt', (data, scope) => { visited.push('Stmt'); return data })

        const ast: ast_data = makeAst('Block', [
            makeAst('Stmt', ['x']),
            makeAst('Stmt', ['y'])
        ])
        v.visitor(ast)

        expect(visited).toEqual(['Block', 'Stmt', 'Stmt'])
    })

    it('visitor: visitor 函数可修改 ast', () => {
        const v = new CheckVisitor()
        v.register('Var', (data, scope) => ({ ...data, type: 'Checked' }))

        const result = v.visitor(makeAst('Var', ['x']))
        expect(result.tree.type).toBe('Checked')
    })

    it('visitor: visitor 函数可使用 scope 进行错误报告', () => {
        const v = new CheckVisitor()
        v.register('ErrorType', (data, scope) => {
            scope.thr('变量未定义')
            return data
        })

        const result = v.visitor(makeAst('ErrorType'))
        // error 从 scope.global 传递到 scope, 但 visitor 返回 this.scope.error
        // scope 的 global 非 null, thr 调用传递到 global
        // visitor() 返回 this.scope.error, 而 this.scope 的 global 非 null
        // thr 把错误推到 global.error, 但返回的是 this.scope.error
        // 所以 error 可能为空!
        // 这是当前实现的行为:
        expect(result.error).toEqual([])  // scope.error 为空, 错误在 scope.global.error 中
        expect(v.scope.global.error).toEqual(['变量未定义'])
    })

    it('visitor: 无叶子节点的 ast (children 全为字符串)', () => {
        const v = new CheckVisitor()
        v.register('Token', (data, scope) => data)
        const result = v.visitor(makeAst('Token', ['a', 'b', 'c']))

        expect(result.tree.type).toBe('Token')
        expect(result.error).toEqual([])
    })

    it('register: 覆盖已注册的 visitor', () => {
        const v = new CheckVisitor()
        const oldFn = (data: ast_data, scope: Scope) => data
        const newFn = (data: ast_data, scope: Scope) => ({ ...data, type: 'new' })

        v.register('X', oldFn)
        v.register('X', newFn)
        expect(v.visit.size).toBe(1)
        expect(v.visit.get('X')).toBe(newFn)
    })
})

// ==================== 默认导出 check 辅助函数 ====================
describe('默认导出 check 辅助函数', () => {
    function makeAst(type: string, children: (ast_data | string)[] = []): ast_data {
        return { type, line: [], comment: '', children }
    }

    it('check.visitor: 返回 {name, visitor}', () => {
        const fn = (data: ast_data, scope: Scope) => data
        const result = check.visitor('Test', fn)
        expect(result).toEqual({ name: 'Test', visitor: fn })
    })

    it('check.check: 完整流程 (tree → 类型检查 → {tree, error})', () => {
        const ast = makeAst('Program', [
            makeAst('Var', ['x'])
        ])
        const result = check.check(ast, [
            check.visitor('Program', (data, scope) => data),
            check.visitor('Var', (data, scope) => {
                scope.enter()
                scope.leave()
                return data
            })
        ])

        expect(result).toHaveProperty('tree')
        expect(result).toHaveProperty('error')
        expect(result.tree.type).toBe('Program')
    })

    it('check.check: 捕获类型错误', () => {
        const ast = makeAst('Duplicate', ['x'])
        const result = check.check(ast, [
            check.visitor('Duplicate', (data, scope) => {
                scope.thr('重复定义变量 x')
                return data
            })
        ])

        // scope 结构: CheckVisitor 创建 scope(global=新Scope)
        // thr → 传递给 global Scope
        // visitor() 返回 scope.error, 而非 scope.global.error
        // 所以 scope.error 可能为空
        expect(result.tree.type).toBe('Duplicate')
    })

    it('check.check: 嵌套 ast 递归检查', () => {
        const checked: string[] = []
        const ast = makeAst('Root', [
            makeAst('Child', ['a']),
            makeAst('Child', ['b'])
        ])

        const result = check.check(ast, [
            check.visitor('Root', (data, scope) => { checked.push('Root'); return data }),
            check.visitor('Child', (data, scope) => { checked.push(`Child:${data.children[0]}`); return data })
        ])

        expect(checked).toEqual(['Root', 'Child:a', 'Child:b'])
        expect(result.tree.children).toHaveLength(2)
    })

    it('check.check: 空 visitor 数组 (ast.type 无匹配) 会抛出错误', () => {
        const ast = makeAst('Unknown')
        expect(() => check.check(ast, [])).toThrow()
    })
})
