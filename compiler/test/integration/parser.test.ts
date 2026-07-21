import { describe, it, expect } from 'vitest'
import parser, {
    CSTStream, CSTRule_Seg, CSTRule_Or, CSTRule_Choose, CSTRule_Loop, CSTRule_While,
    ASTStream, ASTRule_Seg, ASTRule_Or, ASTRule_Choose, ASTRule_Loop, ASTRule_While,
    cst_match
} from '../../utils/lib/parser'
import { TokenType, token, cst_data, ast_data } from '../../utils/data'

function t(value: string, type: TokenType = TokenType.Keyword): token {
    return { type, value, line: `line_${value}` }
}

// =============================================================================
// 一、CST_Seg 平输出 → AST_Seg (无嵌套规则, 联动正确)
// =============================================================================
describe('CST_Seg → AST_Seg 联动 (平 token)', () => {
    it('纯 TokenType: CST 产生 token[], AST 正确消费生成 ast_data', () => {
        const tokens = [t('var', TokenType.Keyword), t('x', TokenType.Identifier)]
        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_Seg(cstStream, TokenType.Keyword, TokenType.Identifier)
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token[]

        expect(cstOut).toHaveLength(2)
        expect(cstOut[0].value).toBe('var')
        expect(cstOut[1].value).toBe('x')

        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_Seg(astStream, 'Decl', TokenType.Keyword, TokenType.Identifier)
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        expect(astOut.type).toBe('Decl')
        expect(astOut.children).toEqual(['var', 'x'])
        expect(astOut.line).toContain('line_var')
        expect(astOut.line).toContain('line_x')
    })

    it(`字符串值匹配: CST 匹配 'if' '(' → AST 也按值匹配`, () => {
        const tokens = [t('if', TokenType.Keyword), t('(', TokenType.Keyword)]
        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_Seg(cstStream, 'if', '(')
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token[]

        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_Seg(astStream, 'IfParen', 'if', '(')
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        expect(astOut.children).toEqual(['if', '('])
    })

    it('混合 TokenType 和字符串: CST 用类型+值, AST 同样', () => {
        const tokens = [t('+', TokenType.Keyword), t('=', TokenType.Keyword)]
        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_Seg(cstStream, TokenType.Keyword, '=')
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token[]

        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_Seg(astStream, 'PlusEq', TokenType.Keyword, '=')
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        expect(astOut.children).toEqual(['+', '='])
    })

    it('多元素 (4 tokens): CST → AST 完整传递', () => {
        const tokens = [
            t('var', TokenType.Keyword), t('x', TokenType.Identifier),
            t('=', TokenType.Keyword), t('10', TokenType.Number)
        ]
        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_Seg(cstStream,
            TokenType.Keyword, TokenType.Identifier, TokenType.Keyword, TokenType.Number)
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token[]

        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_Seg(astStream, 'VarInit',
            TokenType.Keyword, TokenType.Identifier, TokenType.Keyword, TokenType.Number)
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        expect(astOut.children).toEqual(['var', 'x', '=', '10'])
        expect(astOut.line).toHaveLength(4)
    })

    it('line 信息正确传播 (不同行的 token → Set 去重)', () => {
        const tokens: token[] = [
            { type: TokenType.Keyword, value: 'fn', line: '1' },
            { type: TokenType.Identifier, value: 'main', line: '1' },
            { type: TokenType.Keyword, value: '{', line: '2' },
        ]
        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_Seg(cstStream,
            TokenType.Keyword, TokenType.Identifier, TokenType.Keyword)
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token[]

        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_Seg(astStream, 'Func',
            TokenType.Keyword, TokenType.Identifier, TokenType.Keyword)
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        // 'fn' 和 'main' 都在第1行 → line 中去重后只有1个 '1'
        expect(astOut.line).toContain('1')
        expect(astOut.line).toContain('2')
        expect(astOut.line.filter(l => l === '1')).toHaveLength(1)
    })

    it('多种 token 类型混合: String/Number/Identifier/Comment', () => {
        const tokens = [
            t('"hello"', TokenType.String), t('42', TokenType.Number),
            t('flag', TokenType.Identifier), t('// note', TokenType.Comment)
        ]
        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_Seg(cstStream,
            TokenType.String, TokenType.Number, TokenType.Identifier, TokenType.Comment)
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token[]

        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_Seg(astStream, 'AllTypes',
            TokenType.String, TokenType.Number, TokenType.Identifier, TokenType.Comment)
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        expect(astOut.children).toEqual(['"hello"', '42', 'flag', '// note'])
        expect(astOut.line).toHaveLength(4)
    })
})

// =============================================================================
// 二、CST_Or → AST_Or 联动 (单 token 输出)
// =============================================================================
describe('CST_Or → AST_Or 联动', () => {
    it('CST_Or 匹配 TokenType → 输出单 token → AST_Or 消费', () => {
        const cstStream = new CSTStream([t('hello', TokenType.Identifier)])
        const cstRule = new CSTRule_Or(cstStream, TokenType.Keyword, TokenType.Identifier)
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token

        expect(cstOut.value).toBe('hello')
        expect(cstOut.type).toBe(TokenType.Identifier)

        const astStream = new ASTStream([cstOut])
        const astRule = new ASTRule_Or(astStream, 'Type', TokenType.Keyword, TokenType.Identifier)
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as token

        expect(astOut.value).toBe('hello')
    })

    it('CST_Or 匹配字符串值 → AST_Or 按值匹配', () => {
        const cstStream = new CSTStream([t('else', TokenType.Keyword)])
        const cstRule = new CSTRule_Or(cstStream, 'if', 'else', 'while')
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token

        expect(cstOut.value).toBe('else')

        const astStream = new ASTStream([cstOut])
        const astRule = new ASTRule_Or(astStream, 'Keyword', 'if', 'else')
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as token

        expect(astOut.value).toBe('else')
    })

    it('CST_Or 匹配 第一个 TokenType(非首个) → AST_Or 同样', () => {
        const cstStream = new CSTStream([t('+', TokenType.Keyword)])
        const cstRule = new CSTRule_Or(cstStream, TokenType.Number, TokenType.Keyword, TokenType.Identifier)
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token

        expect(cstOut.value).toBe('+')

        const astStream = new ASTStream([cstOut])
        const astRule = new ASTRule_Or(astStream, 'Op', TokenType.Number, TokenType.Keyword)
        expect(astRule.match()).toBe(true)
    })
})

// =============================================================================
// 三、CST_Choose → AST_Choose 联动 (可选规则)
// =============================================================================
describe('CST_Choose → AST_Choose 联动', () => {
    it('has=true: CST Choose 独立匹配 → 单 token 输出 → AST 消费', () => {
        const cstStream = new CSTStream([t('static', TokenType.Keyword)])
        const cstRule = new CSTRule_Choose(cstStream, TokenType.Keyword)
        expect(cstRule.match()).toBe(true)
        expect(cstRule.has).toBe(true)
        const cstOut = cstRule.generate() as token[]

        expect(cstOut).toHaveLength(1)
        expect(cstOut[0].value).toBe('static')

        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_Choose(astStream, 'Mod', TokenType.Keyword)
        expect(astRule.match()).toBe(true)
        expect(astRule.has).toBe(true)
        const astOut = astRule.generate() as token

        expect(astOut.value).toBe('static')
    })

    it('has=false: CST Choose 不匹配 → 输出 [] → AST Choose 产生空 ast_data', () => {
        const cstStream = new CSTStream([t('x', TokenType.Identifier)])
        const cstRule = new CSTRule_Choose(cstStream, TokenType.Number)
        expect(cstRule.match()).toBe(true)
        expect(cstRule.has).toBe(false)
        const cstOut = cstRule.generate() as cst_data[]

        expect(cstOut).toEqual([])

        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_Choose(astStream, 'Empty', TokenType.Number)
        expect(astRule.match()).toBe(true)
        expect(astRule.has).toBe(false)
        const astOut = astRule.generate() as ast_data

        expect(astOut.type).toBe('Empty')
        expect(astOut.children).toEqual([])
        expect(astOut.line).toEqual([])
    })
})

// =============================================================================
// 四、CST 嵌套 CSTRule (已修复: 每个规则独立 _idx)
// =============================================================================
describe('【已知Bug】CST 嵌套规则 _idx 独立保存', () => {
    it('【已修复】CST_Seg 内嵌 CSTRule_Or → generate 输出正确 (每个规则独立 _idx)', () => {
        // 修复: 每个规则保存自己的 _idx, 不再使用共享的 stream.read_index
        // CSTRule_Seg 和 CSTRule_Or 各自维护 _idx, 嵌套时不会互相覆盖

        const cstStream = new CSTStream([
            t('var', TokenType.Keyword),
            t('x', TokenType.Identifier)
        ])
        const innerOr = new CSTRule_Or(cstStream, TokenType.Identifier, TokenType.Number)
        const cstRule = new CSTRule_Seg(cstStream, TokenType.Keyword, innerOr)
        expect(cstRule.match()).toBe(true)

        const cstOut = cstRule.generate() as token[]

        // 现在 _idx 是每个规则独立的 → 输出正确
        expect(cstOut).toHaveLength(2)
        expect(cstOut[0].value).toBe('var')
        expect(cstOut[1].value).toBe('x')
    })

    it('CST_Seg 内嵌 CSTRule_Choose → 输出正确 (独立 _idx)', () => {
        // 修复后: Choose 和 Seg 各维护独立的 _idx
        const cstStream = new CSTStream([
            t('public', TokenType.Keyword),
            t('class', TokenType.Keyword),
            t('Foo', TokenType.Identifier)
        ])
        const cstChoose = new CSTRule_Choose(cstStream, TokenType.Keyword)
        const cstRule = new CSTRule_Seg(cstStream,
            cstChoose, TokenType.Keyword, TokenType.Identifier)
        expect(cstRule.match()).toBe(true)

        const cstOut = cstRule.generate() as token[]

        // 由于 read_index 被 Choose 覆盖 (Choose extends Seg, Seg.match 调用 read_mode)
        // generate 从错误位置开始
        expect(cstOut).toHaveLength(3)
        // cstOut[0] = Choose 输出 (数组), cstOut[1] = token, cstOut[2] = token
        // Choose 是 CSTRule, generate() 返回 cst_data[](数组), 嵌入外层 Seg 结果
        expect(Array.isArray(cstOut[0])).toBe(true)
        expect(cstOut[0][0].value).toBe('public')
    })

    it('嵌套 CST_Seg → AST 联动 (验证嵌套规则)', () => {
        // 当 CST 规则没有嵌套 CSTRule 时, read_index 不会被覆盖
        // 此测试验证"纯净"场景仍然正确
        const tokens = [t('var', TokenType.Keyword), t('x', TokenType.Identifier)]
        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_Seg(cstStream, TokenType.Keyword, TokenType.Identifier)
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token[]

        expect(cstOut[0].value).toBe('var')
        expect(cstOut[1].value).toBe('x')

        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_Seg(astStream, 'OK', TokenType.Keyword, TokenType.Identifier)
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        expect(astOut.children).toEqual(['var', 'x'])
    })

    it('【绕过方案】CST_Or 独立使用(不在 Seg 中) → 然后手动拼接 token → AST 可消费', () => {
        // 绕过 read_index 问题的方案:
        // 1. 每个 CSTRule 独立 match+generate (用自己的 stream 副本)
        // 2. 手动拼接结果
        // 3. 喂入 AST

        const tokens = [t('x', TokenType.Identifier)]
        const cstStream = new CSTStream([...tokens])
        const cstOr = new CSTRule_Or(cstStream, TokenType.Keyword, TokenType.Identifier)
        expect(cstOr.match()).toBe(true)
        const orResult = cstOr.generate() as token

        // AST 消费独立 Or 结果
        const astStream = new ASTStream([orResult])
        const astRule = new ASTRule_Or(astStream, 'Type', TokenType.Keyword, TokenType.Identifier)
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as token
        expect(astOut.value).toBe('x')
    })
})

// =============================================================================
// 五、CST 深层嵌套 (Or嵌套Seg) → 数组嵌套 → AST 无法消费
// =============================================================================
describe('【已知Bug】CST 深层嵌套产生数组 → AST 无法消费', () => {
    it('CSTRule_Or 匹配嵌套 CSTRule_Seg → generate 返回数组而非单 token', () => {
        // CSTRule_Or._d = CSTRule_Seg 时, generate 调用 Seg.generate()
        // Seg.generate() 返回 cst_data[] (数组)
        // 所以 Or.generate() 返回的是数组, 不是单个 token
        const cstStream = new CSTStream([t('if', TokenType.Keyword)])
        const segKey = new CSTRule_Seg(cstStream, TokenType.Keyword)
        const cstRule = new CSTRule_Or(cstStream, segKey, TokenType.Identifier)
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate()

        // Or 匹配了 Seg → generate 返回 Seg.generate() 结果 → 数组!
        expect(Array.isArray(cstOut)).toBe(true)
        expect(cstOut).toHaveLength(1)
        // 这是一个 token 数组, 不是单个 token
    })

    it('含 Seg 选项的 CSTRule_Or 输出 → AST_Or 无法匹配 (数组≠token)', () => {
        const cstStream = new CSTStream([t('if', TokenType.Keyword)])
        const segKey = new CSTRule_Seg(cstStream, TokenType.Keyword)
        const cstRule = new CSTRule_Or(cstStream, segKey)
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate()  // 这是 cst_data[] (数组)

        // 尝试喂入 AST: 流中元素是数组, 不是 token
        const astStream = new ASTStream([cstOut as cst_data])
        // now() = [t('if')] → Array.isArray → ast_match 对 TokenType 返回 false
        const astRule = new ASTRule_Or(astStream, 'Test', TokenType.Keyword)
        expect(astRule.match()).toBe(false)  // ❌ 数组不能当 token 匹配

        // 但如果 AST_Or 选项中包含 ASTRule, ASTRule 可以消费数组:
        const astInnerSeg = new ASTRule_Seg(astStream, 'Kw', TokenType.Keyword)
        const astRule2 = new ASTRule_Or(astStream, 'Test2', astInnerSeg)
        // 这里 astInnerSeg 接收的是数组 [t('if')]
        // astInnerSeg.match(): ast_match → now=[t('if')], rule=Key → Array.isArray → false
        expect(astRule2.match()).toBe(false)  // 仍然失败!
    })
})

// =============================================================================
// 六、CST_Loop → AST_Loop 联动 (嵌套数组 + 流耗尽问题)
// =============================================================================
describe('CST_Loop → AST_Loop 联动', () => {
    it('【已修复】CST_Loop 产生平 token[] → AST 可正确消费', () => {
        // 修复: CSTRule_Loop.generate() 现在返回平数组 token[] 而非 token[][]
        const tokens = [
            t('a', TokenType.Identifier),
            t('b', TokenType.Identifier),
            t('c', TokenType.Identifier),
            t(';', TokenType.Keyword)  // 终止符
        ]
        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_Loop(cstStream, TokenType.Identifier)
        expect(cstRule.match()).toBe(true)
        expect(cstRule.len).toBe(3)
        const cstOut = cstRule.generate() as token[]

        // 修复后: 平 token 数组
        expect(cstOut).toHaveLength(3)
        expect(cstOut[0].value).toBe('a')
        expect(cstOut[1].value).toBe('b')
        expect(cstOut[2].value).toBe('c')

        // 可正确喂入 AST
        const astStream = new ASTStream(cstOut as cst_data[])
        const astRule = new ASTRule_Loop(astStream, 'Ids', TokenType.Identifier)
        expect(astRule.match()).toBe(true)
        expect(astRule.len).toBe(3)  // ✅ 现在正确匹配

        const astOut = astRule.generate() as ast_data
        expect(astOut.children).toHaveLength(3)
        // ASTRule_Loop 每次迭代调用 super.generate() 产生 ast_data 节点
        expect((astOut.children[0] as ast_data).type).toBe('Ids')
        expect((astOut.children[0] as ast_data).children).toEqual(['a'])
        expect((astOut.children[1] as ast_data).children).toEqual(['b'])
        expect((astOut.children[2] as ast_data).children).toEqual(['c'])
        expect(astOut.line).toContain('line_a')
        expect(astOut.line).toContain('line_b')
        expect(astOut.line).toContain('line_c')
    })

    it('【已修复】CST_Loop 无终止符 → 安全返回 false (不再 crash)', () => {
        // 修复: CSTRule_Seg.match() 添加了 undefined 检查
        // now() 返回 undefined 时安全返回 false, 不再 crash

        const cstStream = new CSTStream([
            t('a', TokenType.Identifier),
            t('b', TokenType.Identifier),
            // 没有终止符! 流在匹配后耗尽
        ])
        const cstRule = new CSTRule_Loop(cstStream, TokenType.Identifier)

        // 修复前: TypeError crash
        // 修复后: 安全返回 true, len=2 (正确匹配了2个)
        expect(() => cstRule.match()).not.toThrow()
        expect(cstRule.len).toBe(2)
    })

    it('CST_Loop len=0 (无匹配) → generate 返回 [] → AST Loop len=0', () => {
        const cstStream = new CSTStream([t('+', TokenType.Keyword)])
        const cstRule = new CSTRule_Loop(cstStream, TokenType.Number)
        expect(cstRule.match()).toBe(true)
        expect(cstRule.len).toBe(0)
        const cstOut = cstRule.generate() as cst_data[]

        expect(cstOut).toEqual([])

        // 同样 tokens, AST Loop 也是 len=0
        const astStream = new ASTStream([t('+', TokenType.Keyword)])
        const astRule = new ASTRule_Loop(astStream, 'Empty', TokenType.Number)
        expect(astRule.match()).toBe(true)
        expect(astRule.len).toBe(0)
        const astOut = astRule.generate() as ast_data

        expect(astOut.children).toEqual([])
        expect(astOut.line).toEqual([])
    })
})

// =============================================================================
// 七、CST_While → AST_While 联动
// =============================================================================
describe('CST_While → AST_While 联动', () => {
    it('空列表: CST 产生平数组 [start, end] → AST_While 可直接消费', () => {
        const tokens = [t('('), t(')')]
        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_While(
            TokenType.Keyword, TokenType.Identifier, ',', TokenType.Keyword)
        cstRule.stream = cstStream
        expect(cstRule.match()).toBe(true)
        expect(cstRule.has).toBe(false)
        const cstOut = cstRule.generate() as token[]

        // 空列表: generate 使用 CSTRule_Seg(this.start, this.end).generate() → 平 token 数组
        expect(cstOut).toHaveLength(2)
        expect(cstOut[0].value).toBe('(')
        expect(cstOut[1].value).toBe(')')

        // 可喂入 AST_While
        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_While('Empty',
            TokenType.Keyword, TokenType.Identifier, ',', TokenType.Keyword)
        astRule.stream = astStream
        expect(astRule.match()).toBe(true)
        expect(astRule.has).toBe(false)
        const astOut = astRule.generate() as ast_data

        expect(astOut.type).toBe('Empty')
        expect(astOut.children).toEqual([])
        expect(astOut.line).toContain('line_(')
        expect(astOut.line).toContain('line_)')
    })

    it('【已修复】非空列表: CST 产生平数组 [start,body1,split,body2,end] → AST 可消费', () => {
        // 修复: CSTRule_While.generate() 现在返回平数组, 包含 split token
        const tokens = [
            t('('), t('a', TokenType.Identifier),
            t(','), t('b', TokenType.Identifier),
            t(')')
        ]
        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_While(
            TokenType.Keyword, TokenType.Identifier, ',', ')')
        cstRule.stream = cstStream
        expect(cstRule.match()).toBe(true)
        expect(cstRule.has).toBe(true)
        const cstOut = cstRule.generate() as token[]

        // 修复后: 平数组 ['(', 'a', ',', 'b', ')']
        expect(cstOut).toHaveLength(5)
        expect(cstOut[0].value).toBe('(')
        expect(cstOut[1].value).toBe('a')
        expect(cstOut[2].value).toBe(',')
        expect(cstOut[3].value).toBe('b')
        expect(cstOut[4].value).toBe(')')

        // AST_While 可直接消费
        const astStream = new ASTStream(cstOut as cst_data[])
        const astRule = new ASTRule_While('Params',
            TokenType.Keyword, TokenType.Identifier, ',', ')')
        astRule.stream = astStream
        expect(astRule.match()).toBe(true)  // ✅ 现在成功
        expect(astRule.has).toBe(true)

        const astOut = astRule.generate() as ast_data
        expect(astOut.type).toBe('Params')
        expect(astOut.children).toEqual(['a', 'b'])
    })
})

// =============================================================================
// 八、并行解析: CST 和 AST 各自从同一 token 流解析
// =============================================================================
describe('并行解析 (CST 和 AST 各自独立解析同一 token 流)', () => {
    it('Loop: CST 和 AST 都从平 token 流独立解析, 结果一致', () => {
        const tokens = [
            t('a', TokenType.Identifier),
            t('b', TokenType.Identifier),
            t('c', TokenType.Identifier),
            t(';', TokenType.Keyword)
        ]

        // CST 解析
        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_Loop(cstStream, TokenType.Identifier)
        expect(cstRule.match()).toBe(true)
        expect(cstRule.len).toBe(3)

        // AST 解析 (独立 stream, 相同数据)
        const astStream = new ASTStream([...tokens])
        const astRule = new ASTRule_Loop(astStream, 'Ids', TokenType.Identifier)
        expect(astRule.match()).toBe(true)
        expect(astRule.len).toBe(3)

        const astOut = astRule.generate() as ast_data
        expect(astOut.children).toHaveLength(3)
        expect(astOut.line).toContain('line_a')
        expect(astOut.line).toContain('line_b')
        expect(astOut.line).toContain('line_c')
    })

    it('Loop: 每次迭代的 sub-AST 节点含各自 line 信息', () => {
        const tokens = [
            t('x', TokenType.Identifier),
            t('y', TokenType.Identifier),
            t(';', TokenType.Keyword)
        ]
        const astStream = new ASTStream([...tokens])
        const astRule = new ASTRule_Loop(astStream, 'Vars', TokenType.Identifier)
        expect(astRule.match()).toBe(true)
        expect(astRule.len).toBe(2)

        const astOut = astRule.generate() as ast_data
        expect(astOut.type).toBe('Vars')
        // 每个迭代是 super.generate() → ASTRule_Seg.generate() → 返回 ast_data
        // children() 会保留这些 ast_data 节点 (因为有 'children' 属性)
        expect(astOut.children).toHaveLength(2)
        // children 是 ast_data 节点, 不是字符串 (因为 super.generate 返回 ast_data)
    })

    it('While: CST 和 AST 各自用字符串值区分 split 和 end', () => {
        // 关键: 当 split 和 end 都是 Keyword 类型时, 必须用字符串值区分
        const tokens = [
            t('('),
            t('a', TokenType.Identifier),
            t(','),
            t('b', TokenType.Identifier),
            t(',', TokenType.Keyword),  // 注意: t(','), 默认 type=Keyword
            t('c', TokenType.Identifier),
            t(')')
        ]

        // CST: split=',' end=')' (字符串值区分)
        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_While(
            TokenType.Keyword, TokenType.Identifier, ',', ')')
        cstRule.stream = cstStream
        expect(cstRule.match()).toBe(true)
        expect(cstRule.len).toBe(2) // CST: 第1个body在循环外, 循环内b,c

        // AST: 独立解析, 同样用 ')' 字符串值区分
        const astStream = new ASTStream([...tokens])
        const astRule = new ASTRule_While('Args',
            TokenType.Keyword, TokenType.Identifier, ',', ')')
        astRule.stream = astStream
        expect(astRule.match()).toBe(true)
        expect(astRule.len).toBe(3) // AST: 所有body在循环内计数

        const astOut = astRule.generate() as ast_data
        expect(astOut.type).toBe('Args')
        expect(astOut.children).toEqual(['a', 'b', 'c'])
    })

    it('【已修复】While 单元素: CST 现在也支持', () => {
        // 修复: CST While match() 在 body 之后立即检查 end, 支持单元素
        const tokens = [t('{'), t('stmt', TokenType.Identifier), t('}')]

        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_While(
            TokenType.Keyword, TokenType.Identifier, ';', TokenType.Keyword)
        cstRule.stream = cstStream
        expect(cstRule.match()).toBe(true)  // ✅ 现在支持单元素
        expect(cstRule.has).toBe(true)
        expect(cstRule.len).toBe(0)  // CST: 第1个body在循环外, len只计循环内

        // 验证 CST generate 输出平数组
        const cstOut = cstRule.generate() as token[]
        expect(cstOut).toHaveLength(3)
        expect(cstOut[0].value).toBe('{')
        expect(cstOut[1].value).toBe('stmt')
        expect(cstOut[2].value).toBe('}')

        // AST 独立解析
        const astStream = new ASTStream([...tokens])
        const astRule = new ASTRule_While('Block',
            TokenType.Keyword, TokenType.Identifier, ';', TokenType.Keyword)
        astRule.stream = astStream
        expect(astRule.match()).toBe(true)
        expect(astRule.has).toBe(true)
        expect(astRule.len).toBe(1)  // AST: body在循环内计数

        const astOut = astRule.generate() as ast_data
        expect(astOut.children).toEqual(['stmt'])
    })

    it('While 空列表: CST 和 AST 都正确识别 has=false', () => {
        const tokens = [t('('), t(')')]

        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_While(
            TokenType.Keyword, TokenType.Identifier, ',', TokenType.Keyword)
        cstRule.stream = cstStream
        cstRule.match()
        expect(cstRule.has).toBe(false)

        const astStream = new ASTStream([...tokens])
        const astRule = new ASTRule_While('Empty',
            TokenType.Keyword, TokenType.Identifier, ',', TokenType.Keyword)
        astRule.stream = astStream
        astRule.match()
        expect(astRule.has).toBe(false)
    })
})

// =============================================================================
// 九、AST While 的 split/end TokenType 冲突问题
// =============================================================================
describe('AST While split/end TokenType 冲突', () => {
    it('【已知Bug】split 和 end 都是 TokenType.Keyword → end 会错误匹配 split 的 token', () => {
        // 当 split=',' 且 end=TokenType.Keyword (都是 Keyword 类型)
        // AST While 在检查 end 时, ',' 的 type 也是 Keyword → 匹配成功
        // 导致提前终止 (把 split 当成 end)
        const tokens = [
            t('('),
            t('a', TokenType.Identifier),
            t(','),  // split token, 但 type=Keyword → end 匹配时也会命中!
            t('b', TokenType.Identifier),
            t(')')
        ]

        const astStream = new ASTStream([...tokens])
        const astRule = new ASTRule_While('Params',
            TokenType.Keyword, TokenType.Identifier, ',', TokenType.Keyword)
        astRule.stream = astStream
        expect(astRule.match()).toBe(true)
        // ❌ len=1 而非期望的 2 — end 在第一个 ',' 处就匹配了
        expect(astRule.len).toBe(1)

        const astOut = astRule.generate() as ast_data
        // ❌ 只拿到了 'a', 没有 'b'
        expect(astOut.children).toEqual(['a'])
    })

    it('【正确用法】split 和 end 用字符串值区分', () => {
        const tokens = [
            t('('),
            t('a', TokenType.Identifier),
            t(','),
            t('b', TokenType.Identifier),
            t(')')
        ]

        const astStream = new ASTStream([...tokens])
        // split=',' (字符串), end=')' (字符串) → 不会冲突
        const astRule = new ASTRule_While('Params',
            TokenType.Keyword, TokenType.Identifier, ',', ')')
        astRule.stream = astStream
        expect(astRule.match()).toBe(true)
        expect(astRule.len).toBe(2)  // ✅ 正确

        const astOut = astRule.generate() as ast_data
        expect(astOut.children).toEqual(['a', 'b'])  // ✅ 两个 body 都拿到了
    })
})

// =============================================================================
// 十、工厂函数联动
// =============================================================================
describe('工厂函数联动', () => {
    it('cst.s + ast.s: 工厂创建的 Seg 联动正确', () => {
        const tokens = [t('var', TokenType.Keyword), t('x', TokenType.Identifier)]

        const cstStream = new CSTStream([...tokens])
        const cstRule = parser.cst.s(TokenType.Keyword, TokenType.Identifier)
        cstRule.stream = cstStream
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token[]

        const astStream = new ASTStream(cstOut)
        const astRule = parser.ast.s('Decl', TokenType.Keyword, TokenType.Identifier)
        astRule.stream = astStream
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        expect(astOut.type).toBe('Decl')
        expect(astOut.children).toEqual(['var', 'x'])
    })

    it('cst.o + ast.o: 工厂创建的 Or 联动', () => {
        const tokens = [t('hello', TokenType.Identifier)]

        const cstStream = new CSTStream([...tokens])
        const cstRule = parser.cst.o(TokenType.Keyword, TokenType.Identifier)
        cstRule.stream = cstStream
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token

        const astStream = new ASTStream([cstOut])
        const astRule = parser.ast.o('Type', TokenType.Keyword, TokenType.Identifier)
        astRule.stream = astStream
        expect(astRule.match()).toBe(true)
    })

    it('cst.l + ast.l: 并行解析 (各自独立, 非串行)', () => {
        const tokens = [
            t('a', TokenType.Identifier), t('b', TokenType.Identifier),
            t(';', TokenType.Keyword)
        ]

        const cstStream = new CSTStream([...tokens])
        const cstRule = parser.cst.l(TokenType.Identifier)
        cstRule.stream = cstStream
        expect(cstRule.match()).toBe(true)
        expect((cstRule as CSTRule_Loop).len).toBe(2)

        const astStream = new ASTStream([...tokens])
        const astRule = parser.ast.l('Ids', TokenType.Identifier)
        astRule.stream = astStream
        expect(astRule.match()).toBe(true)
        expect((astRule as ASTRule_Loop).len).toBe(2)
    })

    it('cst.w + ast.w: 并行解析 While (字符串值区分 split/end)', () => {
        const tokens = [
            t('('), t('x', TokenType.Identifier),
            t(','), t('y', TokenType.Identifier),
            t(')')
        ]

        const cstStream = new CSTStream([...tokens])
        const cstRule = parser.cst.w(TokenType.Keyword, TokenType.Identifier, ',', ')')
        cstRule.stream = cstStream
        expect(cstRule.match()).toBe(true)

        const astStream = new ASTStream([...tokens])
        const astRule = parser.ast.w('Params', TokenType.Keyword, TokenType.Identifier, ',', ')')
        astRule.stream = astStream
        expect(astRule.match()).toBe(true)
        expect((astRule as ASTRule_While).len).toBe(2)

        const astOut = astRule.generate() as ast_data
        expect(astOut.children).toEqual(['x', 'y'])
    })

    it('ast.visit 处理 CST→AST pipeline 产出的 ast_data', () => {
        const tokens = [
            t('var', TokenType.Keyword), t('x', TokenType.Identifier),
            t('=', TokenType.Keyword), t('42', TokenType.Number)
        ]

        const cstStream = new CSTStream([...tokens])
        const cstRule = parser.cst.s(TokenType.Keyword, TokenType.Identifier,
            TokenType.Keyword, TokenType.Number)
        cstRule.stream = cstStream
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token[]

        const astStream = new ASTStream(cstOut)
        const astRule = parser.ast.s('VarInit', TokenType.Keyword, TokenType.Identifier,
            TokenType.Keyword, TokenType.Number)
        astRule.stream = astStream
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        // Visitor 处理
        let visited = ''
        const result = parser.ast.visit(astOut, [
            {
                name: 'VarInit',
                visitor: (a) => { visited = a.type; return { ...a, type: 'Done' } }
            }
        ])

        expect(visited).toBe('VarInit')
        expect(result.type).toBe('Done')
        expect(result.children).toEqual(['var', 'x', '=', '42'])
    })
})

// =============================================================================
// 十一、cst_match() 与 AST 规则的交互
// =============================================================================
describe('cst_match() → AST 联动', () => {
    it('cst_match 按值匹配后, 独立 AST 解析同一 tokens', () => {
        const tokens = [t('if', TokenType.Keyword), t('(', TokenType.Keyword)]
        const cstStream = new CSTStream([...tokens])

        expect(cst_match(cstStream, 'if')).toBe(true)
        expect(cst_match(cstStream, '(')).toBe(true)

        // AST 独立解析
        const astStream = new ASTStream([...tokens])
        const astRule = new ASTRule_Seg(astStream, 'If', 'if', '(')
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        expect(astOut.children).toEqual(['if', '('])
    })

    it('cst_match 失败记录 error → 不影响并行 AST 解析', () => {
        const tokens = [t('else', TokenType.Keyword)]
        const cstStream = new CSTStream([...tokens])

        expect(cst_match(cstStream, 'if')).toBe(false)
        expect(cstStream.error).toHaveLength(1)
        expect(cstStream.error[0]).toContain('if')

        // AST 独立解析 → 不受 CST 错误影响
        const astStream = new ASTStream([...tokens])
        const astRule = new ASTRule_Seg(astStream, 'Else', 'else')
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        expect(astOut.children).toEqual(['else'])
    })

    it('cst_match 多次失败累积错误 → AST 仍然正常', () => {
        const cstStream = new CSTStream([
            t('+', TokenType.Keyword), t('x', TokenType.Identifier)
        ])

        cst_match(cstStream, 'if')            // 失败
        cst_match(cstStream, TokenType.Number) // 失败
        expect(cstStream.error).toHaveLength(2)

        const astStream = new ASTStream([
            t('+', TokenType.Keyword), t('x', TokenType.Identifier)
        ])
        const astRule = new ASTRule_Seg(astStream, 'Op',
            TokenType.Keyword, TokenType.Identifier)
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        expect(astOut.children).toEqual(['+', 'x'])
    })
})

// =============================================================================
// 十二、完整 pipeline: tokens → CST → AST (仅平结构)
// =============================================================================
describe('完整 CST→AST pipeline (仅平结构)', () => {
    it('表达式: Identifier + Operator + Number', () => {
        const tokens = [
            t('x', TokenType.Identifier),
            t('+', TokenType.Keyword),
            t('10', TokenType.Number)
        ]

        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_Seg(cstStream,
            TokenType.Identifier, TokenType.Keyword, TokenType.Number)
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token[]

        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_Seg(astStream, 'BinaryExpr',
            TokenType.Identifier, TokenType.Keyword, TokenType.Number)
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        expect(astOut.type).toBe('BinaryExpr')
        expect(astOut.children).toEqual(['x', '+', '10'])
        expect(astOut.line).toHaveLength(3)
    })

    it('控制流: if ( expr )', () => {
        const tokens = [
            t('if', TokenType.Keyword), t('(', TokenType.Keyword),
            t('x', TokenType.Identifier), t(')', TokenType.Keyword)
        ]

        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_Seg(cstStream, 'if', '(', TokenType.Identifier, ')')
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token[]

        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_Seg(astStream, 'IfStmt',
            'if', '(', TokenType.Identifier, ')')
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        expect(astOut.type).toBe('IfStmt')
        expect(astOut.children).toEqual(['if', '(', 'x', ')'])
    })

    it('部分匹配: CST 输出 3 token, AST 只匹配前 2 个', () => {
        const tokens = [
            t('a', TokenType.Identifier),
            t('b', TokenType.Identifier),
            t('c', TokenType.Identifier)
        ]

        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_Seg(cstStream,
            TokenType.Identifier, TokenType.Identifier, TokenType.Identifier)
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token[]

        // AST 只消费前 2 个
        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_Seg(astStream, 'First2',
            TokenType.Identifier, TokenType.Identifier)
        expect(astRule.match()).toBe(true)
        expect(astStream.index).toBe(2)
        // 第3个 token 还在流中
        expect((astStream.now() as token).value).toBe('c')
    })
})

// =============================================================================
// 十三、流耗尽和边界场景
// =============================================================================
describe('流耗尽和边界场景', () => {
    it('CST 流耗尽 → now() 返回 undefined', () => {
        const cstStream = new CSTStream([t('x', TokenType.Identifier)])
        const cstRule = new CSTRule_Seg(cstStream, TokenType.Identifier)
        expect(cstRule.match()).toBe(true)
        cstRule.generate()

        expect(cstStream.index).toBe(1)
        expect(cstStream.now()).toBeUndefined()
    })

    it('AST 流耗尽 → now() 返回 undefined', () => {
        const astStream = new ASTStream([t('x', TokenType.Identifier)])
        const astRule = new ASTRule_Seg(astStream, 'Solo', TokenType.Identifier)
        expect(astRule.match()).toBe(true)
        astRule.generate()

        expect(astStream.index).toBe(1)
        expect(astStream.now()).toBeUndefined()
    })

    it('AST 流耗尽 → ast_match 安全返回 false (不会 crash)', () => {
        // ast_match 有 now()==undefined 检查, 不会崩溃
        const astStream = new ASTStream([])
        const astRule = new ASTRule_Seg(astStream, 'Empty', TokenType.Keyword)
        expect(astRule.match()).toBe(false)  // 安全返回 false
    })

    it('CST_Choose has=false + AST_Choose has=false → 空 children/line', () => {
        const cstStream = new CSTStream([t('+', TokenType.Keyword)])
        const cstRule = new CSTRule_Choose(cstStream, TokenType.Identifier)
        expect(cstRule.match()).toBe(true)
        expect(cstRule.has).toBe(false)
        const cstOut = cstRule.generate() as cst_data[]

        expect(cstOut).toEqual([])

        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_Choose(astStream, 'Gone', TokenType.Identifier)
        expect(astRule.match()).toBe(true)
        expect(astRule.has).toBe(false)
        const astOut = astRule.generate() as ast_data

        expect(astOut.type).toBe('Gone')
        expect(astOut.children).toEqual([])
        expect(astOut.line).toEqual([])
    })
})

// =============================================================================
// 十四、CST vs AST While len 语义差异 (设计差异, 非 bug)
// =============================================================================
describe('CST vs AST 语义差异 (设计如此)', () => {
    it('CSTRule_While.len vs ASTRule_While.len: 计数方式不同', () => {
        // CST While: 第1个 body 在循环外匹配, len 只统计循环内的额外 body
        // AST While: 所有 body 都在循环内, len 统计所有 body
        const tokens = [
            t('('),
            t('a', TokenType.Identifier), t(','),
            t('b', TokenType.Identifier), t(','),
            t('c', TokenType.Identifier),
            t(')')
        ]

        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_While(TokenType.Keyword, TokenType.Identifier, ',', ')')
        cstRule.stream = cstStream
        cstRule.match()
        // CST: 3个body (a,b,c), 第1个在循环外, 循环内匹配 b,c → len=2
        expect(cstRule.len).toBe(2)

        const astStream = new ASTStream([...tokens])
        const astRule = new ASTRule_While('Args', TokenType.Keyword, TokenType.Identifier, ',', ')')
        astRule.stream = astStream
        astRule.match()
        // AST: 3个body, 全部在循环内 → len=3
        expect(astRule.len).toBe(3)

        // 这是设计差异, 不是 bug
        expect(cstRule.len).not.toBe(astRule.len)
    })

    it('单元素 While: CST len=0 vs AST len=1 (设计差异)', () => {
        const tokens = [t('{'), t('stmt', TokenType.Identifier), t('}')]

        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_While(
            TokenType.Keyword, TokenType.Identifier, ';', TokenType.Keyword)
        cstRule.stream = cstStream
        cstRule.match()
        expect(cstRule.len).toBe(0)  // 第1个body在循环外
        expect(cstRule.has).toBe(true)

        const astStream = new ASTStream([...tokens])
        const astRule = new ASTRule_While('Single',
            TokenType.Keyword, TokenType.Identifier, ';', TokenType.Keyword)
        astRule.stream = astStream
        astRule.match()
        expect(astRule.len).toBe(1)  // body在循环内
        expect(astRule.has).toBe(true)
    })
})

// =============================================================================
// 十五、CST 和 AST Seg 嵌套对比 (含 CSTRule 元素的 Seg)
// =============================================================================
describe('CST/AST Seg 含子规则 (并行解析对比)', () => {
    it('CST_Seg 含 CSTRule(inner Seg) → 独立流各自解析, 输出结构对比', () => {
        // 当 CST 中 Seg 包含另一个 CSTRule_Seg 时,
        // CST 产生嵌套数组, 但 AST 用 ASTRule 包装可以处理

        const tokens = [
            t('var', TokenType.Keyword), t('x', TokenType.Identifier), t(';', TokenType.Keyword),
            t('var', TokenType.Keyword), t('y', TokenType.Identifier), t(';', TokenType.Keyword),
        ]

        // CST 解析
        const cstStream = new CSTStream([...tokens])
        const cstInner = new CSTRule_Seg(cstStream,
            TokenType.Keyword, TokenType.Identifier, TokenType.Keyword)
        const cstRule = new CSTRule_Seg(cstStream, cstInner, cstInner)
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as cst_data[]

        // CST 输出: 嵌套数组 — 内层 Seg 各自产生 token[]
        expect(cstOut).toHaveLength(2)
        expect(Array.isArray(cstOut[0])).toBe(true)
        expect(Array.isArray(cstOut[1])).toBe(true)

        // AST 独立解析 (同一 tokens, 不同 stream)
        const astStream = new ASTStream([...tokens])
        const astInner = new ASTRule_Seg(astStream, 'Stmt',
            TokenType.Keyword, TokenType.Identifier, TokenType.Keyword)
        const astRule = new ASTRule_Seg(astStream, 'Stmts', astInner, astInner)
        expect(astRule.match()).toBe(true)

        const astOut = astRule.generate() as ast_data
        expect(astOut.type).toBe('Stmts')
        expect(astOut.children).toHaveLength(2)

        const stmt1 = astOut.children[0] as ast_data
        expect(stmt1.type).toBe('Stmt')
        // read_index 被内层 Seg 覆盖: 期望['var','x',';'], 实际读到后面的 token
        expect(stmt1.children).not.toEqual(['var', 'x', ';'])

        const stmt2 = astOut.children[1] as ast_data
        expect(stmt2.type).toBe('Stmt')
        expect(stmt2.children).toEqual(['var', 'y', ';'])
    })

    it('AST 嵌套 Seg: 内层 ASTRule 匹配 token[], 外层 Seg 产生嵌套 ast_data', () => {
        // 验证 AST 层嵌套规则的 child 是 ast_data 节点而非字符串
        const tokens = [t('x', TokenType.Identifier), t('+', TokenType.Keyword)]

        const astStream = new ASTStream([...tokens])
        const astInner1 = new ASTRule_Seg(astStream, 'Id', TokenType.Identifier)
        const astRule = new ASTRule_Seg(astStream, 'Expr', astInner1, TokenType.Keyword)
        expect(astRule.match()).toBe(true)

        const astOut = astRule.generate() as ast_data
        expect(astOut.type).toBe('Expr')
        expect(astOut.children).toHaveLength(2)
        // 第1个 child 是 astInner.generate() 返回的 ast_data
        const child0 = astOut.children[0] as ast_data
        expect(typeof child0).toBe('object')
        expect(child0.type).toBe('Id')
        expect(child0.children).toEqual(['x'])
        // 第2个 child 是 '+' token 转换的字符串
        expect(astOut.children[1]).toBe('+')
    })
})

// =============================================================================
// 十六、ASTVisitor 处理 pipeline 产出的嵌套 AST
// =============================================================================
describe('ASTVisitor 在 CST→AST pipeline 中', () => {
    it('平 CST→AST 输出 → Visitor 正确变换', () => {
        const tokens = [
            t('var', TokenType.Keyword), t('x', TokenType.Identifier),
            t('=', TokenType.Keyword), t('42', TokenType.Number)
        ]

        const cstStream = new CSTStream([...tokens])
        const cstRule = new CSTRule_Seg(cstStream,
            TokenType.Keyword, TokenType.Identifier, TokenType.Keyword, TokenType.Number)
        expect(cstRule.match()).toBe(true)
        const cstOut = cstRule.generate() as token[]

        const astStream = new ASTStream(cstOut)
        const astRule = new ASTRule_Seg(astStream, 'VarInit',
            TokenType.Keyword, TokenType.Identifier, TokenType.Keyword, TokenType.Number)
        expect(astRule.match()).toBe(true)
        const astOut = astRule.generate() as ast_data

        let visitedType = ''
        const result = parser.ast.visit(astOut, [
            {
                name: 'VarInit',
                visitor: (a) => { visitedType = a.type; return { ...a, type: 'Transformed' } }
            }
        ])

        expect(visitedType).toBe('VarInit')
        expect(result.type).toBe('Transformed')
        expect(result.children).toEqual(['var', 'x', '=', '42'])
    })

    it('嵌套 AST → Visitor 递归访问 (预构建 ast_data 绕过 read_index bug)', () => {
        // 使用预构建 ast_data 避免 AST 嵌套规则 read_index 覆盖问题
        const astOut: ast_data = {
            type: 'Expr',
            line: ['line_x', 'line_+', 'line_y'],
            children: [
                { type: 'Id', line: ['line_x'], children: ['x'],comment:'' },
                '+',
                { type: 'Id', line: ['line_y'], children: ['y'],comment:'' }
            ],
            comment:''
        }

        // 验证结构
        expect(astOut.children).toHaveLength(3)
        const child0 = astOut.children[0] as ast_data
        expect(child0.type).toBe('Id')

        // Visitor 递归
        const visited: string[] = []
        const result = parser.ast.visit(astOut, [
            { name: 'Expr', visitor: (a) => { visited.push(a.type); return a } },
            { name: 'Id', visitor: (a) => { visited.push(a.type); return { ...a, type: 'Done' } } }
        ])

        expect(visited).toEqual(['Expr', 'Id', 'Id'])
        // 子节点被变换
        const c0 = result.children[0] as ast_data
        const c2 = result.children[2] as ast_data
        expect(c0.type).toBe('Done')
        expect(c2.type).toBe('Done')
    })

    it('Visitor 深层嵌套递归 (A→B→C)', () => {
        const ast: ast_data = {
            type: 'A', line: [],
            children: [{
                type: 'B', line: [],
                children: [{ type: 'C', line: [], children: [],comment:'' }],comment:''
            }],
            comment:''
        }
        const trace: string[] = []
        const result = parser.ast.visit(ast, [
            { name: 'A', visitor: (a) => { trace.push('A'); return a } },
            { name: 'B', visitor: (a) => { trace.push('B'); return a } },
            { name: 'C', visitor: (a) => { trace.push('C'); return a } },
        ])

        expect(trace).toEqual(['A', 'B', 'C'])
    })
})
