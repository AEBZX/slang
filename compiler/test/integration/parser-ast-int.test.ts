import { describe, it, expect } from 'vitest'
import { CSTStream } from '../../utils/lib/parser'
import { Parser, TokenType, ASTStream } from '../../utils'
import { token } from '../../utils/data'
import ASTParser from '../../parser/ast'
import cst_Type from '../../parser/cst/identifier'
import cst_Expr from '../../parser/cst/expr'
import cst_Command from '../../parser/cst/command'
import cst_Block, { link as cst_link } from '../../parser/cst/block'

function t(value: string, type: TokenType = TokenType.Keyword): token {
    return { type, value, line: `L:${value}` }
}
function id(value: string): token {
    return { type: TokenType.Identifier, value, line: `L:${value}` }
}
function num(value: string): token {
    return { type: TokenType.Number, value, line: `L:${value}` }
}
function str(value: string): token {
    return { type: TokenType.String, value, line: `L:${value}` }
}

// CST → AST 辅助
function cst_parse(rule: any, tokens: token[]) {
    const s = new CSTStream([...tokens])
    rule.stream = s
    rule.match()
    return rule.generate()
}

function ast_parse(rule: any, tokens: token[]) {
    const cst = cst_parse(rule, tokens)
    const s = new ASTStream(Array.isArray(cst) ? cst : [cst])
    return ASTParser(s)
}

// ==================== 类型解析 AST ====================
describe('类型 AST (identifier)', () => {
    it('number → NumberType', () => {
        const result = ast_parse(cst_Type, [t('number')])
        expect(result.type).toBe('File')
    })
    it('string → StringType', () => {
        const result = ast_parse(cst_Type, [t('string')])
        expect(result.type).toBe('File')
    })
    it('number[]', () => {
        const result = ast_parse(cst_Type, [t('number'), t('['), t(']')])
        expect(result.type).toBe('File')
    })
    it('function type: (a: number) => string', () => {
        const result = ast_parse(cst_Type, [
            t('('), id('a'), t(':'), t('number'), t(')'),
            t('=>'), t('string')
        ])
        expect(result.type).toBe('File')
    })
})

// ==================== 表达式 AST ====================
describe('表达式 AST (expr)', () => {
    it('数字字面量 → NumberLiteral', () => {
        const result = ast_parse(cst_Expr, [num('42')])
        expect(result.type).toBe('File')
    })
    it('字符串字面量', () => {
        const result = ast_parse(cst_Expr, [str('"hello"')])
        expect(result.type).toBe('File')
    })
    it('标识符', () => {
        const result = ast_parse(cst_Expr, [id('x')])
        expect(result.type).toBe('File')
    })
    it('true / false / null', () => {
        expect(ast_parse(cst_Expr, [t('true')]).type).toBe('File')
        expect(ast_parse(cst_Expr, [t('false')]).type).toBe('File')
        expect(ast_parse(cst_Expr, [t('null')]).type).toBe('File')
    })
    it('括号表达式: (x)', () => {
        const result = ast_parse(cst_Expr, [t('('), id('x'), t(')')])
        expect(result.type).toBe('File')
    })
    it('加法: a + b', () => {
        const result = ast_parse(cst_Expr, [id('a'), t('+'), id('b')])
        expect(result.type).toBe('File')
    })
    it('减法: a - b', () => {
        const result = ast_parse(cst_Expr, [id('a'), t('-'), id('b')])
        expect(result.type).toBe('File')
    })
    it('乘法优先级: a + b * c', () => {
        const result = ast_parse(cst_Expr, [id('a'), t('+'), id('b'), t('*'), id('c')])
        expect(result.type).toBe('File')
    })
    it('三元运算: a ? b : c', () => {
        const result = ast_parse(cst_Expr, [id('a'), t('?'), num('1'), t(':'), num('2')])
        expect(result.type).toBe('File')
    })
    it('前缀: -x 和 !x', () => {
        expect(ast_parse(cst_Expr, [t('-'), id('x')]).type).toBe('File')
        expect(ast_parse(cst_Expr, [t('!'), id('x')]).type).toBe('File')
    })
    it('后缀: x++ 和 x--', () => {
        expect(ast_parse(cst_Expr, [id('x'), t('++')]).type).toBe('File')
        expect(ast_parse(cst_Expr, [id('x'), t('--')]).type).toBe('File')
    })
    it('成员访问: a.b', () => {
        const result = ast_parse(cst_Expr, [id('a'), t('.'), id('b')])
        expect(result.type).toBe('File')
    })
    it('函数调用: f(x)', () => {
        const result = ast_parse(cst_Expr, [id('f'), t('('), id('x'), t(')')])
        expect(result.type).toBe('File')
    })
    it('对象字面量: {a: 1}', () => {
        const result = ast_parse(cst_Expr, [t('{'), id('a'), t(':'), num('1'), t('}')])
        expect(result.type).toBe('File')
    })
    it('数组字面量: [1, 2]', () => {
        const result = ast_parse(cst_Expr, [t('['), num('1'), t(','), num('2'), t(']')])
        expect(result.type).toBe('File')
    })
    it('比较: a < b > c', () => {
        const result = ast_parse(cst_Expr, [id('a'), t('<'), id('b'), t('>'), id('c')])
        expect(result.type).toBe('File')
    })
    it('空数组: []', () => {
        const result = ast_parse(cst_Expr, [t('['), t(']')])
        expect(result.type).toBe('File')
    })
    it('空对象: {}', () => {
        const result = ast_parse(cst_Expr, [t('{'), t('}')])
        expect(result.type).toBe('File')
    })
})

// ==================== 命令 AST ====================
describe('命令 AST (command)', () => {
    it('var 声明: var x: number;', () => {
        const result = ast_parse(cst_Command, [t('var'), id('x'), t(':'), t('number'), t(';')])
        expect(result.type).toBe('File')
    })
    it('return 语句: return x;', () => {
        const result = ast_parse(cst_Command, [t('return'), id('x'), t(';')])
        expect(result.type).toBe('File')
    })
    it('return; (空 return)', () => {
        const result = ast_parse(cst_Command, [t('return'), t(';')])
        expect(result.type).toBe('File')
    })
    it('赋值: x = 1;', () => {
        const result = ast_parse(cst_Command, [id('x'), t('='), num('1'), t(';')])
        expect(result.type).toBe('File')
    })
    it('break 和 continue', () => {
        expect(ast_parse(cst_Command, [t('break'), t(';')]).type).toBe('File')
        expect(ast_parse(cst_Command, [t('continue'), t(';')]).type).toBe('File')
    })
    it('vm "code";', () => {
        const result = ast_parse(cst_Command, [t('vm'), str('"code"'), t(';')])
        expect(result.type).toBe('File')
    })
    it('throw "err";', () => {
        const result = ast_parse(cst_Command, [t('throw'), str('"err"'), t(';')])
        expect(result.type).toBe('File')
    })
    it('{} 空块', () => {
        const result = ast_parse(cst_Command, [t('{'), t('}')])
        expect(result.type).toBe('File')
    })
    it('if 语句: if (x) { }', () => {
        const result = ast_parse(cst_Command, [
            t('if'), t('('), id('x'), t(')'), t('{'), t('}')
        ])
        expect(result.type).toBe('File')
    })
    it('if-else: if (x) { } else { }', () => {
        const result = ast_parse(cst_Command, [
            t('if'), t('('), id('x'), t(')'), t('{'), t('}'),
            t('else'), t('{'), t('}')
        ])
        expect(result.type).toBe('File')
    })
    it('while 循环', () => {
        const result = ast_parse(cst_Command, [
            t('while'), t('('), id('x'), t(')'), t('{'), t('}')
        ])
        expect(result.type).toBe('File')
    })
    it('do-while 循环', () => {
        const result = ast_parse(cst_Command, [
            t('do'), t('{'), t('}'), t('while'), t('('), t('true'), t(')')
        ])
        expect(result.type).toBe('File')
    })
    it('for (;;) { }', () => {
        const result = ast_parse(cst_Command, [
            t('for'), t('('), t(';'), t(';'), t(')'), t('{'), t('}')
        ])
        expect(result.type).toBe('File')
    })
    it('for-in: for (x: arr) { }', () => {
        const result = ast_parse(cst_Command, [
            t('for'), t('('), id('x'), t(':'), id('arr'), t(')'), t('{'), t('}')
        ])
        expect(result.type).toBe('File')
    })
    it('多个语句: { x = 1; y = 2; }', () => {
        const result = ast_parse(cst_Command, [
            t('{'),
            id('x'), t('='), num('1'), t(';'),
            id('y'), t('='), num('2'), t(';'),
            t('}')
        ])
        expect(result.type).toBe('File')
    })
    it('try-catch: try { } catch (e: string) { }', () => {
        const result = ast_parse(cst_Command, [
            t('try'), t('{'), t('}'),
            t('catch'), t('('), id('e'), t(':'), t('string'), t(')'), t('{'), t('}')
        ])
        expect(result.type).toBe('File')
    })
    it('try-finally: try { } finally { }', () => {
        const result = ast_parse(cst_Command, [
            t('try'), t('{'), t('}'),
            t('finally'), t('{'), t('}')
        ])
        expect(result.type).toBe('File')
    })
    it('switch-case: switch (x) { case 1 => { } }', () => {
        const result = ast_parse(cst_Command, [
            t('switch'), t('('), id('x'), t(')'),
            t('{'),
            t('case'), num('1'), t('=>'), t('{'), t('}'),
            t('}')
        ])
        expect(result.type).toBe('File')
    })
})

// ==================== Block AST ====================
describe('Block AST (block)', () => {
    it('function 声明 (含修饰符和名字)', () => {
        const result = ast_parse(cst_Block, [
            t('public'), id('myFunc'), t('function'), t('('), id('a'), t(':'), t('number'), t(')'),
            t(':'), t('void'), t('{'), t('}')
        ])
        expect(result.type).toBe('File')
    })
    it('var 声明 (含修饰符和名字)', () => {
        const result = ast_parse(cst_Block, [
            t('static'), id('x'), t('var'), t('number'), t(';')
        ])
        expect(result.type).toBe('File')
    })
    it('class 声明 (含修饰符和名字)', () => {
        const result = ast_parse(cst_Block, [
            t('public'), id('MyClass'), t('class'), t('{'), t('}')
        ])
        expect(result.type).toBe('File')
    })
    it('link 声明', () => {
        const result = ast_parse(cst_link, [
            t('link'), t('('), id('a'), t('.'), id('b'), t(')'), t('as'), id('c')
        ])
        expect(result.type).toBe('File')
    })
})

// ==================== 边界情况 ====================
describe('边界情况', () => {
    it('嵌套表达式: (a + b) * c', () => {
        const result = ast_parse(cst_Expr, [
            t('('), id('a'), t('+'), id('b'), t(')'), t('*'), id('c')
        ])
        expect(result.type).toBe('File')
    })
    it('类型解析不应崩溃: number*', () => {
        const result = ast_parse(cst_Type, [t('number'), t('*')])
        expect(result.type).toBe('File')
    })
    it('深层嵌套: while (i < 10) { i = i + 1; }', () => {
        const result = ast_parse(cst_Command, [
            t('while'), t('('), id('i'), t('<'), num('10'), t(')'),
            t('{'),
            id('i'), t('='), id('i'), t('+'), num('1'), t(';'),
            t('}')
        ])
        expect(result.type).toBe('File')
    })
})
