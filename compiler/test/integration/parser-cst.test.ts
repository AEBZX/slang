import { describe, it, expect } from 'vitest'
import Type from '../../parser/cst/identifier'
import Expr from '../../parser/cst/expr'
import Command from '../../parser/cst/command'
import { link, module_ } from '../../parser/cst/block'
import { CSTStream, CSTRule_Ref } from '../../utils/lib/parser'
import { Parser, TokenType } from '../../utils'
import { token, cst_data } from '../../utils/data'

// token 工厂函数, 模拟 lexer 输出
function kw(value: string): token {
    return { type: TokenType.Keyword, value, line: `L:${value}` }
}
function id(value: string): token {
    return { type: TokenType.Identifier, value, line: `L:${value}` }
}
function num(value: string): token {
    return { type: TokenType.Number, value, line: `L:${value}` }
}
function str_lit(value: string): token {
    return { type: TokenType.String, value, line: `L:${value}` }
}

// 辅助: 调用工厂函数获取新规则实例, 设置 stream, 执行 match
function match_rule(rule: CSTRule_Ref, tokens: token[]): boolean {
    const s = new CSTStream([...tokens])
    rule.stream = s
    return rule.match()
}
function gen_rule(rule: CSTRule_Ref, tokens: token[]): cst_data {
    const s = new CSTStream([...tokens])
    rule.stream = s
    rule.match()
    return rule.generate()
}

// ==================== 模块加载 ====================
describe('CST 模块加载', () => {
    it('identifier.ts: Type 是 function', () => {
        expect(Type).toBeInstanceOf(Function)
    })
    it('expr.ts: Expr 是 function', () => {
        expect(Expr).toBeInstanceOf(Function)
    })
    it('command.ts: Command 是 function', () => {
        expect(Command).toBeInstanceOf(Function)
    })
    it('block.ts: link/module_ 是 function', () => {
        expect(link).toBeInstanceOf(Function)
        expect(module_).toBeInstanceOf(Function)
    })
    it('Type() 返回 CSTRule_Ref 实例', () => {
        expect(Type()).toBeInstanceOf(CSTRule_Ref)
    })
    it('Expr() 返回 CSTRule_Ref 实例', () => {
        expect(Expr()).toBeInstanceOf(CSTRule_Ref)
    })
    it('每次调用返回新的 Ref 实例 (状态隔离)', () => {
        const a = Type()
        const b = Type()
        expect(a).not.toBe(b)
    })
})

// ==================== Type 解析 (identifier.ts) ====================
describe('Type 解析 (identifier.ts)', () => {
    it('基础类型: void', () => {
        expect(match_rule(Type(), [kw('void')])).toBe(true)
    })
    it('基础类型: boolean', () => {
        expect(match_rule(Type(), [kw('boolean')])).toBe(true)
    })
    it('基础类型: number', () => {
        expect(match_rule(Type(), [kw('number')])).toBe(true)
    })
    it('基础类型: string', () => {
        expect(match_rule(Type(), [kw('string')])).toBe(true)
    })
    it('限定名: 单标识符 a', () => {
        expect(match_rule(Type(), [id('a')])).toBe(true)
    })
    it('限定名: 多层点分隔 a.b.C', () => {
        expect(match_rule(Type(), [id('a'), kw('.'), id('b'), kw('.'), id('C')])).toBe(true)
    })
    it('数组类型: number[] ([] 是单 token)', () => {
        expect(match_rule(Type(), [kw('number'), kw('[]')])).toBe(true)
    })
    it('嵌套数组: number[][]', () => {
        expect(match_rule(Type(), [kw('number'), kw('[]'), kw('[]')])).toBe(true)
    })
    it('Map 类型: string{}', () => {
        expect(match_rule(Type(), [kw('string'), kw('{}')])).toBe(true)
    })
    it('指针类型: number*', () => {
        expect(match_rule(Type(), [kw('number'), kw('*')])).toBe(true)
    })
    it('多重指针: number**', () => {
        expect(match_rule(Type(), [kw('number'), kw('*'), kw('*')])).toBe(true)
    })
    it('混合后缀: number[]*', () => {
        expect(match_rule(Type(), [kw('number'), kw('[]'), kw('*')])).toBe(true)
    })
    it('括号类型: (number)', () => {
        expect(match_rule(Type(), [kw('('), kw('number'), kw(')')])).toBe(true)
    })
    it('括号嵌套: ((number))', () => {
        expect(match_rule(Type(), [kw('('), kw('('), kw('number'), kw(')'), kw(')')])).toBe(true)
    })
    it('括号+后缀: (number)[]', () => {
        expect(match_rule(Type(), [kw('('), kw('number'), kw(')'), kw('[]')])).toBe(true)
    })
    it('generate: number 返回非空 cst_data', () => {
        const result = gen_rule(Type(), [kw('number')])
        expect(result).toBeDefined()
        expect(Array.isArray(result)).toBe(true)
    })
    it('generate: number[] 返回非空 cst_data', () => {
        const result = gen_rule(Type(), [kw('number'), kw('[]')])
        expect(Array.isArray(result)).toBe(true)
    })
})

// ==================== Expr 解析 (expr.ts) ====================
describe('Expr 解析 (expr.ts)', () => {
    // --- 字面量 ---
    it('字面量: 数字', () => {
        expect(match_rule(Expr(), [num('42')])).toBe(true)
    })
    it('字面量: 字符串', () => {
        expect(match_rule(Expr(), [str_lit('hello')])).toBe(true)
    })
    it('字面量: true', () => {
        expect(match_rule(Expr(), [kw('true')])).toBe(true)
    })
    it('字面量: false', () => {
        expect(match_rule(Expr(), [kw('false')])).toBe(true)
    })
    it('字面量: null', () => {
        expect(match_rule(Expr(), [kw('null')])).toBe(true)
    })
    it('标识符', () => {
        expect(match_rule(Expr(), [id('myVar')])).toBe(true)
    })

    // --- 括号表达式 ---
    it('括号: (x)', () => {
        expect(match_rule(Expr(), [kw('('), id('x'), kw(')')])).toBe(true)
    })
    it('括号: (1 + 2)', () => {
        expect(match_rule(Expr(), [kw('('), num('1'), kw('+'), num('2'), kw(')')])).toBe(true)
    })

    // --- 数组字面量 [1, 2] ---
    it('数组: [1, 2, 3]', () => {
        expect(match_rule(Expr(), [
            kw('['), num('1'), kw(','), num('2'), kw(','), num('3'), kw(']')
        ])).toBe(true)
    })
    it('数组: [] (空数组)', () => {
        expect(match_rule(Expr(), [kw('['), kw(']')])).toBe(true)
    })

    // --- 对象字面量 (语法使用 = 不是 :) ---
    it('对象: {x = 1}', () => {
        expect(match_rule(Expr(), [kw('{'), id('x'), kw('='), num('1'), kw('}')])).toBe(true)
    })
    it('对象: {} (空对象, While 空匹配)', () => {
        expect(match_rule(Expr(), [kw('{'), kw('}')])).toBe(true)
    })

    // --- 后缀操作 ---
    it('后缀: x++', () => {
        expect(match_rule(Expr(), [id('x'), kw('++')])).toBe(true)
    })
    it('后缀: x--', () => {
        expect(match_rule(Expr(), [id('x'), kw('--')])).toBe(true)
    })
    it('后缀: 成员访问 x.y', () => {
        expect(match_rule(Expr(), [id('x'), kw('.'), id('y')])).toBe(true)
    })
    it('后缀: 下标 a[0]', () => {
        expect(match_rule(Expr(), [id('a'), kw('['), num('0'), kw(']')])).toBe(true)
    })
    it('后缀: 函数调用 f()', () => {
        expect(match_rule(Expr(), [id('f'), kw('('), kw(')')])).toBe(true)
    })
    it('后缀: 函数调用 f(1, 2)', () => {
        expect(match_rule(Expr(), [id('f'), kw('('), num('1'), kw(','), num('2'), kw(')')])).toBe(true)
    })

    // --- 前缀操作 ---
    it('前缀: -x', () => {
        expect(match_rule(Expr(), [kw('-'), id('x')])).toBe(true)
    })
    it('前缀: !x', () => {
        expect(match_rule(Expr(), [kw('!'), id('x')])).toBe(true)
    })
    it('前缀: ~x', () => {
        expect(match_rule(Expr(), [kw('~'), id('x')])).toBe(true)
    })
    it('前缀: ++x', () => {
        expect(match_rule(Expr(), [kw('++'), id('x')])).toBe(true)
    })
    it('前缀: --x', () => {
        expect(match_rule(Expr(), [kw('--'), id('x')])).toBe(true)
    })

    // --- 二元运算 (按优先级链验证) ---
    it('乘法: a * b', () => {
        expect(match_rule(Expr(), [id('a'), kw('*'), id('b')])).toBe(true)
    })
    it('除法: a / b', () => {
        expect(match_rule(Expr(), [id('a'), kw('/'), id('b')])).toBe(true)
    })
    it('取模: a % b', () => {
        expect(match_rule(Expr(), [id('a'), kw('%'), id('b')])).toBe(true)
    })
    it('加法: a + b', () => {
        expect(match_rule(Expr(), [id('a'), kw('+'), id('b')])).toBe(true)
    })
    it('减法: a - b', () => {
        expect(match_rule(Expr(), [id('a'), kw('-'), id('b')])).toBe(true)
    })
    it('优先级: a + b * c', () => {
        expect(match_rule(Expr(), [id('a'), kw('+'), id('b'), kw('*'), id('c')])).toBe(true)
    })
    it('移位: a << b', () => {
        expect(match_rule(Expr(), [id('a'), kw('<<'), id('b')])).toBe(true)
    })
    it('移位: a >> b', () => {
        expect(match_rule(Expr(), [id('a'), kw('>>'), id('b')])).toBe(true)
    })
    it('比较: a < b', () => {
        expect(match_rule(Expr(), [id('a'), kw('<'), id('b')])).toBe(true)
    })
    it('比较: a >= b', () => {
        expect(match_rule(Expr(), [id('a'), kw('>='), id('b')])).toBe(true)
    })
    it('相等: a == b', () => {
        expect(match_rule(Expr(), [id('a'), kw('=='), id('b')])).toBe(true)
    })
    it('不等: a != b', () => {
        expect(match_rule(Expr(), [id('a'), kw('!='), id('b')])).toBe(true)
    })
    it('位与: a & b', () => {
        expect(match_rule(Expr(), [id('a'), kw('&'), id('b')])).toBe(true)
    })
    it('位或: a | b', () => {
        expect(match_rule(Expr(), [id('a'), kw('|'), id('b')])).toBe(true)
    })
    it('位异或: a ^ b', () => {
        expect(match_rule(Expr(), [id('a'), kw('^'), id('b')])).toBe(true)
    })
    it('逻辑与: a && b', () => {
        expect(match_rule(Expr(), [id('a'), kw('&&'), id('b')])).toBe(true)
    })
    it('逻辑或: a || b', () => {
        expect(match_rule(Expr(), [id('a'), kw('||'), id('b')])).toBe(true)
    })

    // --- 三元运算 ---
    it('三元: a ? b : c', () => {
        expect(match_rule(Expr(), [id('a'), kw('?'), id('b'), kw(':'), id('c')])).toBe(true)
    })

    // --- generate 验证 ---
    it('generate: 数字返回非空 cst_data', () => {
        const result = gen_rule(Expr(), [num('42')])
        expect(result).toBeDefined()
    })
    it('generate: 二元表达式返回非空 cst_data', () => {
        const result = gen_rule(Expr(), [id('a'), kw('+'), id('b')])
        expect(result).toBeDefined()
    })
})

// ==================== Command 解析 (command.ts) ====================
describe('Command 解析 (command.ts)', () => {
    // --- 简单命令 (带关键字的) ---
    it('return;', () => {
        expect(match_rule(Command(), [kw('return'), kw(';')])).toBe(true)
    })
    it('return expr;', () => {
        expect(match_rule(Command(), [kw('return'), num('42'), kw(';')])).toBe(true)
    })
    it('break;', () => {
        expect(match_rule(Command(), [kw('break'), kw(';')])).toBe(true)
    })
    it('continue;', () => {
        expect(match_rule(Command(), [kw('continue'), kw(';')])).toBe(true)
    })
    it('throw "err";', () => {
        expect(match_rule(Command(), [kw('throw'), str_lit('err'), kw(';')])).toBe(true)
    })
    it('await f();', () => {
        expect(match_rule(Command(), [kw('await'), id('f'), kw('('), kw(')'), kw(';')])).toBe(true)
    })
    it('vm "code";', () => {
        expect(match_rule(Command(), [kw('vm'), str_lit('code'), kw(';')])).toBe(true)
    })

    // --- 自增/自减 (命令形式: expr++; ---
    it('自增: x++;', () => {
        expect(match_rule(Command(), [id('x'), kw('++'), kw(';')])).toBe(true)
    })
    it('自减: x--;', () => {
        expect(match_rule(Command(), [id('x'), kw('--'), kw(';')])).toBe(true)
    })

    // --- var 声明 (语法要求 = Expr, 无 $.c 包裹) ---
    it('var x: number = 5;', () => {
        expect(match_rule(Command(), [
            kw('var'), id('x'), kw(':'), kw('number'), kw('='), num('5'), kw(';')
        ])).toBe(true)
    })

    // --- if ---
    it('if (x) {}', () => {
        expect(match_rule(Command(), [
            kw('if'), kw('('), id('x'), kw(')'), kw('{'), kw('}')
        ])).toBe(true)
    })
    it('if (x) {return;} else {}', () => {
        expect(match_rule(Command(), [
            kw('if'), kw('('), id('x'), kw(')'),
            kw('{'), kw('return'), kw(';'), kw('}'),
            kw('else'), kw('{'), kw('}')
        ])).toBe(true)
    })

    // --- while ---
    it('while (x) {}', () => {
        expect(match_rule(Command(), [
            kw('while'), kw('('), id('x'), kw(')'), kw('{'), kw('}')
        ])).toBe(true)
    })

    // --- do-while (语法以 ; 结尾) ---
    it('do {} while (x);', () => {
        expect(match_rule(Command(), [
            kw('do'), kw('{'), kw('}'), kw('while'), kw('('), id('x'), kw(')'), kw(';')
        ])).toBe(true)
    })

    // --- for-in ---
    it('for (x: arr) {}', () => {
        expect(match_rule(Command(), [
            kw('for'), kw('('), id('x'), kw(':'), id('arr'), kw(')'), kw('{'), kw('}')
        ])).toBe(true)
    })

    // --- switch ---
    it('switch (x) { case 1 => {} default => {} }', () => {
        expect(match_rule(Command(), [
            kw('switch'), kw('('), id('x'), kw(')'), kw('{'),
            kw('case'), num('1'), kw('=>'), kw('{'), kw('}'),
            kw('default'), kw('=>'), kw('{'), kw('}'),
            kw('}')
        ])).toBe(true)
    })

    // --- try/catch/finally ---
    it('try {} catch (e: Error) {}', () => {
        expect(match_rule(Command(), [
            kw('try'), kw('{'), kw('}'),
            kw('catch'), kw('('), id('e'), kw(':'), id('Error'), kw(')'), kw('{'), kw('}')
        ])).toBe(true)
    })
    it('try {} catch (e: Error) {} finally {}', () => {
        expect(match_rule(Command(), [
            kw('try'), kw('{'), kw('}'),
            kw('catch'), kw('('), id('e'), kw(':'), id('Error'), kw(')'), kw('{'), kw('}'),
            kw('finally'), kw('{'), kw('}')
        ])).toBe(true)
    })

    // --- 块 ---
    it('块: { return; break; }', () => {
        expect(match_rule(Command(), [
            kw('{'),
            kw('return'), kw(';'),
            kw('break'), kw(';'),
            kw('}')
        ])).toBe(true)
    })

    // --- generate ---
    it('generate: return; 返回非空 cst_data', () => {
        const result = gen_rule(Command(), [kw('return'), kw(';')])
        expect(result).toBeDefined()
    })
})

// ==================== Block 解析 (block.ts) ====================
describe('Block 解析 (block.ts)', () => {
    // link: 语法为 link ident.path as ident; (无括号)
    it('link a.b.c as d;', () => {
        expect(match_rule(link(), [
            kw('link'), id('a'), kw('.'), id('b'), kw('.'), id('c'), kw('as'), id('d'), kw(';')
        ])).toBe(true)
    })
    it('link a as b;', () => {
        expect(match_rule(link(), [
            kw('link'), id('a'), kw('as'), id('b'), kw(';')
        ])).toBe(true)
    })

    // module
    it('module { }', () => {
        expect(match_rule(module_(), [kw('module'), kw('{'), kw('}')])).toBe(true)
    })
    // function 语法: function ReturnType (params) body
    it('module { public f : function void () {} }', () => {
        expect(match_rule(module_(), [
            kw('module'), kw('{'),
            kw('public'), id('f'), kw(':'), kw('function'),
            kw('void'), kw('('), kw(')'), kw('{'), kw('}'),
            kw('}')
        ])).toBe(true)
    })

    // generate
    it('generate: link 返回非空 cst_data', () => {
        const result = gen_rule(link(), [
            kw('link'), id('a'), kw('as'), id('b'), kw(';')
        ])
        expect(result).toBeDefined()
    })
    it('generate: module 返回非空 cst_data', () => {
        const result = gen_rule(module_(), [kw('module'), kw('{'), kw('}')])
        expect(result).toBeDefined()
    })
})

// ==================== 跨模块集成 ====================
describe('跨模块集成', () => {
    it('括号表达式中嵌入复杂表达式: (a + b * c)', () => {
        expect(match_rule(Expr(), [
            kw('('),
            id('a'), kw('+'), id('b'), kw('*'), id('c'),
            kw(')')
        ])).toBe(true)
    })
    it('嵌套块语句: { if (x) {return;} }', () => {
        expect(match_rule(Command(), [
            kw('{'),
            kw('if'), kw('('), id('x'), kw(')'), kw('{'), kw('return'), kw(';'), kw('}'),
            kw('}')
        ])).toBe(true)
    })
})

// ==================== 边界情况 ====================
describe('边界情况', () => {
    it('空流: Type match 返回 false', () => {
        expect(match_rule(Type(), [])).toBe(false)
    })
    it('空流: Expr match 返回 false', () => {
        expect(match_rule(Expr(), [])).toBe(false)
    })
    it('空流: Command match 返回 false', () => {
        expect(match_rule(Command(), [])).toBe(false)
    })
    it('非法类型: 单个运算符 +', () => {
        expect(match_rule(Type(), [kw('+')])).toBe(false)
    })
    it('非法表达式: 只有分号', () => {
        expect(match_rule(Expr(), [kw(';')])).toBe(false)
    })
    it('重复 match 不崩溃 (每次 match 重建内部规则)', () => {
        const rule = Type()
        expect(() => {
            rule.stream = new CSTStream([kw('number')])
            rule.match()
            rule.stream = new CSTStream([kw('string')])
            rule.match()
        }).not.toThrow()
    })
    it('重复 generate 不崩溃', () => {
        const rule = Type()
        rule.stream = new CSTStream([kw('number')])
        rule.match()
        expect(() => rule.generate()).not.toThrow()
        expect(() => rule.generate()).not.toThrow()
    })
    it('不同实例之间状态不互相影响', () => {
        const a = Type()
        const b = Type()
        a.stream = new CSTStream([kw('number')])
        b.stream = new CSTStream([kw('string')])
        expect(a.match()).toBe(true)
        expect(b.match()).toBe(true)
    })
})

// ==================== 已修复: 赋值与声明 (command.ts) ====================
describe('已修复: 赋值与 var 声明', () => {
    it('赋值: x = 1;', () => {
        expect(match_rule(Command(), [id('x'), kw('='), num('1'), kw(';')])).toBe(true)
    })
    it('复合赋值: x += 1;', () => {
        expect(match_rule(Command(), [id('x'), kw('+='), num('1'), kw(';')])).toBe(true)
    })
    it('复合赋值: x -= 1;', () => {
        expect(match_rule(Command(), [id('x'), kw('-='), num('1'), kw(';')])).toBe(true)
    })
    it('复合赋值: x *= 2;', () => {
        expect(match_rule(Command(), [id('x'), kw('*='), num('2'), kw(';')])).toBe(true)
    })
    it('复合赋值: x /= 2;', () => {
        expect(match_rule(Command(), [id('x'), kw('/='), num('2'), kw(';')])).toBe(true)
    })
    it('复合赋值: x %= 2;', () => {
        expect(match_rule(Command(), [id('x'), kw('%='), num('2'), kw(';')])).toBe(true)
    })
    it('复合赋值: x <<= 1;', () => {
        expect(match_rule(Command(), [id('x'), kw('<<='), num('1'), kw(';')])).toBe(true)
    })
    it('复合赋值: x >>= 1;', () => {
        expect(match_rule(Command(), [id('x'), kw('>>='), num('1'), kw(';')])).toBe(true)
    })
    it('复合赋值: x &&= y;', () => {
        expect(match_rule(Command(), [id('x'), kw('&&='), id('y'), kw(';')])).toBe(true)
    })
    it('复合赋值: x ||= y;', () => {
        expect(match_rule(Command(), [id('x'), kw('||='), id('y'), kw(';')])).toBe(true)
    })
    it('复合赋值: x &= y;', () => {
        expect(match_rule(Command(), [id('x'), kw('&='), id('y'), kw(';')])).toBe(true)
    })
    it('复合赋值: x |= y;', () => {
        expect(match_rule(Command(), [id('x'), kw('|='), id('y'), kw(';')])).toBe(true)
    })
    it('复合赋值: x ^= y;', () => {
        expect(match_rule(Command(), [id('x'), kw('^='), id('y'), kw(';')])).toBe(true)
    })
    it('var x: number; (无初始化器, $.c 修复)', () => {
        expect(match_rule(Command(), [kw('var'), id('x'), kw(':'), kw('number'), kw(';')])).toBe(true)
    })
    it('var x: number = 5; (有初始化器)', () => {
        expect(match_rule(Command(), [
            kw('var'), id('x'), kw(':'), kw('number'), kw('='), num('5'), kw(';')
        ])).toBe(true)
    })
    // 跨模块: 命令中嵌入表达式
    it('if (a + b > 0) { x = 1; }', () => {
        expect(match_rule(Command(), [
            kw('if'), kw('('),
            id('a'), kw('+'), id('b'), kw('>'), num('0'),
            kw(')'),
            kw('{'),
            id('x'), kw('='), num('1'), kw(';'),
            kw('}')
        ])).toBe(true)
    })
    // generate
    it('generate: x = 1; 返回非空', () => {
        const result = gen_rule(Command(), [id('x'), kw('='), num('1'), kw(';')])
        expect(result).toBeDefined()
    })
})
