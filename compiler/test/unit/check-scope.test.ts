import { describe, it, expect } from 'vitest'
import { Checker, Scope, default as check } from '../../utils/lib/check'
import { ast_data } from '../../utils/data'

function mk(type: string, children: Map<string, ast_data|string> = new Map()): ast_data {
    return { type, line: [], comment: undefined, children }
}

// ==================== Scope ====================
describe('Scope', () => {
    it('构造: parent 和 global 正确设置', () => {
        const root = new Scope(null, null)
        expect(root.parent).toBeNull()
        expect(root.global).toBeNull()
        const child = new Scope(root, root)
        expect(child.parent).toBe(root)
        expect(child.global).toBe(root)
    })

    it('enter/leave: 基本流程', () => {
        const root = new Scope(null, null)
        const child = root.enter()
        expect(child.parent).toBe(root)
        expect(child.leave()).toBe(root)
    })

    it('enter: 多层嵌套', () => {
        const root = new Scope(null, null)
        const a = root.enter()
        const b = a.enter()
        expect(b.parent).toBe(a)
        expect(a.parent).toBe(root)
        expect(b.leave()).toBe(a)
        expect(a.leave()).toBe(root)
    })

    it('data: set/get', () => {
        const s = new Scope(null, null)
        const ast = mk('var')
        s.set('x', ast)
        expect(s.get('x')).toBe(ast)
    })

    it('thr: 向自身 error 添加消息', () => {
        const s = new Scope(null, null)
        s.thr('err1')
        s.thr('err2')
        expect(s.error).toEqual(['err1', 'err2'])
    })

    it('chain: impl/is 基本流程', () => {
        const s = new Scope(null, null)
        s.impl('Child', 'Parent')
        s.impl('GrandChild', 'Child')
        expect(s.is('GrandChild', 'Parent')).toBe(true)
        expect(s.is('Parent', 'GrandChild')).toBe(true)
        expect(s.is('A', 'B')).toBe(false)
    })
})

// ==================== Checker ====================
describe('Checker', () => {
    it('构造: visitor 为空 Map', () => {
        const c = new Checker()
        expect(c.visitor).toBeInstanceOf(Map)
        expect(c.visitor.size).toBe(0)
    })

    it('register: 注册 visitor', () => {
        const c = new Checker()
        const fn = (ast: ast_data, scope: Scope) => ast
        c.register('Test', fn)
        expect(c.visitor.has('Test')).toBe(true)
        expect(c.visitor.get('Test')).toBe(fn)
    })

    it('check: 无匹配 visitor 时原样返回', () => {
        const c = new Checker()
        const ast = mk('Unknown')
        const result = c.check(ast)
        expect(result.type).toBe('Unknown')
    })

    it('check: 注册的 visitor 被调用并返回结果', () => {
        const c = new Checker()
        c.register('Var', (ast, scope) => ({ ...ast, type: 'Checked' }))
        const result = c.check(mk('Var'))
        expect(result.type).toBe('Checked')
    })

    it('check: 子节点先递归再当前 (底向上)', () => {
        const c = new Checker()
        const visited: string[] = []
        c.register('Block', (ast, scope) => { visited.push('Block'); return ast })
        c.register('Stmt', (ast, scope) => { visited.push('Stmt'); return ast })
        const child = new Map<string, ast_data|string>()
        child.set('s1', mk('Stmt'))
        child.set('s2', mk('Stmt'))
        c.check(mk('Block', child))
        expect(visited).toEqual(['Stmt', 'Stmt', 'Block'])
    })

    it('check: 子节点修改写回 Map', () => {
        const c = new Checker()
        c.register('Stmt', (ast, scope) => ({ ...ast, type: 'CheckedStmt' }))
        const child = new Map<string, ast_data|string>()
        child.set('a', mk('Stmt'))
        const result = c.check(mk('Block', child))
        expect((result.children.get('a') as ast_data).type).toBe('CheckedStmt')
    })

    it('check: visitor 可用 scope 报错', () => {
        const c = new Checker()
        c.register('Err', (ast, scope) => {
            scope.thr('变量未定义')
            return ast
        })
        c.check(mk('Err'))
        expect(c.scope.error).toEqual(['变量未定义'])
    })
})

// ==================== 默认导出 check ====================
describe('check 默认导出', () => {
    it('check(tree, ...visitors) 返回 ast_data', () => {
        const ast = mk('Program', new Map([['v', mk('Var')]]))
        const result = check(ast,
            { name: 'Program', ast: (a, s) => a },
            { name: 'Var', ast: (a, s) => a }
        )
        expect(result.type).toBe('Program')
    })

    it('空 visitors 静默返回原 ast', () => {
        expect(() => check(mk('X'))).not.toThrow()
    })

    it('visitor 可访问子节点的修改结果', () => {
        const child = new Map<string, ast_data|string>()
        child.set('x', mk('Number'))
        const ast = mk('Add', child)
        const result = check(ast,
            {
                name: 'Add',
                ast: (a, s) => {
                    // 子节点已处理, 可读 comment
                    s.set('ok', a)
                    return a
                }
            },
            {
                name: 'Number',
                ast: (a, s) => {
                    a.comment = 'processed'
                    return a
                }
            }
        )
        expect(result.type).toBe('Add')
        expect((result.children.get('x') as ast_data).comment).toBe('processed')
    })
})
