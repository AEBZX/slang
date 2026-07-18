import { describe, it, expect } from 'vitest'
import parser, { CSTStream, CSTRule_Seg, CSTRule_Or, CSTRule_Choose, CSTRule_Loop, CSTRule_While, cst_match } from '../../utils/lib/parser'
import { TokenType, token, cst_data } from '../../utils/data'

function t(value: string, type: TokenType = TokenType.Keyword): token {
    return { type, value, line: `test:${value}` }
}

function makeStream(tokens: token[]): CSTStream {
    return new CSTStream(tokens)
}

// ==================== CSTStream ====================
describe('CSTStream', () => {
    it('初始化：index=0, code 正确存储', () => {
        const s = new CSTStream([t('a'), t('b')])
        expect(s.index).toBe(0)
        expect(s.code).toHaveLength(2)
    })

    it('now() 返回当前位置的 token', () => {
        const s = makeStream([t('hello'), t('world')])
        expect(s.now().value).toBe('hello')
        expect(s.now().type).toBe(TokenType.Keyword)
    })

    it('next() 返回当前 token 并前进 index', () => {
        const s = makeStream([t('a'), t('b'), t('c')])
        const n = s.next()
        expect(n.value).toBe('a')
        expect(s.index).toBe(1)
        expect(s.now().value).toBe('b')
    })

    it('peek() 返回下一个 token 但不改变 index', () => {
        const s = makeStream([t('x'), t('y')])
        const p = s.peek()
        expect(p.value).toBe('y')
        expect(s.index).toBe(0)
    })

    it('read_mode() 保存位置, write_mode() 恢复位置', () => {
        const s = makeStream([t('a'), t('b'), t('c')])
        s.read_mode()
        s.next()
        s.next()
        expect(s.index).toBe(2)
        s.write_mode()
        expect(s.index).toBe(0)
    })

    it('多次 read_mode/write_mode 正确覆盖', () => {
        const s = makeStream([t('a'), t('b'), t('c')])
        s.read_mode()  // read_index=0
        s.next()       // index=1
        s.read_mode()  // read_index=1
        s.next()       // index=2
        s.write_mode() // index=1
        expect(s.index).toBe(1)
    })
})

// ==================== CSTRule_Seg ====================
describe('CSTRule_Seg', () => {
    it('按 TokenType 匹配单个元素', () => {
        const stream = makeStream([t('+', TokenType.Keyword)])
        const rule = new CSTRule_Seg(stream, TokenType.Keyword)
        expect(rule.match()).toBe(true)
    })

    it('按字符串值匹配单个元素', () => {
        const stream = makeStream([t('if', TokenType.Keyword)])
        const rule = new CSTRule_Seg(stream, 'if')
        expect(rule.match()).toBe(true)
    })

    it('类型不匹配返回 false', () => {
        const stream = makeStream([t('+', TokenType.Keyword)])
        const rule = new CSTRule_Seg(stream, TokenType.Number)
        expect(rule.match()).toBe(false)
    })

    it('字符串值不匹配返回 false', () => {
        const stream = makeStream([t('else', TokenType.Keyword)])
        const rule = new CSTRule_Seg(stream, 'if')
        expect(rule.match()).toBe(false)
    })

    it('多元素序列全部匹配返回 true', () => {
        const stream = makeStream([
            t('a', TokenType.Identifier),
            t('=', TokenType.Keyword),
            t('10', TokenType.Number)
        ])
        const rule = new CSTRule_Seg(stream, TokenType.Identifier, TokenType.Keyword, TokenType.Number)
        expect(rule.match()).toBe(true)
    })

    it('多元素序列中间不匹配返回 false', () => {
        const stream = makeStream([
            t('a', TokenType.Identifier),
            t('+', TokenType.Keyword),
            t('10', TokenType.Number)
        ])
        const rule = new CSTRule_Seg(stream, TokenType.Identifier, '=')
        expect(rule.match()).toBe(false)
    })

    it('generate 返回匹配到的 token 数组', () => {
        const stream = makeStream([t('a', TokenType.Identifier), t('b', TokenType.Identifier)])
        const rule = new CSTRule_Seg(stream, TokenType.Identifier, TokenType.Identifier)
        rule.match()
        const result = rule.generate() as token[]
        expect(result).toHaveLength(2)
        expect(result[0].value).toBe('a')
        expect(result[1].value).toBe('b')
    })
})

// ==================== CSTRule_Or ====================
describe('CSTRule_Or', () => {
    it('匹配第一个成功的选项', () => {
        const stream = makeStream([t('+', TokenType.Keyword)])
        const rule = new CSTRule_Or(stream, TokenType.Number, TokenType.Keyword, TokenType.Identifier)
        expect(rule.match()).toBe(true)
    })

    it('所有选项都不匹配返回 false', () => {
        const stream = makeStream([t('hello', TokenType.Identifier)])
        const rule = new CSTRule_Or(stream, TokenType.Number, TokenType.Keyword)
        expect(rule.match()).toBe(false)
    })

    it('按字符串值匹配', () => {
        const stream = makeStream([t('hello', TokenType.Identifier)])
        const rule = new CSTRule_Or(stream, '+', TokenType.Identifier)
        expect(rule.match()).toBe(true)
    })

    it('generate 返回匹配到的单个 token', () => {
        const stream = makeStream([t('hello', TokenType.Identifier)])
        const rule = new CSTRule_Or(stream, TokenType.Keyword, TokenType.Identifier)
        rule.match()
        const result = rule.generate() as token
        expect(result.value).toBe('hello')
        expect(result.type).toBe(TokenType.Identifier)
    })
})

// ==================== CSTRule_Choose ====================
describe('CSTRule_Choose', () => {
    it('匹配时 has=true, match 返回 true', () => {
        const stream = makeStream([t('+', TokenType.Keyword)])
        const rule = new CSTRule_Choose(stream, TokenType.Keyword)
        expect(rule.match()).toBe(true)
        expect(rule.has).toBe(true)
    })

    it('不匹配时 has=false, match 仍返回 true（可选规则）', () => {
        const stream = makeStream([t('x', TokenType.Identifier)])
        const rule = new CSTRule_Choose(stream, TokenType.Keyword)
        expect(rule.match()).toBe(true)
        expect(rule.has).toBe(false)
    })

    it('has=false 时 generate 返回空数组', () => {
        const stream = makeStream([t('x', TokenType.Identifier)])
        const rule = new CSTRule_Choose(stream, TokenType.Keyword)
        rule.match()
        const result = rule.generate() as cst_data[]
        expect(result).toEqual([])
    })

    it('has=true 时 generate 返回匹配的 token 数组', () => {
        const stream = makeStream([t('hello', TokenType.Identifier)])
        const rule = new CSTRule_Choose(stream, TokenType.Identifier)
        rule.match()
        const result = rule.generate() as token[]
        expect(result).toHaveLength(1)
        expect(result[0].value).toBe('hello')
    })
})

// ==================== CSTRule_Loop ====================
describe('CSTRule_Loop', () => {
    it('零次匹配返回 true, len=0', () => {
        const stream = makeStream([t('+', TokenType.Keyword)])
        const rule = new CSTRule_Loop(stream, TokenType.Number)
        expect(rule.match()).toBe(true)
        expect(rule.len).toBe(0)
    })

    it('匹配多次相同模式', () => {
        const stream = makeStream([
            t('a', TokenType.Identifier),
            t('b', TokenType.Identifier),
            t('c', TokenType.Identifier),
            t('+', TokenType.Keyword)
        ])
        const rule = new CSTRule_Loop(stream, TokenType.Identifier)
        expect(rule.match()).toBe(true)
        expect(rule.len).toBe(3)
    })

    it('generate 产生正确数量的 token 数组', () => {
        const stream = makeStream([
            t('a', TokenType.Identifier),
            t('b', TokenType.Identifier),
            t('+', TokenType.Keyword)
        ])
        const rule = new CSTRule_Loop(stream, TokenType.Identifier)
        rule.match()
        const result = rule.generate() as token[]
        expect(result).toHaveLength(2)
        expect(result[0].value).toBe('a')
        expect(result[1].value).toBe('b')
    })
})

// ==================== CSTRule_While ====================
describe('CSTRule_While', () => {
    it('空列表：只有 start 和 end, has=false, len=0', () => {
        const stream = makeStream([t('('), t(')')])
        const rule = new CSTRule_While(TokenType.Keyword, TokenType.Identifier, ',', TokenType.Keyword)
        rule.stream = stream
        expect(rule.match()).toBe(true)
        expect(rule.has).toBe(false)
        expect(rule.len).toBe(0)
    })

    it('空列表 generate 返回 [start_token, end_token]', () => {
        const stream = makeStream([t('('), t(')')])
        const rule = new CSTRule_While(TokenType.Keyword, TokenType.Identifier, ',', TokenType.Keyword)
        rule.stream = stream
        rule.match()
        const result = rule.generate() as token[]
        expect(result).toHaveLength(2)
        expect(result[0].value).toBe('(')
        expect(result[1].value).toBe(')')
    })

    it('多元素列表（使用字符串值区分 split 和 end）', () => {
        const stream = makeStream([
            t('('),
            t('a', TokenType.Identifier),
            t(','),
            t('b', TokenType.Identifier),
            t(')')
        ])
        const rule = new CSTRule_While(TokenType.Keyword, TokenType.Identifier, ',', ')')
        rule.stream = stream
        expect(rule.match()).toBe(true)
        expect(rule.has).toBe(true)
        expect(rule.len).toBe(1) // 第一个 body 在循环外, len 记录循环内额外匹配的 body 数
    })

    it('多元素 generate 返回 [start, body1, split, body2, end]', () => {
        const stream = makeStream([
            t('('),
            t('a', TokenType.Identifier),
            t(','),
            t('b', TokenType.Identifier),
            t(')')
        ])
        const rule = new CSTRule_While(TokenType.Keyword, TokenType.Identifier, ',', ')')
        rule.stream = stream
        rule.match()
        const result = rule.generate() as token[]
        expect(result).toHaveLength(5)
        expect(result[0].value).toBe('(')
        expect(result[1].value).toBe('a')
        expect(result[2].value).toBe(',')
        expect(result[3].value).toBe('b')
        expect(result[4].value).toBe(')')
    })
})

// ==================== 嵌套 CST 规则 ====================
describe('CST 嵌套规则', () => {
    it('CSTRule_Seg 嵌套 CSTRule_Or 匹配成功', () => {
        const stream = makeStream([t('hello', TokenType.Identifier)])
        const innerOr = new CSTRule_Or(stream, TokenType.Keyword, TokenType.Identifier)
        const rule = new CSTRule_Seg(stream, innerOr)
        expect(rule.match()).toBe(true)
    })

    it('CSTRule_Seg 嵌套 CSTRule_Or 匹配失败', () => {
        const stream = makeStream([t('123', TokenType.Number)])
        const innerOr = new CSTRule_Or(stream, TokenType.Keyword, TokenType.Identifier)
        const rule = new CSTRule_Seg(stream, innerOr)
        expect(rule.match()).toBe(false)
    })

    it('嵌套 generate 正确委托给子规则', () => {
        const stream = makeStream([t('hello', TokenType.Identifier)])
        const innerOr = new CSTRule_Or(stream, TokenType.Keyword, TokenType.Identifier)
        const rule = new CSTRule_Seg(stream, innerOr)
        rule.match()
        const result = rule.generate() as token[]
        expect(result).toHaveLength(1)
        expect(result[0].value).toBe('hello')
    })

    it('CSTRule_Loop 嵌套 CSTRule_Seg', () => {
        const stream = makeStream([
            t('a', TokenType.Identifier),
            t('+', TokenType.Keyword)
        ])
        // 创建一个匹配 Identifier 的 Seg, 放入 Loop
        const seg = new CSTRule_Seg(stream, TokenType.Identifier)
        const loop = new CSTRule_Loop(stream, seg)
        expect(loop.match()).toBe(true)
        expect(loop.len).toBe(1)
    })
})

// ==================== 工厂函数 ====================
describe('parser 默认导出 - CST 工厂函数', () => {
    it('cst.s 创建 CSTRule_Seg', () => {
        const rule = parser.cst.s(TokenType.Keyword)
        expect(rule).toBeInstanceOf(CSTRule_Seg)
    })

    it('cst.o 创建 CSTRule_Or', () => {
        const rule = parser.cst.o(TokenType.Keyword)
        expect(rule).toBeInstanceOf(CSTRule_Or)
    })

    it('cst.c 创建 CSTRule_Choose', () => {
        const rule = parser.cst.c(TokenType.Keyword)
        expect(rule).toBeInstanceOf(CSTRule_Choose)
    })

    it('cst.l 创建 CSTRule_Loop', () => {
        const rule = parser.cst.l(TokenType.Keyword)
        expect(rule).toBeInstanceOf(CSTRule_Loop)
    })

    it('cst.w 创建 CSTRule_While', () => {
        const rule = parser.cst.w(TokenType.Keyword, TokenType.Identifier, ',', TokenType.Keyword)
        expect(rule).toBeInstanceOf(CSTRule_While)
    })
})

// ==================== CSTStream 报错功能 ====================
describe('CSTStream - 报错功能', () => {
    it('error 数组初始化为空', () => {
        const s = new CSTStream([])
        expect(s.error).toEqual([])
    })

    it('thr() 向 error 数组添加消息', () => {
        const s = new CSTStream([])
        s.thr('错误信息1')
        expect(s.error).toHaveLength(1)
        expect(s.error[0]).toBe('错误信息1')
    })

    it('多次 thr() 累积错误', () => {
        const s = new CSTStream([])
        s.thr('第一个错误')
        s.thr('第二个错误')
        expect(s.error).toHaveLength(2)
        expect(s.error).toEqual(['第一个错误', '第二个错误'])
    })

    it('匹配失败后 error 保持空（现有 match 不使用 thr）', () => {
        const s = makeStream([t('+', TokenType.Keyword)])
        const rule = new CSTRule_Seg(s, TokenType.Number)
        rule.match()
        expect(s.error).toEqual([])
    })
})

// ==================== cst_match 导出函数 ====================
describe('cst_match', () => {
    it('按字符串值匹配成功返回 true, 前进 index', () => {
        const s = makeStream([t('if', TokenType.Keyword)])
        const idx = s.index
        expect(cst_match(s, 'if')).toBe(true)
        expect(s.index).toBe(idx + 1)
    })

    it('按字符串值匹配失败返回 false, 记录错误', () => {
        const s = makeStream([t('else', TokenType.Keyword)])
        expect(cst_match(s, 'if')).toBe(false)
        expect(s.error).toHaveLength(1)
        expect(s.error[0]).toContain('期望为token:if')
        expect(s.error[0]).toContain('else')
    })

    it('按 TokenType 匹配成功返回 true, 前进 index', () => {
        const s = makeStream([t('+', TokenType.Keyword)])
        const idx = s.index
        expect(cst_match(s, TokenType.Keyword)).toBe(true)
        expect(s.index).toBe(idx + 1)
    })

    it('按 TokenType 匹配失败返回 false, 记录错误', () => {
        const s = makeStream([t('+', TokenType.Keyword)])
        expect(cst_match(s, TokenType.Number)).toBe(false)
        expect(s.error).toHaveLength(1)
        expect(s.error[0]).toContain('期望为token:')
    })

    it('匹配 CSTRule 委托给规则的 match 方法', () => {
        const s = makeStream([t('hello', TokenType.Identifier)])
        const inner = new CSTRule_Or(s, TokenType.Keyword, TokenType.Identifier)
        expect(cst_match(s, inner)).toBe(true)
    })

    it('CSTRule 匹配失败返回 false（不通过 thr 报错）', () => {
        const s = makeStream([t('123', TokenType.Number)])
        const inner = new CSTRule_Or(s, TokenType.Keyword, TokenType.Identifier)
        expect(cst_match(s, inner)).toBe(false)
        expect(s.error).toHaveLength(0)
    })

    it('多次失败累积多个错误', () => {
        const s = makeStream([t('x', TokenType.Identifier)])
        cst_match(s, 'if')
        cst_match(s, TokenType.Number)
        expect(s.error).toHaveLength(2)
    })
})
