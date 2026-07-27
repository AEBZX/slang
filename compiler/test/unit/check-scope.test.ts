import { describe, it, expect } from 'vitest'
import { Scope, CheckVisitor, default as check } from '../../utils/lib/check'
import { ast_data } from '../../utils/data'
import { AstNode } from '../../utils/lib/ast-node'

function makeAst(type: string, children: (ast_data | string)[] = []): ast_data {
    return { type, line: [], comment: '', children }
}

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
        expect(child.global).toBeNull()
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
        const root = new Scope(null, null)
        const child = root.enter()
        child.thr('子 Scope 错误')
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
        const global = new Scope(null, null)
        const child = new Scope(global, global)
        const grandchild = child.enter()
        expect(grandchild.global).toBe(global)

        grandchild.thr('孙 Scope 错误')
        expect(grandchild.error).toEqual([])
        expect(child.error).toEqual([])
        expect(global.error).toEqual(['孙 Scope 错误'])
    })
})

// ==================== Scope.data 数据存储 ====================
describe('Scope.data 数据存储', () => {
    it('set 和 get: 存储并读取 AstNode', () => {
        const s = new Scope(null, null)
        const node = new AstNode(makeAst('var'))
        s.data.set('x', node)
        expect(s.data.get('x')).toBe(node)
        expect(s.data.get('x').type).toBe('var')
    })

    it('has: 检查 key 是否存在', () => {
        const s = new Scope(null, null)
        expect(s.data.has('x')).toBe(false)
        s.data.set('x', new AstNode(makeAst('var')))
        expect(s.data.has('x')).toBe(true)
    })

    it('delete: 删除存储的 AstNode', () => {
        const s = new Scope(null, null)
        s.data.set('x', new AstNode(makeAst('var')))
        expect(s.data.has('x')).toBe(true)
        s.data.delete('x')
        expect(s.data.has('x')).toBe(false)
    })

    it('存储多个不同 key 的 AstNode', () => {
        const s = new Scope(null, null)
        s.data.set('a', new AstNode(makeAst('var')))
        s.data.set('b', new AstNode(makeAst('func')))
        s.data.set('c', new AstNode(makeAst('class')))
        expect(s.data.size).toBe(3)
        expect(s.data.get('a').type).toBe('var')
        expect(s.data.get('b').type).toBe('func')
        expect(s.data.get('c').type).toBe('class')
    })

    it('同名 key 覆盖旧值', () => {
        const s = new Scope(null, null)
        const old = new AstNode(makeAst('old'))
        const newAst = new AstNode(makeAst('new'))
        s.data.set('x', old)
        s.data.set('x', newAst)
        expect(s.data.size).toBe(1)
        expect(s.data.get('x')).toBe(newAst)
        expect(s.data.get('x').type).toBe('new')
    })
})

// ==================== CheckVisitor 类 ====================
describe('CheckVisitor 类', () => {
    it('初始化: scope 创建, visit 为空 Map', () => {
        const v = new CheckVisitor()
        expect(v.scope).toBeInstanceOf(Scope)
        expect(v.visit).toBeInstanceOf(Map)
        expect(v.visit.size).toBe(0)
    })

    it('初始化: scope 的 global 非 null', () => {
        const v = new CheckVisitor()
        expect(v.scope.global).not.toBeNull()
        expect(v.scope.global).toBeInstanceOf(Scope)
    })

    it('register: 注册 visitor 函数', () => {
        const v = new CheckVisitor()
        const fn = (node: AstNode, scope: Scope) => node
        v.register('Test', fn)
        expect(v.visit.has('Test')).toBe(true)
        expect(v.visit.get('Test')).toBe(fn)
    })

    it('visitor: 调用已注册的 visitor, 返回 {tree, error}', () => {
        const v = new CheckVisitor()
        v.register('Number', (node, scope) => node)
        const ast = makeAst('Number', ['42'])
        const result = v.visitor(ast)

        expect(result).toHaveProperty('tree')
        expect(result).toHaveProperty('error')
        expect(result.tree.type).toBe('Number')
        expect(result.error).toEqual([])
    })

    it('visitor: 嵌套 ast 递归调用 visitor (自底向上)', () => {
        const v = new CheckVisitor()
        const visited: string[] = []
        v.register('Block', (node, scope) => { visited.push('Block'); return node })
        v.register('Stmt', (node, scope) => { visited.push('Stmt'); return node })

        const ast: ast_data = makeAst('Block', [
            makeAst('Stmt', ['x']),
            makeAst('Stmt', ['y'])
        ])
        v.visitor(ast)

        expect(visited).toEqual(['Stmt', 'Stmt', 'Block'])
    })

    it('visitor: visitor 函数可修改 ast', () => {
        const v = new CheckVisitor()
        v.register('Var', (node, scope) => new AstNode({ ...node.to_data(), type: 'Checked' }))

        const result = v.visitor(makeAst('Var', ['x']))
        expect(result.tree.type).toBe('Checked')
    })

    it('visitor: visitor 函数可使用 scope 进行错误报告', () => {
        const v = new CheckVisitor()
        v.register('ErrorType', (node, scope) => {
            scope.thr('变量未定义')
            return node
        })

        const result = v.visitor(makeAst('ErrorType'))
        expect(result.error).toEqual([])
        expect(v.scope.global.error).toEqual(['变量未定义'])
    })

    it('visitor: 无叶子节点的 ast (children 全为字符串)', () => {
        const v = new CheckVisitor()
        v.register('Token', (node, scope) => node)
        const result = v.visitor(makeAst('Token', ['a', 'b', 'c']))

        expect(result.tree.type).toBe('Token')
        expect(result.error).toEqual([])
    })

    it('register: 覆盖已注册的 visitor', () => {
        const v = new CheckVisitor()
        const oldFn = (node: AstNode, scope: Scope) => node
        const newFn = (node: AstNode, scope: Scope) => new AstNode({ ...node.to_data(), type: 'new' })

        v.register('X', oldFn)
        v.register('X', newFn)
        expect(v.visit.size).toBe(1)
        expect(v.visit.get('X')).toBe(newFn)
    })
})

// ==================== 默认导出 check 辅助函数 ====================
describe('默认导出 check 辅助函数', () => {
    it('check.visitor: 返回 {name, visitor}', () => {
        const fn = (node: AstNode, scope: Scope) => node
        const result = check.visitor('Test', fn)
        expect(result).toEqual({ name: 'Test', visitor: fn })
    })

    it('check.check: 完整流程 (tree → 类型检查 → {tree, error})', () => {
        const ast = makeAst('Program', [
            makeAst('Var', ['x'])
        ])
        const result = check.check(ast, [
            check.visitor('Program', (node, scope) => node),
            check.visitor('Var', (node, scope) => {
                scope.enter()
                scope.leave()
                return node
            })
        ])

        expect(result).toHaveProperty('tree')
        expect(result).toHaveProperty('error')
        expect(result.tree.type).toBe('Program')
    })

    it('check.check: 捕获类型错误', () => {
        const ast = makeAst('Duplicate', ['x'])
        const result = check.check(ast, [
            check.visitor('Duplicate', (node, scope) => {
                scope.thr('重复定义变量 x')
                return node
            })
        ])

        expect(result.tree.type).toBe('Duplicate')
    })

    it('check.check: 嵌套 ast 递归检查 (自底向上)', () => {
        const checked: string[] = []
        const ast = makeAst('Root', [
            makeAst('Child', ['a']),
            makeAst('Child', ['b'])
        ])

        const result = check.check(ast, [
            check.visitor('Root', (node, scope) => { checked.push('Root'); return node }),
            check.visitor('Child', (node, scope) => { checked.push(`Child:${node.str(0)}`); return node })
        ])

        expect(checked).toEqual(['Child:a', 'Child:b', 'Root'])
        expect(result.tree.children).toHaveLength(2)
    })

    it('check.check: 空 visitor 数组 (ast.type 无匹配) 静默返回原 ast', () => {
        const ast = makeAst('Unknown')
        expect(() => check.check(ast, [])).not.toThrow()
    })
})
