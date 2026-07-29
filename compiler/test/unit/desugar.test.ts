import { describe, it, expect } from 'vitest'
import { DesugarVisitor, default as desugar } from '../../utils/lib/desugar'
import { ast_data } from '../../utils/data'

function mk(type: string, children: Map<string, ast_data|string> = new Map()): ast_data {
    return { type, line: [], comment: undefined, children }
}

// ==================== DesugarVisitor ====================
describe('DesugarVisitor', () => {
    it('构造: visit 为空 Map', () => {
        const v = new DesugarVisitor()
        expect(v.visit).toBeInstanceOf(Map)
        expect(v.visit.size).toBe(0)
    })

    it('register: 注册 visitor', () => {
        const v = new DesugarVisitor()
        const fn = (node: ast_data) => node
        v.register('Test', fn)
        expect(v.visit.has('Test')).toBe(true)
        expect(v.visit.get('Test')).toBe(fn)
    })

    it('register: 覆盖已注册的 visitor', () => {
        const v = new DesugarVisitor()
        const newFn = (node: ast_data) => ({ ...node, type: 'new' })
        v.register('X', (node) => node)
        v.register('X', newFn)
        expect(v.visit.size).toBe(1)
        expect(v.visit.get('X')).toBe(newFn)
    })

    it('visitor: 无匹配 visitor 时原样返回', () => {
        const v = new DesugarVisitor()
        const result = v.visitor(mk('Unknown'))
        expect(result.type).toBe('Unknown')
    })

    it('visitor: 匹配 visitor 时变换', () => {
        const v = new DesugarVisitor()
        v.register('Old', (node) => ({ ...node, type: 'New' }))
        const result = v.visitor(mk('Old'))
        expect(result.type).toBe('New')
    })

    it('visitor: 子节点变换写回 Map', () => {
        const v = new DesugarVisitor()
        v.register('For', (node) => ({ ...node, type: 'While' }))
        const child = new Map<string, ast_data|string>()
        child.set('body', mk('For'))
        const result = v.visitor(mk('Program', child))
        expect((result.children.get('body') as ast_data).type).toBe('While')
    })

    it('visitor: 嵌套递归 (自顶向下)', () => {
        const v = new DesugarVisitor()
        const visited: string[] = []
        v.register('A', (node) => { visited.push('A'); return node })
        v.register('B', (node) => { visited.push('B'); return node })
        const b = new Map<string, ast_data|string>()
        b.set('inner', mk('B'))
        const a = new Map<string, ast_data|string>()
        a.set('b', mk('A', b))
        v.visitor(mk('Root', a))
        expect(visited).toEqual(['B', 'A'])
    })

    it('visitor: 字符串 children 不递归', () => {
        const v = new DesugarVisitor()
        let count = 0
        v.register('Expr', (node) => { count++; return node })
        const child = new Map<string, ast_data|string>()
        child.set('a', 'x')
        child.set('b', '+')
        v.visitor(mk('Expr', child))
        expect(count).toBe(1)
    })
})

// ==================== 默认导出 desugar ====================
describe('desugar 默认导出', () => {
    it('desugar.visitor: 返回 {name, visitor}', () => {
        const fn = (node: ast_data) => node
        const result = desugar.visitor('Test', fn)
        expect(result).toEqual({ name: 'Test', visitor: fn })
    })

    it('desugar.desugar: 完整流程', () => {
        const child = new Map<string, ast_data|string>()
        child.set('loop', mk('ForLoop'))
        const result = desugar.desugar(mk('Program', child), [
            desugar.visitor('Program', (node) => node),
            desugar.visitor('ForLoop', (node) => ({ ...node, type: 'WhileLoop' }))
        ])
        expect(result.type).toBe('Program')
        expect((result.children.get('loop') as ast_data).type).toBe('WhileLoop')
    })

    it('desugar.desugar: 空 visitor 数组不抛异常', () => {
        expect(() => desugar.desugar(mk('X'), [])).not.toThrow()
    })

    it('desugar.desugar: 深层嵌套', () => {
        const inner = new Map<string, ast_data|string>()
        inner.set('d', mk('D'))
        const mid = new Map<string, ast_data|string>()
        mid.set('c', mk('C', inner))
        const outer = new Map<string, ast_data|string>()
        outer.set('b', mk('B', mid))
        const result = desugar.desugar(mk('A', outer), [
            desugar.visitor('D', (node) => ({ ...node, type: 'Done' }))
        ])
        const b = result.children.get('b') as ast_data
        const c = b.children.get('c') as ast_data
        expect((c.children.get('d') as ast_data).type).toBe('Done')
    })
})
