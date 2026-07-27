import { describe, it, expect } from 'vitest'
import { DesugarVisitor, default as desugar } from '../../utils/lib/desugar'
import { ast_data } from '../../utils/data'
import { AstNode } from '../../utils/lib/ast-node'

function makeAst(type: string, children: (ast_data | string)[] = []): ast_data {
    return { type, line: [], comment: '', children }
}

// ==================== DesugarVisitor 类 ====================
describe('DesugarVisitor 类', () => {
    it('初始化: visit 为空 Map', () => {
        const v = new DesugarVisitor()
        expect(v.visit).toBeInstanceOf(Map)
        expect(v.visit.size).toBe(0)
    })

    it('register: 注册 visitor 函数', () => {
        const v = new DesugarVisitor()
        const fn = (node: AstNode) => node
        v.register('Test', fn)
        expect(v.visit.has('Test')).toBe(true)
        expect(v.visit.get('Test')).toBe(fn)
    })

    it('register: 注册多个 visitor', () => {
        const v = new DesugarVisitor()
        const f1 = (node: AstNode) => node
        const f2 = (node: AstNode) => node
        v.register('A', f1)
        v.register('B', f2)
        expect(v.visit.size).toBe(2)
    })

    it('register: 覆盖已注册的 visitor', () => {
        const v = new DesugarVisitor()
        const oldFn = (node: AstNode) => node
        const newFn = (node: AstNode) => new AstNode({ ...node.to_data(), type: 'new' })
        v.register('X', oldFn)
        v.register('X', newFn)
        expect(v.visit.size).toBe(1)
        expect(v.visit.get('X')).toBe(newFn)
    })

    it('visitor: 调用已注册的 visitor 并返回 ast_data', () => {
        const v = new DesugarVisitor()
        v.register('Number', (node) => node)
        const ast = makeAst('Number', ['42'])
        const result = v.visitor(ast)
        expect(result).toBeInstanceOf(Object)
        expect(result.type).toBe('Number')
    })

    it('visitor: visitor 函数可变换 ast', () => {
        const v = new DesugarVisitor()
        v.register('Old', (node) => new AstNode({ ...node.to_data(), type: 'New' }))
        const result = v.visitor(makeAst('Old'))
        expect(result.type).toBe('New')
    })

    it('visitor: 嵌套 ast 递归调用 visitor (自底向上)', () => {
        const v = new DesugarVisitor()
        const visited: string[] = []
        v.register('Block', (node) => { visited.push('Block'); return node })
        v.register('Stmt', (node) => { visited.push('Stmt'); return node })

        const ast: ast_data = makeAst('Block', [
            makeAst('Stmt', ['a']),
            makeAst('Stmt', ['b'])
        ])
        v.visitor(ast)
        expect(visited).toEqual(['Stmt', 'Stmt', 'Block'])
    })

    it('visitor: 嵌套变换, 子节点的变换结果反映到父节点', () => {
        const v = new DesugarVisitor()
        v.register('Program', (node) => node)
        v.register('For', (node) => new AstNode({ ...node.to_data(), type: 'While' }))

        const ast = makeAst('Program', [
            makeAst('For', ['i', '0', '10'])
        ])
        const result = v.visitor(ast)

        expect(result.type).toBe('Program')
        const child = result.children[0] as ast_data
        expect(child.type).toBe('While')
    })

    it('visitor: 深层嵌套全部递归 (自底向上)', () => {
        const v = new DesugarVisitor()
        const visited: string[] = []
        v.register('A', (node) => { visited.push('A'); return node })
        v.register('B', (node) => { visited.push('B'); return node })
        v.register('C', (node) => { visited.push('C'); return node })

        const ast = makeAst('A', [
            makeAst('B', [
                makeAst('C', ['x'])
            ])
        ])
        v.visitor(ast)
        expect(visited).toEqual(['C', 'B', 'A'])
    })

    it('visitor: children 中的字符串不进入递归', () => {
        const v = new DesugarVisitor()
        let callCount = 0
        v.register('Expr', (node) => {
            callCount++
            return node
        })

        const ast = makeAst('Expr', ['a', '+', 'b'])
        v.visitor(ast)
        expect(callCount).toBe(1)
    })

    it('visitor: 混合 children (ast_data + string) (自底向上)', () => {
        const v = new DesugarVisitor()
        const visited: string[] = []
        v.register('Root', (node) => { visited.push('Root'); return node })
        v.register('Id', (node) => { visited.push('Id'); return node })

        const ast = makeAst('Root', [
            makeAst('Id', ['x']),
            '=',
            makeAst('Id', ['y'])
        ])
        v.visitor(ast)
        expect(visited).toEqual(['Id', 'Id', 'Root'])
    })

    it('visitor: visitor 变换后新子节点不自动递归 (底向上, 新子树由 visitor 负责)', () => {
        const v = new DesugarVisitor()
        v.register('Old', (node) => {
            return new AstNode(makeAst('New', [
                makeAst('Inner', ['replaced'])
            ]))
        })

        const result = v.visitor(makeAst('Old', ['original']))
        expect(result.type).toBe('New')
        const child = result.children[0] as ast_data
        expect(child.type).toBe('Inner')
    })

    it('visitor: 空的 children 安全处理', () => {
        const v = new DesugarVisitor()
        v.register('Empty', (node) => new AstNode({ ...node.to_data(), type: 'Done' }))
        const result = v.visitor(makeAst('Empty'))
        expect(result.type).toBe('Done')
        expect(result.children).toEqual([])
    })
})

// ==================== 默认导出 desugar 辅助函数 ====================
describe('默认导出 desugar 辅助函数', () => {
    it('desugar.visitor: 返回 {name, visitor}', () => {
        const fn = (node: AstNode) => node
        const result = desugar.visitor('Test', fn)
        expect(result).toEqual({ name: 'Test', visitor: fn })
    })

    it('desugar.desugar: 完整流程 (tree → 语法糖转换 → new tree)', () => {
        const ast = makeAst('Program', [
            makeAst('ForLoop', ['i'])
        ])
        const result = desugar.desugar(ast, [
            desugar.visitor('Program', (node) => node),
            desugar.visitor('ForLoop', (node) => new AstNode({ ...node.to_data(), type: 'WhileLoop' }))
        ])

        expect(result.type).toBe('Program')
        const child = result.children[0] as ast_data
        expect(child.type).toBe('WhileLoop')
    })

    it('desugar.desugar: 空 visitor 数组 (ast.type 无匹配) 静默返回原 ast', () => {
        expect(() => desugar.desugar(makeAst('Unknown'), [])).not.toThrow()
    })

    it('desugar.desugar: 多层级嵌套的语法糖转换', () => {
        const ast = makeAst('Module', [
            makeAst('ForEach', [
                makeAst('Body', ['stmt'])
            ])
        ])

        const result = desugar.desugar(ast, [
            desugar.visitor('Module', (node) => node),
            desugar.visitor('ForEach', (node) => new AstNode({ ...node.to_data(), type: 'For' })),
            desugar.visitor('Body', (node) => node)
        ])

        expect(result.type).toBe('Module')
        const child = result.children[0] as ast_data
        expect(child.type).toBe('For')
    })

    it('desugar.desugar: visitor 可添加新的 children', () => {
        const v = desugar.desugar(makeAst('PlusEq', ['x', '10']), [
            desugar.visitor('PlusEq', (node) => new AstNode({
                type: 'Assign',
                line: node.line,
                comment: '',
                children: [
                    node.children[0],
                    makeAst('BinaryOp', ['x', '+', '10'])
                ]
            })),
            desugar.visitor('Assign', (node) => node),
            desugar.visitor('BinaryOp', (node) => node)
        ])

        expect(v.type).toBe('Assign')
        expect(v.children).toHaveLength(2)
        const rhs = v.children[1] as ast_data
        expect(rhs.type).toBe('BinaryOp')
        expect(rhs.children).toEqual(['x', '+', '10'])
    })
})
