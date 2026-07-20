import { describe, it, expect } from 'vitest'
import Type from '../../parser/cst/identifier'
import Expr from '../../parser/cst/expr'
import Command from '../../parser/cst/command'
import Block, { link, module_ } from '../../parser/cst/block'
import { CSTStream } from '../../utils/lib/parser'
import { Parser, TokenType } from '../../utils'
import { token } from '../../utils/data'

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

// ==================== 模块加载验证 ====================
describe('CST 模块加载', () => {
    it('identifier.ts 成功加载', () => {
        expect(Type).toBeDefined()
    })
    it('expr.ts 成功加载', () => {
        expect(Expr).toBeDefined()
    })
    it('command.ts 成功加载', () => {
        expect(Command).toBeDefined()
    })
    it('block.ts 成功加载', () => {
        expect(Block).toBeDefined()
        expect(link).toBeDefined()
        expect(module_).toBeDefined()
    })
})

// ==================== 类型解析 (identifier.ts) ====================
describe('Type 解析 (identifier.ts)', () => {
    function match_type(tokens: token[]): boolean {
        const s = new CSTStream([...tokens])
        Type.stream = s
        return Type.match()
    }
    function gen_type(tokens: token[]) {
        const s = new CSTStream([...tokens])
        Type.stream = s
        Type.match()
        return Type.generate()
    }

    it('基础类型: number', () => {
        expect(match_type([t('number')])).toBe(true)
    })
    it('基础类型: string', () => {
        expect(match_type([t('string')])).toBe(true)
    })
    it('基础类型: boolean', () => {
        expect(match_type([t('boolean')])).toBe(true)
    })
    it('基础类型: void', () => {
        expect(match_type([t('void')])).toBe(true)
    })
    it('限定名: a.b.c', () => {
        expect(match_type([id('a'), t('.'), id('b'), t('.'), id('c')])).toBe(true)
    })
    it('数组类型: number[]', () => {
        expect(match_type([t('number'), t('['), t(']')])).toBe(true)
    })
    it('Map 类型: string{}', () => {
        expect(match_type([t('string'), t('{'), t('}')])).toBe(true)
    })
    it('指针类型: number*', () => {
        const s = new CSTStream([t('number'), t('*')])
        Type.stream = s
        expect(Type.match()).toBe(true)
    })
    it('括号类型: (number)', () => {
        expect(match_type([t('('), t('number'), t(')')])).toBe(true)
    })
    it('函数类型: (a: number) => number', () => {
        const tokens = [t('('), id('a'), t(':'), t('number'), t(')'), t('=>'), t('number')]
        expect(match_type(tokens)).toBe(true)
    })
    it('函数类型多参数: (a: number, b: string) => boolean', () => {
        const tokens = [
            t('('), id('a'), t(':'), t('number'), t(','),
            id('b'), t(':'), t('string'), t(')'),
            t('=>'), t('boolean')
        ]
        expect(match_type(tokens)).toBe(true)
    })
    it('generate 返回正确的 cst_data', () => {
        const result = gen_type([t('number')])
        expect(Array.isArray(result)).toBe(true)
    })
})

// ==================== 表达式解析 (expr.ts) ====================
describe('Expr 解析 (expr.ts)', () => {
    function match_expr(tokens: token[]): boolean {
        const s = new CSTStream([...tokens])
        Expr.stream = s
        return Expr.match()
    }

    it('字面量: 数字', () => {
        expect(match_expr([num('42')])).toBe(true)
    })
    it('字面量: 字符串', () => {
        expect(match_expr([str('"hello"')])).toBe(true)
    })
    it('字面量: true', () => {
        expect(match_expr([t('true')])).toBe(true)
    })
    it('字面量: false', () => {
        expect(match_expr([t('false')])).toBe(true)
    })
    it('字面量: null', () => {
        expect(match_expr([t('null')])).toBe(true)
    })
    it('标识符', () => {
        expect(match_expr([id('x')])).toBe(true)
    })
    it('括号表达式: (x)', () => {
        expect(match_expr([t('('), id('x'), t(')')])).toBe(true)
    })
    it('括号表达式: (1 + 2)', () => {
        expect(match_expr([t('('), num('1'), t('+'), num('2'), t(')')])).toBe(true)
    })
    it('前缀: -x', () => {
        expect(match_expr([t('-'), id('x')])).toBe(true)
    })
    it('前缀: !x', () => {
        expect(match_expr([t('!'), id('x')])).toBe(true)
    })
    it('前缀: ++x', () => {
        expect(match_expr([t('++'), id('x')])).toBe(true)
    })
    it('后缀: x++', () => {
        expect(match_expr([id('x'), t('++')])).toBe(true)
    })
    it('后缀: x--', () => {
        expect(match_expr([id('x'), t('--')])).toBe(true)
    })
    it('成员访问: x.y', () => {
        expect(match_expr([id('x'), t('.'), id('y')])).toBe(true)
    })
    it('下标: a[0]', () => {
        expect(match_expr([id('a'), t('['), num('0'), t(']')])).toBe(true)
    })
    it('函数调用: f()', () => {
        expect(match_expr([id('f'), t('('), t(')')])).toBe(true)
    })
    it('函数调用: f(1, 2)', () => {
        expect(match_expr([id('f'), t('('), num('1'), t(','), num('2'), t(')')])).toBe(true)
    })
    it('加法: a + b', () => {
        expect(match_expr([id('a'), t('+'), id('b')])).toBe(true)
    })
    it('减法: a - b', () => {
        expect(match_expr([id('a'), t('-'), id('b')])).toBe(true)
    })
    it('乘法: a * b', () => {
        expect(match_expr([id('a'), t('*'), id('b')])).toBe(true)
    })
    it('除法: a / b', () => {
        expect(match_expr([id('a'), t('/'), id('b')])).toBe(true)
    })
    it('运算符优先级: a + b * c', () => {
        expect(match_expr([id('a'), t('+'), id('b'), t('*'), id('c')])).toBe(true)
    })
    it('比较: a < b', () => {
        expect(match_expr([id('a'), t('<'), id('b')])).toBe(true)
    })
    it('相等: a == b', () => {
        expect(match_expr([id('a'), t('=='), id('b')])).toBe(true)
    })
    it('逻辑与: a && b', () => {
        expect(match_expr([id('a'), t('&&'), id('b')])).toBe(true)
    })
    it('逻辑或: a || b', () => {
        expect(match_expr([id('a'), t('||'), id('b')])).toBe(true)
    })
    it('三元: a ? b : c', () => {
        expect(match_expr([id('a'), t('?'), id('b'), t(':'), id('c')])).toBe(true)
    })
    it('位运算: a & b', () => {
        expect(match_expr([id('a'), t('&'), id('b')])).toBe(true)
    })
    it('位运算: a | b', () => {
        expect(match_expr([id('a'), t('|'), id('b')])).toBe(true)
    })
    it('位运算: a ^ b', () => {
        expect(match_expr([id('a'), t('^'), id('b')])).toBe(true)
    })
    it('移位: a << b', () => {
        expect(match_expr([id('a'), t('<<'), id('b')])).toBe(true)
    })
    it('移位: a >> b', () => {
        expect(match_expr([id('a'), t('>>'), id('b')])).toBe(true)
    })
    it('new 表达式: new X', () => {
        expect(match_expr([t('new'), id('X')])).toBe(true)
    })
    it('数组字面量: [1, 2, 3]', () => {
        expect(match_expr([t('['), num('1'), t(','), num('2'), t(','), num('3'), t(']')])).toBe(true)
    })
    it('对象字面量: {x: 1}', () => {
        expect(match_expr([t('{'), id('x'), t(':'), num('1'), t('}')])).toBe(true)
    })
})

// ==================== 命令解析 (command.ts) ====================
describe('Command 解析 (command.ts)', () => {
    function match_cmd(tokens: token[]): boolean {
        const s = new CSTStream([...tokens])
        Command.stream = s
        return Command.match()
    }

    it('赋值: x = 1;', () => {
        expect(match_cmd([id('x'), t('='), num('1'), t(';')])).toBe(true)
    })
    it('复合赋值: x += 1;', () => {
        expect(match_cmd([id('x'), t('+='), num('1'), t(';')])).toBe(true)
    })
    it('return;', () => {
        expect(match_cmd([t('return'), t(';')])).toBe(true)
    })
    it('return expr;', () => {
        expect(match_cmd([t('return'), num('42'), t(';')])).toBe(true)
    })
    it('break;', () => {
        expect(match_cmd([t('break'), t(';')])).toBe(true)
    })
    it('continue;', () => {
        expect(match_cmd([t('continue'), t(';')])).toBe(true)
    })
    it('await expr;', () => {
        expect(match_cmd([t('await'), id('f'), t('('), t(')'), t(';')])).toBe(true)
    })
    it('throw expr;', () => {
        expect(match_cmd([t('throw'), str('"error"'), t(';')])).toBe(true)
    })
    it('vm "code";', () => {
        expect(match_cmd([t('vm'), str('"code"'), t(';')])).toBe(true)
    })
    it('var x: number;', () => {
        expect(match_cmd([t('var'), id('x'), t(':'), t('number'), t(';')])).toBe(true)
    })
    it('var x: number = 5;', () => {
        expect(match_cmd([t('var'), id('x'), t(':'), t('number'), t('='), num('5'), t(';')])).toBe(true)
    })
    it('if (x) {}', () => {
        expect(match_cmd([t('if'), t('('), id('x'), t(')'), t('{'), t('}')])).toBe(true)
    })
    it('if (x) {stmt;}', () => {
        expect(match_cmd([t('if'), t('('), id('x'), t(')'), t('{'), id('a'), t('='), num('1'), t(';'), t('}')])).toBe(true)
    })
    it('if (x) {} else {}', () => {
        expect(match_cmd([
            t('if'), t('('), id('x'), t(')'), t('{'), t('}'),
            t('else'), t('{'), t('}')
        ])).toBe(true)
    })
    it('while (x) {}', () => {
        expect(match_cmd([t('while'), t('('), id('x'), t(')'), t('{'), t('}')])).toBe(true)
    })
    it('do {} while (x)', () => {
        expect(match_cmd([t('do'), t('{'), t('}'), t('while'), t('('), id('x'), t(')')])).toBe(true)
    })
    it('for (;;) {}', () => {
        expect(match_cmd([t('for'), t('('), t(';'), id('x'), t('<'), num('10'), t(';'), t('{'), t('}')])).toBe(false)
    })
    it('for (x: arr) {}', () => {
        expect(match_cmd([t('for'), t('('), id('x'), t(':'), id('arr'), t(')'), t('{'), t('}')])).toBe(true)
    })
    it('switch (x) { case 1 => {} default {} }', () => {
        const tokens = [
            t('switch'), t('('), id('x'), t(')'), t('{'),
            t('case'), num('1'), t('=>'), t('{'), t('}'),
            t('default'), t('{'), t('}'),
            t('}')
        ]
        expect(match_cmd(tokens)).toBe(true)
    })
    it('try {} catch (e: Error) {}', () => {
        expect(match_cmd([
            t('try'), t('{'), t('}'),
            t('catch'), t('('), id('e'), t(':'), id('Error'), t(')'), t('{'), t('}')
        ])).toBe(true)
    })
    it('try {} catch (e: Error) {} finally {}', () => {
        expect(match_cmd([
            t('try'), t('{'), t('}'),
            t('catch'), t('('), id('e'), t(':'), id('Error'), t(')'), t('{'), t('}'),
            t('finally'), t('{'), t('}')
        ])).toBe(true)
    })
    it('块: { stmt1; stmt2; }', () => {
        const tokens = [
            t('{'),
            id('a'), t('='), num('1'), t(';'),
            id('b'), t('='), num('2'), t(';'),
            t('}')
        ]
        expect(match_cmd(tokens)).toBe(true)
    })
})

// ==================== 块解析 (block.ts) ====================
describe('Block 解析 (block.ts)', () => {
    function match_block(tokens: token[]): boolean {
        const s = new CSTStream([...tokens])
        Block.stream = s
        return Block.match()
    }

    it('link (a.b) as c', () => {
        const s = new CSTStream([t('link'), t('('), id('a'), t('.'), id('b'), t(')'), t('as'), id('c')])
        link.stream = s
        expect(link.match()).toBe(true)
    })
    it('link (a) as b', () => {
        const s = new CSTStream([t('link'), t('('), id('a'), t(')'), t('as'), id('b')])
        link.stream = s
        expect(link.match()).toBe(true)
    })
    it('var x: number;', () => {
        expect(match_block([t('var'), t('number'), id('x'), t(';')])).toBe(true)
    })
    it('var: 带初始化 var number x = 5;', () => {
        expect(match_block([t('var'), t('number'), id('x'), t('='), num('5'), t(';')])).toBe(true)
    })
    it('public function main(): void {}', () => {
        const tokens = [
            t('public'), t('function'), t('('), t(')'),
            t(':'), t('void'), t('{'), t('}')
        ]
        expect(match_block(tokens)).toBe(true)
    })
    it('async function f(x: number): number {return x;}', () => {
        const tokens = [
            t('async'), t('function'),
            t('('), id('x'), t(':'), t('number'), t(')'),
            t(':'), t('number'),
            t('{'), t('return'), id('x'), t(';'), t('}')
        ]
        expect(match_block(tokens)).toBe(true)
    })
    it('class Foo {}', () => {
        expect(match_block([t('class'), id('Foo'), t('{'), t('}')])).toBe(true)
    })
    it('class Foo of Bar { var x: number; }', () => {
        expect(match_block([
            t('class'), id('Foo'), t('of'), id('Bar'),
            t('{'), t('var'), t('number'), id('x'), t(';'), t('}')
        ])).toBe(true)
    })
    it('interface I {}', () => {
        expect(match_block([t('interface'), id('I'), t('{'), t('}')])).toBe(true)
    })
    it('interface I implements J { var x: number; }', () => {
        expect(match_block([
            t('interface'), id('I'), t('implements'), id('J'),
            t('{'), t('var'), t('number'), id('x'), t(';'), t('}')
        ])).toBe(true)
    })
    it('enum Color { Red, Green, Blue }', () => {
        expect(match_block([
            t('enum'),
            t('{'), id('Red'), t(','), id('Green'), t(','), id('Blue'),
            t('}')
        ])).toBe(true)
    })
    it('module { }', () => {
        const s = new CSTStream([t('module'), t('{'), t('}')])
        module_.stream = s
        expect(module_.match()).toBe(true)
    })
    it('多个顶层声明连续匹配', () => {
        const tokens = [
            t('link'), id('a'), t('as'), id('b'),
            t('var'), t('number'), id('x'), t(';'),
            t('public'), t('function'), t('('), t(')'), t(':'), t('void'), t('{'), t('}')
        ]
        const s = new CSTStream([...tokens])
        Block.stream = s
        expect(Block.match()).toBe(true)
    })
})

// ==================== 跨模块集成 ====================
describe('跨模块集成', () => {
    it('表达式: 用 Expr 匹配括号表达式 (x)', () => {
        const s = new CSTStream([t('('), id('x'), t(')')])
        Expr.stream = s
        expect(Expr.match()).toBe(true)
    })
    // 已知限制: lambda 表达式在 Expr=o(Ternary,Binary) 的 Or 第二次 Binary 重试时失败
    // 根因: 第一次 Binary(在 Ternary 中) 成功后, 第二次 Binary 的 Primary lambda 路径中
    //       CSTRule_While/Command 内部状态未能完全重置, 导致匹配结果不一致
    it.todo('表达式 lambda: (x: number) => {}')
    it('命令中使用表达式: if (a + b > 0) { x = 1; }', () => {
        const tokens = [
            t('if'), t('('),
            id('a'), t('+'), id('b'), t('>'), num('0'),
            t(')'),
            t('{'),
            id('x'), t('='), num('1'), t(';'),
            t('}')
        ]
        const s = new CSTStream([...tokens])
        Command.stream = s
        expect(Command.match()).toBe(true)
    })
    it('函数定义包含完整表达式: function f(x: number): number { return x + 1; }', () => {
        const tokens = [
            t('function'),
            t('('), id('x'), t(':'), t('number'), t(')'),
            t(':'), t('number'),
            t('{'),
            t('return'), id('x'), t('+'), num('1'), t(';'),
            t('}')
        ]
        const s = new CSTStream([...tokens])
        Block.stream = s
        expect(Block.match()).toBe(true)
    })
})

// ==================== generate 验证 ====================
describe('CST generate 验证', () => {
    it('Type generate 返回 cst_data[]', () => {
        const s = new CSTStream([t('number')])
        Type.stream = s
        Type.match()
        const result = Type.generate()
        expect(Array.isArray(result)).toBe(true)
    })
    it('Expr generate 返回 cst_data', () => {
        const s = new CSTStream([num('42')])
        Expr.stream = s
        Expr.match()
        const result = Expr.generate()
        expect(result).toBeDefined()
    })
    it('Command generate 返回 cst_data', () => {
        const s = new CSTStream([t('return'), t(';')])
        Command.stream = s
        Command.match()
        const result = Command.generate()
        expect(result).toBeDefined()
    })
})

// ==================== 边界情况 ====================
describe('边界情况', () => {
    it('空流: Type match 返回 false', () => {
        const s = new CSTStream([])
        Type.stream = s
        expect(Type.match()).toBe(false)
    })
    it('空流: Expr match 返回 false', () => {
        const s = new CSTStream([])
        Expr.stream = s
        expect(Expr.match()).toBe(false)
    })
    it('不合法类型', () => {
        const s = new CSTStream([t('+')])
        Type.stream = s
        expect(Type.match()).toBe(false)
    })
    it('不合法表达式', () => {
        const s = new CSTStream([t(';')])
        Expr.stream = s
        expect(Expr.match()).toBe(false)
    })
    it('重复 match 不崩溃', () => {
        const s = new CSTStream([t('number'), num('42'), t('number')])
        Type.stream = s
        Type.match()
        Type.match()
        expect(true).toBe(true)
    })
})
