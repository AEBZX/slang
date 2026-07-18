import { describe, it, expect } from 'vitest'
import parser, { ASTStream, ASTRule_Seg, ASTRule_Or, ASTRule_Choose, ASTRule_Loop, ASTRule_While, ASTVisitor } from '../../utils/lib/parser'
import { TokenType, token, ast_data, cst_data } from '../../utils/data'

function t(value: string, type: TokenType = TokenType.Keyword): token {
    return { type, value, line: `test:${value}` }
}

function makeASTStream(cst: cst_data[]): ASTStream {
    return new ASTStream(cst)
}

// ==================== ASTStream ====================
describe('ASTStream', () => {
    it('初始化：index=0, code 正确存储', () => {
        const s = new ASTStream([t('a'), t('b')])
        expect(s.index).toBe(0)
        expect(s.code).toHaveLength(2)
    })

    it('now() 返回当前位置的 CST 数据', () => {
        const s = makeASTStream([t('hello'), t('world')])
        const now = s.now() as token
        expect(now.value).toBe('hello')
    })

    it('next() 返回当前数据并前进 index', () => {
        const s = makeASTStream([t('a'), t('b'), t('c')])
        const n = s.next() as token
        expect(n.value).toBe('a')
        expect(s.index).toBe(1)
    })

    it('peek() 返回下一个数据但不改变 index', () => {
        const s = makeASTStream([t('x'), t('y')])
        const p = s.peek() as token
        expect(p.value).toBe('y')
        expect(s.index).toBe(0)
    })

    it('read_mode() 保存位置, write_mode() 恢复位置', () => {
        const s = makeASTStream([t('a'), t('b'), t('c')])
        s.read_mode()
        s.next()
        s.next()
        expect(s.index).toBe(2)
        s.write_mode()
        expect(s.index).toBe(0)
    })

    it('now() 在末尾返回 undefined', () => {
        const s = makeASTStream([t('a')])
        s.next()
        expect(s.now()).toBeUndefined()
    })
})

// ==================== ASTRule_Seg ====================
describe('ASTRule_Seg', () => {
    it('按 TokenType 匹配单个元素', () => {
        const stream = makeASTStream([t('+', TokenType.Keyword)])
        const rule = new ASTRule_Seg(stream, 'test', TokenType.Keyword)
        expect(rule.match()).toBe(true)
    })

    it('按字符串值匹配单个元素', () => {
        const stream = makeASTStream([t('if', TokenType.Keyword)])
        const rule = new ASTRule_Seg(stream, 'test', 'if')
        expect(rule.match()).toBe(true)
    })

    it('类型不匹配返回 false', () => {
        const stream = makeASTStream([t('+', TokenType.Keyword)])
        const rule = new ASTRule_Seg(stream, 'test', TokenType.Number)
        expect(rule.match()).toBe(false)
    })

    it('字符串值不匹配返回 false', () => {
        const stream = makeASTStream([t('else', TokenType.Keyword)])
        const rule = new ASTRule_Seg(stream, 'test', 'if')
        expect(rule.match()).toBe(false)
    })

    it('多元素序列全部匹配返回 true', () => {
        const stream = makeASTStream([
            t('var', TokenType.Keyword),
            t('x', TokenType.Identifier),
            t('=', TokenType.Keyword)
        ])
        const rule = new ASTRule_Seg(stream, 'VarDecl', TokenType.Keyword, TokenType.Identifier, TokenType.Keyword)
        expect(rule.match()).toBe(true)
    })

    it('多元素序列中间不匹配返回 false', () => {
        const stream = makeASTStream([
            t('x', TokenType.Identifier),
            t('+', TokenType.Keyword),
            t('10', TokenType.Number)
        ])
        const rule = new ASTRule_Seg(stream, 'Test', TokenType.Identifier, '=')
        expect(rule.match()).toBe(false)
    })

    it('generate 返回 ast_data, 含 type/children/line', () => {
        const stream = makeASTStream([t('x', TokenType.Identifier), t('y', TokenType.Identifier)])
        const rule = new ASTRule_Seg(stream, 'MyRule', TokenType.Identifier, TokenType.Identifier)
        rule.match()
        const result = rule.generate() as ast_data
        expect(result.type).toBe('MyRule')
        expect(result.children).toHaveLength(2)
        expect(result.line).toHaveLength(2)
        expect(result.line).toContain('test:x')
        expect(result.line).toContain('test:y')
        // children 是实际匹配到的 token
        expect(result.children[0]).toBe('x')
        expect(result.children[1]).toBe('y')
    })

    it('嵌套 ASTRule 时 generate 正确生成 children', () => {
        const stream = makeASTStream([t('hello', TokenType.Identifier)])
        const innerOr = new ASTRule_Or(stream, 'inner', TokenType.Keyword, TokenType.Identifier)
        const rule = new ASTRule_Seg(stream, 'Outer', innerOr)
        rule.match()
        const result = rule.generate() as ast_data
        // ASTRule_Or 的 generate 返回 token（因为匹配的是非 ASTRule 元素）
        // 所以 children[0] 是那个 token
        expect(result.type).toBe('Outer')
        expect(result.children[0]).toBe('hello')
    })
})

// ==================== ASTRule_Or ====================
describe('ASTRule_Or', () => {
    it('匹配第一个成功的选项', () => {
        const stream = makeASTStream([t('+', TokenType.Keyword)])
        const rule = new ASTRule_Or(stream, 'test', TokenType.Number, TokenType.Keyword)
        expect(rule.match()).toBe(true)
    })

    it('所有选项都不匹配返回 false', () => {
        const stream = makeASTStream([t('hello', TokenType.Identifier)])
        const rule = new ASTRule_Or(stream, 'test', TokenType.Number, TokenType.Keyword)
        expect(rule.match()).toBe(false)
    })

    it('按字符串值匹配', () => {
        const stream = makeASTStream([t('hello', TokenType.Identifier)])
        const rule = new ASTRule_Or(stream, 'test', '+', TokenType.Identifier)
        expect(rule.match()).toBe(true)
    })

    it('generate 返回匹配到的 token（非 ASTRule 选项）', () => {
        const stream = makeASTStream([t('hello', TokenType.Identifier)])
        const rule = new ASTRule_Or(stream, 'test', TokenType.Keyword, TokenType.Identifier)
        rule.match()
        const result = rule.generate() as token
        expect(result.value).toBe('hello')
        expect(result.type).toBe(TokenType.Identifier)
    })

    it('generate 对 ASTRule 选项调用子规则的 generate', () => {
        const stream = makeASTStream([t('x', TokenType.Identifier)])
        const innerSeg = new ASTRule_Seg(stream, 'Inner', TokenType.Identifier)
        const rule = new ASTRule_Or(stream, 'test', innerSeg)
        rule.match()
        const result = rule.generate() as ast_data
        expect(result.type).toBe('Inner')
        expect(result.children).toHaveLength(1)
    })
})

// ==================== ASTRule_Choose ====================
describe('ASTRule_Choose', () => {
    it('匹配时 has=true, match 返回 true', () => {
        const stream = makeASTStream([t('+', TokenType.Keyword)])
        const rule = new ASTRule_Choose(stream, 'test', TokenType.Keyword)
        expect(rule.match()).toBe(true)
        expect(rule.has).toBe(true)
    })

    it('不匹配时 has=false, match 仍返回 true', () => {
        const stream = makeASTStream([t('x', TokenType.Identifier)])
        const rule = new ASTRule_Choose(stream, 'test', TokenType.Keyword)
        expect(rule.match()).toBe(true)
        expect(rule.has).toBe(false)
    })

    it('has=true 时 generate 返回匹配的 token', () => {
        const stream = makeASTStream([t('hello', TokenType.Identifier)])
        const rule = new ASTRule_Choose(stream, 'test', TokenType.Identifier)
        rule.match()
        const result = rule.generate() as token
        expect(result.value).toBe('hello')
    })

    it('has=false 时 generate 返回 {type, children:[], line:[]}', () => {
        const stream = makeASTStream([t('x', TokenType.Identifier)])
        const rule = new ASTRule_Choose(stream, 'test', TokenType.Keyword)
        rule.match()
        const result = rule.generate() as ast_data
        expect(result.type).toBe('test')
        expect(result.children).toEqual([])
        expect(result.line).toEqual([])
    })
})

// ==================== ASTRule_Loop ====================
describe('ASTRule_Loop', () => {
    it('零次匹配返回 true, len=0', () => {
        const stream = makeASTStream([t('+', TokenType.Keyword)])
        const rule = new ASTRule_Loop(stream, 'test', TokenType.Number)
        expect(rule.match()).toBe(true)
        expect(rule.len).toBe(0)
    })

    it('匹配多次相同模式', () => {
        const stream = makeASTStream([
            t('a', TokenType.Identifier),
            t('b', TokenType.Identifier),
            t('+', TokenType.Keyword)
        ])
        const rule = new ASTRule_Loop(stream, 'test', TokenType.Identifier)
        expect(rule.match()).toBe(true)
        expect(rule.len).toBe(2)
    })

    it('generate 产生正确数量的 children（含 line 信息）', () => {
        const stream = makeASTStream([
            t('a', TokenType.Identifier),
            t('b', TokenType.Identifier),
            t('c', TokenType.Identifier)
        ])
        const rule = new ASTRule_Loop(stream, 'test', TokenType.Identifier)
        rule.match()
        const result = rule.generate() as ast_data
        expect(result.type).toBe('test')
        expect(result.children).toHaveLength(3)
        // 每个子元素是 super.generate() 的结果（ast_data）
        // line 来自 line() 辅助函数
        expect(result.line).toHaveLength(3)
        expect(result.line).toContain('test:a')
        expect(result.line).toContain('test:b')
        expect(result.line).toContain('test:c')
    })

    it('generate 零次时返回空 children', () => {
        const stream = makeASTStream([t('+', TokenType.Keyword)])
        const rule = new ASTRule_Loop(stream, 'test', TokenType.Number)
        rule.match()
        const result = rule.generate() as ast_data
        expect(result.children).toEqual([])
        expect(result.line).toEqual([])
    })
})

// ==================== ASTRule_While ====================
describe('ASTRule_While', () => {
    // 注意: 当 split 和 end 都是 TokenType.Keyword 时会类型冲突,
    // 需要用字符串值区分（如 split=','  end=')'）

    it('空列表：只有 start 和 end, has=false, len=0', () => {
        const stream = makeASTStream([t('('), t(')')])
        const rule = new ASTRule_While('Params', TokenType.Keyword, TokenType.Identifier, ',', TokenType.Keyword)
        rule.stream = stream
        expect(rule.match()).toBe(true)
        expect(rule.has).toBe(false)
        expect(rule.len).toBe(0)
    })

    it('空列表 generate 返回 {type, children:[], line:[start,end]}', () => {
        const stream = makeASTStream([t('('), t(')')])
        const rule = new ASTRule_While('Params', TokenType.Keyword, TokenType.Identifier, ',', TokenType.Keyword)
        rule.stream = stream
        rule.match()
        const result = rule.generate() as ast_data
        expect(result.type).toBe('Params')
        expect(result.children).toEqual([])
        expect(result.line).toHaveLength(2)
        expect(result.line).toContain('test:(')
        expect(result.line).toContain('test:)')
    })

    it('单元素列表：has=true, len=1', () => {
        const stream = makeASTStream([
            t('('),
            t('x', TokenType.Identifier),
            t(')')
        ])
        const rule = new ASTRule_While('Params', TokenType.Keyword, TokenType.Identifier, ',', TokenType.Keyword)
        rule.stream = stream
        expect(rule.match()).toBe(true)
        expect(rule.has).toBe(true)
        expect(rule.len).toBe(1)
    })

    it('单元素 generate: children 含 1 个 body, line 含 body+end', () => {
        const stream = makeASTStream([
            t('('),
            t('x', TokenType.Identifier),
            t(')')
        ])
        const rule = new ASTRule_While('Params', TokenType.Keyword, TokenType.Identifier, ',', TokenType.Keyword)
        rule.stream = stream
        rule.match()
        const result = rule.generate() as ast_data
        expect(result.type).toBe('Params')
        expect(result.children).toHaveLength(1)
        expect(result.children[0]).toBe('x')
        expect(result.line).toContain('test:(')
        expect(result.line).toContain('test:x')
        expect(result.line).toContain('test:)')
    })

    it('多元素列表（字符串区分 split 和 end）, len=3', () => {
        const stream = makeASTStream([
            t('('),
            t('a', TokenType.Identifier),
            t(','),
            t('b', TokenType.Identifier),
            t(','),
            t('c', TokenType.Identifier),
            t(')')
        ])
        const rule = new ASTRule_While('Block', TokenType.Keyword, TokenType.Identifier, ',', ')')
        rule.stream = stream
        rule.match()
        expect(rule.len).toBe(3)
        expect(rule.has).toBe(true)
    })

    it('多元素 generate: children 含 3 个 body, line 含 body+end', () => {
        const stream = makeASTStream([
            t('('),
            t('a', TokenType.Identifier),
            t(','),
            t('b', TokenType.Identifier),
            t(','),
            t('c', TokenType.Identifier),
            t(')')
        ])
        const rule = new ASTRule_While('Block', TokenType.Keyword, TokenType.Identifier, ',', ')')
        rule.stream = stream
        rule.match()
        const result = rule.generate() as ast_data
        expect(result.type).toBe('Block')
        expect(result.children).toHaveLength(3)
        expect(result.children[0]).toBe('a')
        expect(result.children[1]).toBe('b')
        expect(result.children[2]).toBe('c')
        expect(result.line).toContain('test:a')
        expect(result.line).toContain('test:b')
        expect(result.line).toContain('test:c')
    })

    it('没有 stream 时 match 返回 false', () => {
        const rule = new ASTRule_While('Test', TokenType.Keyword, TokenType.Identifier, ',', TokenType.Keyword)
        // 未设置 rule.stream
        expect(rule.match()).toBe(false)
    })
})

// ==================== ASTRule_Seg 嵌套 ====================
describe('ASTRule_Seg - 嵌套规则', () => {
    it('嵌套 ASTRule_Or 匹配成功', () => {
        const stream = makeASTStream([t('hello', TokenType.Identifier)])
        const innerOr = new ASTRule_Or(stream, 'inner', TokenType.Keyword, TokenType.Identifier)
        const rule = new ASTRule_Seg(stream, 'outer', innerOr)
        expect(rule.match()).toBe(true)
    })

    it('嵌套 ASTRule_Or 匹配失败则整体返回 false', () => {
        const stream = makeASTStream([t('123', TokenType.Number)])
        const innerOr = new ASTRule_Or(stream, 'inner', TokenType.Keyword, TokenType.Identifier)
        const rule = new ASTRule_Seg(stream, 'outer', innerOr)
        expect(rule.match()).toBe(false)
    })

    it('嵌套 ASTRule_Seg 多层匹配', () => {
        const stream = makeASTStream([
            t('a', TokenType.Identifier),
            t('+', TokenType.Keyword),
            t('b', TokenType.Identifier)
        ])
        const innerSeg = new ASTRule_Seg(stream, 'Inner', TokenType.Identifier)
        const outerSeg = new ASTRule_Seg(stream, 'Outer', innerSeg, TokenType.Keyword, innerSeg)
        expect(outerSeg.match()).toBe(true)
    })
})

// ==================== ASTVisitor ====================
describe('ASTVisitor', () => {
    it('注册 visitor 并在 visit 时调用', () => {
        const ast: ast_data = { type: 'Program', line: [], children: [] }
        const visitor = new ASTVisitor(ast)
        let called = false
        visitor.register('Program', (a) => {
            called = true
            return a
        })
        visitor.visit()
        expect(called).toBe(true)
    })

    it('递归访问子节点', () => {
        const ast: ast_data = {
            type: 'Program',
            line: [],
            children: [
                { type: 'Stmt', line: [], children: [] },
                { type: 'Stmt', line: [], children: [] }
            ]
        }
        const visitor = new ASTVisitor(ast)
        let count = 0
        visitor.register('Program', (a) => a)
        visitor.register('Stmt', (a) => { count++; return a })
        visitor.visit()
        expect(count).toBe(2)
    })

    it('visitor 返回的修改写回父节点', () => {
        const ast: ast_data = {
            type: 'Program',
            line: [],
            children: [{ type: 'Expr', line: [], children: [] }]
        }
        const visitor = new ASTVisitor(ast)
        visitor.register('Expr', (a) => ({ ...a, type: 'Modified' }))
        visitor.register('Program', (a) => a)
        const result = visitor.visit()
        const child = result.children[0] as ast_data
        expect(child.type).toBe('Modified')
    })

    it('跳过字符串类型的 children（不递归）', () => {
        const ast: ast_data = {
            type: 'Program',
            line: [],
            children: ['hello', 'world']
        }
        const visitor = new ASTVisitor(ast)
        visitor.register('Program', (a) => a)
        const result = visitor.visit()
        expect(result.children).toEqual(['hello', 'world'])
    })

    it('关闭时修改自身节点', () => {
        const ast: ast_data = { type: 'Number', line: [], children: [] }
        const visitor = new ASTVisitor(ast)
        visitor.register('Number', (a) => ({ ...a, type: 'Transformed', line: ['new_line'] }))
        const result = visitor.visit()
        expect(result.type).toBe('Transformed')
        expect(result.line).toEqual(['new_line'])
    })

    it('深层嵌套递归', () => {
        const ast: ast_data = {
            type: 'A',
            line: [],
            children: [{
                type: 'B',
                line: [],
                children: [{ type: 'C', line: [], children: [] }]
            }]
        }
        const visitor = new ASTVisitor(ast)
        const visited: string[] = []
        visitor.register('A', (a) => { visited.push('A'); return a })
        visitor.register('B', (a) => { visited.push('B'); return a })
        visitor.register('C', (a) => { visited.push('C'); return a })
        visitor.visit()
        expect(visited).toEqual(['A', 'B', 'C'])
    })
})

// ==================== 工厂函数 ====================
describe('parser 默认导出 - AST 工厂函数', () => {
    it('ast.s 创建 ASTRule_Seg', () => {
        const rule = parser.ast.s('test', TokenType.Keyword)
        expect(rule).toBeInstanceOf(ASTRule_Seg)
    })

    it('ast.o 创建 ASTRule_Or', () => {
        const rule = parser.ast.o('test', TokenType.Keyword)
        expect(rule).toBeInstanceOf(ASTRule_Or)
    })

    it('ast.c 创建 ASTRule_Choose', () => {
        const rule = parser.ast.c('test', TokenType.Keyword)
        expect(rule).toBeInstanceOf(ASTRule_Choose)
    })

    it('ast.l 创建 ASTRule_Loop', () => {
        const rule = parser.ast.l('test', TokenType.Keyword)
        expect(rule).toBeInstanceOf(ASTRule_Loop)
    })

    it('ast.w 创建 ASTRule_While', () => {
        const rule = parser.ast.w('test', TokenType.Keyword, TokenType.Identifier, ',', TokenType.Keyword)
        expect(rule).toBeInstanceOf(ASTRule_While)
    })

    it('ast.visit 使用 visitor 数组正确访问 AST', () => {
        const ast: ast_data = { type: 'Root', line: [], children: [] }
        let visited = false
        const result = parser.ast.visit(ast, [
            { name: 'Root', visitor: (a) => { visited = true; return a } }
        ])
        expect(visited).toBe(true)
        expect(result.type).toBe('Root')
    })
})
