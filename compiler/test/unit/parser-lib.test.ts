import { describe, it, expect } from 'vitest'
import { lexer } from '../../utils/lexer'
import { Parser as $, ast_data, TokenType } from '../../utils'

// 辅助: lex → 以指定规则集解析
// 注意:lexer 会把连续字母合并为单个标识符 token,故输入中 token 之间用空格分隔
function parse_entry(entry: string, rules: any[], code: string): ast_data | string | null {
    return $.run(entry, rules, lexer(code))
}

// ==================== seg 规则 ====================
describe('seg 规则', () => {
    it('拼接子规则并生成连续 child 索引', () => {
        const rule = $.s('Seq', 'a', 'b', 'c')
        const r = parse_entry('Seq', [rule], 'a b c') as ast_data
        expect(r.type).toBe('Seq')
        expect(r.children.get('child_0')).toBe('a')
        expect(r.children.get('child_1')).toBe('b')
        expect(r.children.get('child_2')).toBe('c')
    })

    it('顺序不匹配则整体失败', () => {
        const rule = $.s('Seq', 'a', 'b')
        expect(() => parse_entry('Seq', [rule], 'b a')).toThrow()
    })

    it('子规则解析的 ast 作为 child 保留', () => {
        const inner = $.s('Inner', 'i')
        const outer = $.s('Outer', 'x', $.r('Inner'), 'y')
        const r = parse_entry('Outer', [inner, outer], 'x i y') as ast_data
        expect(r.type).toBe('Outer')
        const child = r.children.get('child_1') as ast_data
        expect(child.type).toBe('Inner')
    })

    it('缺失 token 时整体失败', () => {
        const rule = $.s('Seq', 'a', 'b')
        expect(() => parse_entry('Seq', [rule], 'a')).toThrow()
    })
})

// ==================== delete 规则 ====================
describe('delete 规则', () => {
    it('占位匹配但不产生 child', () => {
        const rule = $.s('Del', $.d('a'), 'b')
        const r = parse_entry('Del', [rule], 'a b') as ast_data
        expect(r.type).toBe('Del')
        expect(r.children.size).toBe(1)
        expect(r.children.get('child_0')).toBe('b')
    })

    it('delete 匹配失败则整体失败', () => {
        const rule = $.s('Del', $.d('a'), 'b')
        expect(() => parse_entry('Del', [rule], 'z b')).toThrow()
    })
})

// ==================== child 规则 ====================
describe('child 规则', () => {
    it('返回第一个 object child', () => {
        const inner = $.s('Inner', 'i')
        const outer = $.s('Outer', $.t('(', $.r('Inner'), ')'), 'y')
        const r = parse_entry('Outer', [inner, outer], '( i ) y') as ast_data
        const child = r.children.get('child_0') as ast_data
        expect(child.type).toBe('Inner')
    })

    it('child 只透传 object,忽略字符串', () => {
        const rule = $.s('Wrap', $.t('(', 'x', ')'))
        const r = parse_entry('Wrap', [rule], '( x )') as ast_data
        // t 内无 object child → child 返回空节点
        const child = r.children.get('child_0') as ast_data
        expect(child.type).toBeNull()
    })
})

// ==================== or 规则 ====================
describe('or 规则', () => {
    it('返回命中的候选', () => {
        const rule = $.o('Pick', 'a', 'b', 'c')
        expect(parse_entry('Pick', [rule], 'b')).toBe('b')
    })

    it('全部候选失败则抛错', () => {
        const rule = $.o('Pick', 'a', 'b')
        expect(() => parse_entry('Pick', [rule], 'z')).toThrow()
    })

    it('候选失败后回滚位置再试下一个', () => {
        // 候选1 解析 AB('a b') 在 'b' 处失败,必须回滚到起点后才能命中候选2 AC('a c')
        const ab = $.s('AB', 'a', 'b')
        const ac = $.s('AC', 'a', 'c')
        const rule = $.o('Rollback', $.r('AB'), $.r('AC'))
        const r = parse_entry('Rollback', [ab, ac, rule], 'a c') as ast_data
        expect(r.type).toBe('AC')
    })

    it('命中的 ast 候选作为结果返回', () => {
        const a = $.s('A', 'a')
        const pick = $.o('Pick', $.r('A'), 'b')
        const r = parse_entry('Pick', [a, pick], 'a') as ast_data
        expect(r.type).toBe('A')
    })
})

// ==================== choose 规则 ====================
describe('choose 规则', () => {
    it('整个序列匹配时返回最后一条结果', () => {
        const rule = $.s('Wrap', $.c('a', 'b'))
        const r = parse_entry('Wrap', [rule], 'a b') as ast_data
        expect(r.children.get('child_0')).toBe('b')
    })

    it('匹配失败返回 null 且不报错,外层 seg 跳过', () => {
        const rule = $.s('Wrap', 'x', $.c('a', 'b'), 'y')
        const r = parse_entry('Wrap', [rule], 'x y') as ast_data
        expect(r.type).toBe('Wrap')
        expect(r.children.get('child_0')).toBe('x')
        expect(r.children.get('child_1')).toBe('y')
    })

    it('部分匹配后正确回滚位置', () => {
        // choose('a','b') 中 'a' 命中但 'b' 不匹配 → 整体回滚到 choose 起点
        // 回滚后外层 'a' 必须能从起点重新命中
        const rule = $.s('Wrap', 'x', $.c('a', 'b'), 'a')
        const r = parse_entry('Wrap', [rule], 'x a') as ast_data
        expect(r.children.get('child_0')).toBe('x')
        expect(r.children.get('child_1')).toBe('a')
    })

    it('子规则命中即视为可选片段存在', () => {
        const rule = $.s('Wrap', $.c('await'), 'x')
        const r = parse_entry('Wrap', [rule], 'await x') as ast_data
        expect(r.children.get('child_0')).toBe('await')
        expect(r.children.get('child_1')).toBe('x')
    })
})

// ==================== call 规则 ====================
describe('call 规则', () => {
    it('按名字引用其他规则', () => {
        const inner = $.s('Inner', 'i')
        const outer = $.s('Outer', 'x', $.r('Inner'))
        const r = parse_entry('Outer', [inner, outer], 'x i') as ast_data
        expect(r.children.get('child_1') as ast_data).toMatchObject({ type: 'Inner' })
    })

    it('引用不存在的规则抛错', () => {
        const outer = $.s('Outer', 'x', $.r('Missing'))
        expect(() => parse_entry('Outer', [outer], 'x')).toThrow()
    })
})

// ==================== while 规则 ====================
describe('while 规则', () => {
    it('零次匹配返回 null', () => {
        const rule = $.w('WList', TokenType.Identifier, ',')
        expect(parse_entry('WList', [rule], '')).toBeNull()
    })

    it('多次匹配生成 param 序列', () => {
        const rule = $.w('WList', TokenType.Identifier, ',')
        const r = parse_entry('WList', [rule], 'a,b,c') as ast_data
        expect(r.type).toBe('WList')
        expect(r.children.get('param_0')).toBe('a')
        expect(r.children.get('param_1')).toBe('b')
        expect(r.children.get('param_2')).toBe('c')
    })

    it('分隔符缺失时停止', () => {
        const rule = $.w('WList', TokenType.Identifier, ',')
        const r = parse_entry('WList', [rule], 'a,b') as ast_data
        expect(r.children.size).toBe(2)
    })

    it('分隔符已消费但后续项失败时回滚分隔符', () => {
        // while(Identifier, '.') 匹配到 'a.', 分隔符 '.' 后无 Identifier
        // 必须回滚 '.' 才能让外层 '.' 命中
        const rule = $.s('Wrap', $.w('W', TokenType.Identifier, '.'), '.')
        const r = parse_entry('Wrap', [rule], 'a.') as ast_data
        expect(r.type).toBe('Wrap')
        const w = r.children.get('child_0') as ast_data
        expect(w.type).toBe('W')
        expect(w.children.size).toBe(1)
        expect(r.children.get('child_1')).toBe('.')
    })

    it('首次项失败时恢复位置并返回 null', () => {
        // while 首次要求 Number,'y' 不是 Number → 0 次匹配,回滚后外层 'y' 命中
        const rule = $.s('Wrap', 'x', $.w('W', TokenType.Number, '.'), 'y')
        const r = parse_entry('Wrap', [rule], 'x y') as ast_data
        expect(r.children.get('child_0')).toBe('x')
        expect(r.children.get('child_1')).toBe('y')
    })
})

// ==================== loop 规则 ====================
describe('loop 规则', () => {
    it('零次匹配返回空节点', () => {
        const rule = $.l('LList', 'a')
        const r = parse_entry('LList', [rule], '') as ast_data
        expect(r.type).toBe('LList')
        expect(r.children.size).toBe(0)
    })

    it('多次匹配生成 param 序列', () => {
        const rule = $.l('LList', 'a')
        const r = parse_entry('LList', [rule], 'a a a') as ast_data
        expect(r.type).toBe('LList')
        expect(r.children.size).toBe(3)
    })

    it('部分失败时回滚位置', () => {
        // loop 的 data 是 'a b' 序列;第三次在 'a' 后 'b' 失败,需回滚后让外层 'c' 命中
        const rule = $.s('Wrap', $.l('L', $.s('Pair', 'a', 'b')), 'c')
        const r = parse_entry('Wrap', [rule], 'a b a b c') as ast_data
        const l = r.children.get('child_0') as ast_data
        expect(l.children.size).toBe(2)
        expect(r.children.get('child_1')).toBe('c')
    })
})

// ==================== EOF 与错误 ====================
describe('EOF 与错误处理', () => {
    it('空输入解析失败时错误消息标记 EOF', () => {
        const rule = $.s('Need', 'x')
        expect(() => parse_entry('Need', [rule], '')).toThrow(/EOF/)
    })

    it('输入耗尽时 or 错误消息标记 EOF', () => {
        const rule = $.o('Pick', 'a', 'b')
        expect(() => parse_entry('Pick', [rule], '')).toThrow(/EOF/)
    })

    it('TokenType 匹配失败时错误消息标记 EOF', () => {
        const rule = $.s('Need', TokenType.Number)
        expect(() => parse_entry('Need', [rule], '')).toThrow(/EOF/)
    })
})

// ==================== 规则对象状态污染回归 ====================
describe('规则对象状态污染回归', () => {
    it('delete 规则失败后不污染共享规则对象', () => {
        const del = $.d('a')
        const A = $.s('A', del, 'b')
        const pick = $.o('Pick', $.r('A'), 'c')
        const w = $.s('W', 'x', $.r('Pick'), 'y')
        const rules = [del, A, pick, w]
        // 第一次: Pick 尝试 A(del 'a' 遇 'c' 失败) 后命中 'c'
        const r1 = $.run('W', rules, lexer('x c y')) as ast_data
        expect(r1.children.get('child_1')).toBe('c')
        // 第二次: 同一 del 对象必须仍是 delete, A 正常解析 'a b'
        const r2 = $.run('W', rules, lexer('x a b y')) as ast_data
        const a = r2.children.get('child_1') as ast_data
        expect(a.type).toBe('A')
        expect(a.children.size).toBe(1)
        expect(a.children.get('child_0')).toBe('b')
    })

    it('child 规则失败后不污染共享规则对象', () => {
        const t = $.t('(', 'x', ')')
        const w = $.s('W', $.o('Pick', t, 'z'), 'y')
        const rules = [w]
        // 第一次: t 匹配 '( x )'
        const r1 = $.run('W', rules, lexer('( x ) y')) as ast_data
        expect(r1.children.get('child_0')).toBeDefined()
        // 第二次: t '(' 遇 'z' 失败 → 命中 'z'
        const r2 = $.run('W', rules, lexer('z y')) as ast_data
        expect(r2.children.get('child_0')).toBe('z')
        // 第三次: 同一 t 对象仍正常匹配
        const r3 = $.run('W', rules, lexer('( x ) y')) as ast_data
        expect(r3.children.get('child_0')).toBeDefined()
    })
})
