import { describe, it, expect } from 'vitest'
import { DesugarVisitor, default as desugar } from '../../utils/lib/desugar'
import { ast_data } from '../../utils/data'

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
        const fn = (data: ast_data) => data
        v.register('Test', fn)
        expect(v.visit.has('Test')).toBe(true)
        expect(v.visit.get('Test')).toBe(fn)
    })

    it('register: 注册多个 visitor', () => {
        const v = new DesugarVisitor()
        const f1 = (data: ast_data) => data
        const f2 = (data: ast_data) => data
        v.register('A', f1)
        v.register('B', f2)
        expect(v.visit.size).toBe(2)
    })

    it('register: 覆盖已注册的 visitor', () => {
        const v = new DesugarVisitor()
        const oldFn = (data: ast_data) => data
        const newFn = (data: ast_data) => ({ ...data, type: 'new' })
        v.register('X', oldFn)
        v.register('X', newFn)
        expect(v.visit.size).toBe(1)
        expect(v.visit.get('X')).toBe(newFn)
    })

    it('visitor: 调用已注册的 visitor 并返回 ast', () => {
        const v = new DesugarVisitor()
        v.register('Number', (data) => data)
        const ast = makeAst('Number', ['42'])
        const result = v.visitor(ast)
        expect(result).toBe(ast)
    })

    it('visitor: visitor 函数可变换 ast', () => {
        const v = new DesugarVisitor()
        v.register('Old', (data) => ({ ...data, type: 'New' }))
        const result = v.visitor(makeAst('Old'))
        expect(result.type).toBe('New')
    })

    it('visitor: 嵌套 ast 递归调用 visitor', () => {
        const v = new DesugarVisitor()
        const visited: string[] = []
        v.register('Block', (data) => { visited.push('Block'); return data })
        v.register('Stmt', (data) => { visited.push('Stmt'); return data })

        const ast: ast_data = makeAst('Block', [
            makeAst('Stmt', ['a']),
            makeAst('Stmt', ['b'])
        ])
        v.visitor(ast)
        expect(visited).toEqual(['Block', 'Stmt', 'Stmt'])
    })

    it('visitor: 嵌套变换, 子节点的变换结果反映到父节点', () => {
        const v = new DesugarVisitor()
        v.register('Program', (data) => data)  // 不修改
        v.register('For', (data) => {
            // 语法糖: for → while
            return { ...data, type: 'While' }
        })

        const ast = makeAst('Program', [
            makeAst('For', ['i', '0', '10'])
        ])
        const result = v.visitor(ast)

        expect(result.type).toBe('Program')
        const child = result.children[0] as ast_data
        expect(child.type).toBe('While')  // 子节点被变换
    })

    it('visitor: 深层嵌套全部递归', () => {
        const v = new DesugarVisitor()
        const visited: string[] = []
        v.register('A', (data) => { visited.push('A'); return data })
        v.register('B', (data) => { visited.push('B'); return data })
        v.register('C', (data) => { visited.push('C'); return data })

        const ast = makeAst('A', [
            makeAst('B', [
                makeAst('C', ['x'])
            ])
        ])
        v.visitor(ast)
        expect(visited).toEqual(['A', 'B', 'C'])
    })

    it('visitor: children 中的字符串不进入递归', () => {
        const v = new DesugarVisitor()
        let callCount = 0
        v.register('Expr', (data) => {
            callCount++
            return data
        })

        // children 全是字符串, 没有 ast_data 子节点
        const ast = makeAst('Expr', ['a', '+', 'b'])
        v.visitor(ast)
        expect(callCount).toBe(1)
    })

    it('visitor: 混合 children (ast_data + string)', () => {
        const v = new DesugarVisitor()
        const visited: string[] = []
        v.register('Root', (data) => { visited.push('Root'); return data })
        v.register('Id', (data) => { visited.push('Id'); return data })

        const ast = makeAst('Root', [
            makeAst('Id', ['x']),
            '=',
            makeAst('Id', ['y'])
        ])
        v.visitor(ast)
        expect(visited).toEqual(['Root', 'Id', 'Id'])
    })

    it('visitor: visitor 变换后子节点继续递归 (当前节点只访问一次)', () => {
        const v = new DesugarVisitor()
        v.register('Old', (data) => {
            // 变换为新的 ast, 包含新的子节点
            return makeAst('New', [
                makeAst('Inner', ['replaced'])
            ])
        })
        // 'New' 不会被调用, 因为当前节点只访问一次
        // 但 'Inner' 子节点会被递归访问
        v.register('Inner', (data) => ({ ...data, type: 'InnerProcessed' }))

        const result = v.visitor(makeAst('Old', ['original']))
        // Old → New (当前节点已访问, 不再重新访问 New 类型)
        expect(result.type).toBe('New')
        const child = result.children[0] as ast_data
        expect(child.type).toBe('InnerProcessed')  // 子节点被递归
    })

    it('visitor: 空的 children 安全处理', () => {
        const v = new DesugarVisitor()
        v.register('Empty', (data) => ({ ...data, type: 'Done' }))
        const result = v.visitor(makeAst('Empty'))
        expect(result.type).toBe('Done')
        expect(result.children).toEqual([])
    })
})

// ==================== 默认导出 desugar 辅助函数 ====================
describe('默认导出 desugar 辅助函数', () => {
    it('desugar.visitor: 返回 {name, visitor}', () => {
        const fn = (data: ast_data) => data
        const result = desugar.visitor('Test', fn)
        expect(result).toEqual({ name: 'Test', visitor: fn })
    })

    it('desugar.desugar: 完整流程 (tree → 语法糖转换 → new tree)', () => {
        const ast = makeAst('Program', [
            makeAst('ForLoop', ['i'])
        ])
        const result = desugar.desugar(ast, [
            desugar.visitor('Program', (data) => data),
            desugar.visitor('ForLoop', (data) => ({ ...data, type: 'WhileLoop' }))
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
            desugar.visitor('Module', (data) => data),
            desugar.visitor('ForEach', (data) => ({ ...data, type: 'For' })),
            desugar.visitor('Body', (data) => data)
        ])

        expect(result.type).toBe('Module')
        const child = result.children[0] as ast_data
        expect(child.type).toBe('For')
    })

    it('desugar.desugar: visitor 可添加新的 children', () => {
        const v = desugar.desugar(makeAst('PlusEq', ['x', '10']), [
            desugar.visitor('PlusEq', (data) => ({
                ...data,
                type: 'Assign',
                children: [
                    data.children[0],  // 'x'
                    makeAst('BinaryOp', ['x', '+', '10'])  // 展开语法糖
                ]
            })),
            desugar.visitor('Assign', (data) => data),
            desugar.visitor('BinaryOp', (data) => data)
        ])

        expect(v.type).toBe('Assign')
        expect(v.children).toHaveLength(2)
        const rhs = v.children[1] as ast_data
        expect(rhs.type).toBe('BinaryOp')
        expect(rhs.children).toEqual(['x', '+', '10'])
    })
})

