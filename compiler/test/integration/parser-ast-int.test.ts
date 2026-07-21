import { describe, it, expect } from 'vitest'
import { CSTStream, ASTStream } from '../../utils/lib/parser'
import { TokenType, Parser } from '../../utils'
import { ast_data, token } from '../../utils/data'
import cst_Type from '../../parser/cst/identifier'
import cst_Expr from '../../parser/cst/expr'
import cst_Command from '../../parser/cst/command'
import cst_Block, { link as cst_link } from '../../parser/cst/block'
import ast_Type, { IdentifierVisitor } from '../../parser/ast/identifier'
import ast_Expr, { _Expr, ExprVisitor } from '../../parser/ast/expr'
import ast_Command, { CommandVisitor } from '../../parser/ast/command'
import { BlockVisitor, link as ast_link } from '../../parser/ast/block'
import ASTParser from '../../parser/ast'
const $=Parser.ast

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

function cst_gen(rule: any, tokens: token[]) {
    const s = new CSTStream([...tokens])
    rule.stream = s
    rule.match()
    return rule.generate()
}

// ==================== CST 匹配 ====================
describe('CST 匹配', () => {
    it('基础类型: number/string/boolean/void', () => {
        for (const kw of ['number', 'string', 'boolean', 'void'])
            expect(cst_gen(cst_Type, [t(kw)])).toBeTruthy()
    })
    it('number[] 和 number*', () => {
        expect(cst_gen(cst_Type, [t('number'), t('['), t(']')])).toBeTruthy()
        expect(cst_gen(cst_Type, [t('number'), t('*')])).toBeTruthy()
    })
    it('限定名 a.b.C', () => {
        expect(cst_gen(cst_Type, [id('a'), t('.'), id('b'), t('.'), id('C')])).toBeTruthy()
    })
    it('括号类型 (number)', () => {
        expect(cst_gen(cst_Type, [t('('), t('number'), t(')')])).toBeTruthy()
    })
    it('LambdaType: (a: number) => string', () => {
        expect(cst_gen(cst_Type, [t('('), id('a'), t(':'), t('number'), t(')'), t('=>'), t('string')])).toBeTruthy()
    })

    it('字面量: 数字/字符串/true/false/null', () => {
        expect(cst_gen(cst_Expr, [num('42')])).toBeTruthy()
        expect(cst_gen(cst_Expr, [str('"hello"')])).toBeTruthy()
        expect(cst_gen(cst_Expr, [t('true')])).toBeTruthy()
        expect(cst_gen(cst_Expr, [t('false')])).toBeTruthy()
        expect(cst_gen(cst_Expr, [t('null')])).toBeTruthy()
    })
    it('标识符 myVar', () => expect(cst_gen(cst_Expr, [id('myVar')])).toBeTruthy())
    it('括号 (x) 和 ((a + b))', () => {
        expect(cst_gen(cst_Expr, [t('('), id('x'), t(')')])).toBeTruthy()
        expect(cst_gen(cst_Expr, [t('('), id('a'), t('+'), id('b'), t(')')])).toBeTruthy()
    })
    it('空数组 [] 和 空对象 {}', () => {
        expect(cst_gen(cst_Expr, [t('['), t(']')])).toBeTruthy()
        expect(cst_gen(cst_Expr, [t('{'), t('}')])).toBeTruthy()
    })

    it('return/break/continue', () => {
        expect(cst_gen(cst_Command, [t('return'), id('x'), t(';')])).toBeTruthy()
        expect(cst_gen(cst_Command, [t('return'), t(';')])).toBeTruthy()
        expect(cst_gen(cst_Command, [t('break'), t(';')])).toBeTruthy()
        expect(cst_gen(cst_Command, [t('continue'), t(';')])).toBeTruthy()
    })
    it('赋值 x = 1 和 x += 1', () => {
        expect(cst_gen(cst_Command, [id('x'), t('='), num('1'), t(';')])).toBeTruthy()
        expect(cst_gen(cst_Command, [id('x'), t('+='), num('1'), t(';')])).toBeTruthy()
    })
    it('var 声明', () => {
        expect(cst_gen(cst_Command, [t('var'), id('x'), t(':'), t('number'), t('='), num('5'), t(';')])).toBeTruthy()
        expect(cst_gen(cst_Command, [t('var'), id('x'), t(':'), t('number'), t(';')])).toBeTruthy()
    })
    it('空块 {}', () => expect(cst_gen(cst_Command, [t('{'), t('}')])).toBeTruthy())
    it('if/if-else', () => {
        expect(cst_gen(cst_Command, [t('if'), t('('), id('x'), t(')'), t('{'), t('}')])).toBeTruthy()
        expect(cst_gen(cst_Command, [
            t('if'), t('('), id('x'), t(')'), t('{'), t('}'), t('else'), t('{'), t('}')
        ])).toBeTruthy()
    })
    it('while/do-while', () => {
        expect(cst_gen(cst_Command, [t('while'), t('('), t('true'), t(')'), t('{'), t('}')])).toBeTruthy()
        expect(cst_gen(cst_Command, [t('do'), t('{'), t('}'), t('while'), t('('), t('true'), t(')')])).toBeTruthy()
    })
    it('for (;;) {} 和 for (x: arr) {}', () => {
        expect(cst_gen(cst_Command, [
            t('for'), t('('), t(';'), t(';'), t(')'), t('{'), t('}')
        ])).toBeTruthy()
        expect(cst_gen(cst_Command, [
            t('for'), t('('), id('x'), t(':'), id('arr'), t(')'), t('{'), t('}')
        ])).toBeTruthy()
    })
    it('try/catch/finally', () => {
        expect(cst_gen(cst_Command, [
            t('try'), t('{'), t('}'), t('catch'), t('('), id('e'), t(':'), t('string'), t(')'), t('{'), t('}')
        ])).toBeTruthy()
        expect(cst_gen(cst_Command, [t('try'), t('{'), t('}'), t('finally'), t('{'), t('}')])).toBeTruthy()
    })
    it('switch/case/default', () => {
        expect(cst_gen(cst_Command, [
            t('switch'), t('('), id('x'), t(')'), t('{'),
            t('case'), num('1'), t('=>'), t('{'), t('}'),
            t('default'), t('{'), t('}'), t('}')
        ])).toBeTruthy()
    })
    it('await/throw/vm', () => {
        expect(cst_gen(cst_Command, [t('await'), id('x'), t(';')])).toBeTruthy()
        expect(cst_gen(cst_Command, [t('throw'), str('"err"'), t(';')])).toBeTruthy()
        expect(cst_gen(cst_Command, [t('vm'), str('"code"'), t(';')])).toBeTruthy()
    })

    it('link (a.b.c) as d', () => {
        expect(cst_gen(cst_link, [
            t('link'), t('('), id('a'), t('.'), id('b'), t('.'), id('c'), t(')'), t('as'), id('d')
        ])).toBeTruthy()
    })
    it('function 带修饰符和名', () => {
        expect(cst_gen(cst_Block, [
            t('public'), id('foo'), t('function'), t('('), id('a'), t(':'), t('number'), t(')'),
            t(':'), t('void'), t('{'), t('}')
        ])).toBeTruthy()
    })
    it('variable/class/interface/enum', () => {
        expect(cst_gen(cst_Block, [t('static'), id('x'), t('var'), t('number'), t(';')])).toBeTruthy()
        expect(cst_gen(cst_Block, [t('public'), id('C'), t('class'), t('{'), t('}')])).toBeTruthy()
        expect(cst_gen(cst_Block, [t('public'), id('I'), t('interface'), t('{'), t('}')])).toBeTruthy()
        expect(cst_gen(cst_Block, [t('enum'), t('{'), id('A'), t(','), id('B'), t('}')])).toBeTruthy()
    })
    it('module { } 含声明', () => {
        expect(cst_gen(cst_Block, [t('module'), t('{'), t('}')])).toBeTruthy()
        expect(cst_gen(cst_Block, [
            t('module'), t('{'),
            t('public'), id('f'), t('function'), t('('), t(')'), t(':'), t('void'), t('{'), t('}'),
            t('}')
        ])).toBeTruthy()
    })
    it('class 含 of/extends', () => {
        expect(cst_gen(cst_Block, [
            id('MyC'), t('class'), t('of'), id('Base'), t('{'), t('}')
        ])).toBeTruthy()
    })
})

// ==================== AST Visitor (手工构造AST) ====================
function make_ast(type: string, children: (ast_data | string)[] = [], line: string[] = ['L:test']): ast_data {
    return { type, children, line, comment: '' }
}
function visit(ast: ast_data, visitors: {name: string, visitor: (a: ast_data) => ast_data}[]) {
    return $.visit(ast, visitors)
}

describe('AST Type Visitor', () => {
    it('TypeVisitor: number/string/boolean/void → 对应Type', () => {
        const mk = (v: string, expected: string) => {
            const ast = make_ast('Type', [v, make_ast('PointFix', [], [])])
            const result = visit(ast, IdentifierVisitor)
            expect((result.children as any[])[0].type).toBe(expected)
        }
        mk('number', 'NumberType')
        mk('string', 'StringType')
        mk('boolean', 'BooleanType')
        mk('void', 'VoidType')
    })
    it('ThesesType: 过滤 ( )', () => {
        const ast = make_ast('ThesesType', ['(', make_ast('NumberType', [], []), ')'])
        expect(visit(ast, IdentifierVisitor).children.length).toBe(1)
    })
    it('ArrayType/MapType: visitor运行不崩溃', () => {
        expect(visit(make_ast('ArrayType', [make_ast('NumberType', [], []), '[', ']']), IdentifierVisitor)).toBeTruthy()
        expect(visit(make_ast('MapType', [make_ast('StringType', [], []), '{', '}']), IdentifierVisitor)).toBeTruthy()
    })
    it('LambdaType: 过滤 =>', () => {
        const ast = make_ast('LambdaType', [make_ast('LambdaParamsType', [], []), '=>', make_ast('StringType', [], [])])
        expect(visit(ast, IdentifierVisitor).children.length).toBe(2)
    })
    it('MemberType: 过滤 .', () => {
        const ast = make_ast('MemberType', ['a', '.', 'b', '.', 'C'])
        expect(visit(ast, IdentifierVisitor).children).toEqual(['a', 'b', 'C'])
    })
})

describe('AST Expr Visitor', () => {
    it('ThesesPrimary: 过滤括号', () => {
        const ast = make_ast('ThesesPrimary', ['(', make_ast('Identifier', ['x']), ')'])
        expect(visit(ast, ExprVisitor).children.length).toBe(1)
    })
    it('二元运算 (Additive等): 过滤运算符字符串', () => {
        for (const op of ['Additive', 'Multiplicative', 'Relational', 'Equality',
            'BitwiseAnd', 'BitwiseOr', 'BitwiseXor', 'LogicalAnd', 'LogicalOr', 'Shift']) {
            const ast = make_ast(op, [make_ast('Identifier', ['a']), '+', make_ast('Identifier', ['b'])])
            expect(visit(ast, ExprVisitor).children.length).toBe(2)
        }
    })
    it('PostfixVisitor: ++ → IncrementPostfix', () => {
        const ast = make_ast('Postfix', [make_ast('Identifier', ['x']), make_ast('FixOfPost', ['++'])])
        const r = visit(ast, ExprVisitor)
        expect((r.children as any[]).some((c: any) => c.type === 'IncrementPostfix')).toBe(true)
    })
    it('MemberPostfix: 过滤 .', () => {
        const ast = make_ast('MemberPostfix', [make_ast('Identifier', ['a']), '.', make_ast('Identifier', ['b'])])
        expect(visit(ast, ExprVisitor).children.length).toBe(2)
    })
    it('CallPostfix/ComputedPostfix: 过滤括号', () => {
        expect(visit(make_ast('CallPostfix', ['(', make_ast('Identifier', ['x']), ')']), ExprVisitor).children.length).toBe(1)
        expect(visit(make_ast('ComputedPostfix', ['[', make_ast('NumberLiteral', ['0']), ']']), ExprVisitor).children.length).toBe(1)
    })
    it('MapKeyData/LambdaParam: 过滤 :', () => {
        expect(visit(make_ast('MapKeyData', [make_ast('Identifier', ['k']), ':']), ExprVisitor).children.length).toBe(1)
        expect(visit(make_ast('LambdaParam', [make_ast('Identifier', ['p']), ':']), ExprVisitor).children.length).toBe(1)
    })
    it('LambdaLiteral: 过滤 =>', () => {
        const ast = make_ast('LambdaLiteral', [make_ast('LambdaParam', [], []), '=>', make_ast('Commands', [], [])])
        expect(visit(ast, ExprVisitor).children.length).toBe(2)
    })
    it('Ternary: 过滤 ? 和 :', () => {
        const ast = make_ast('Ternary', [make_ast('Identifier', ['a']), '?', make_ast('NumberLiteral', ['1']), ':', make_ast('NumberLiteral', ['2'])])
        expect(visit(ast, ExprVisitor).children.length).toBe(3)
    })
    it('Prefix: operator 转换', () => {
        const ast = make_ast('Prefix', [make_ast('FixOfPre', ['!']), make_ast('Identifier', ['x'])])
        expect(visit(ast, ExprVisitor)).toBeTruthy()
    })
})

describe('AST Command Visitor', () => {
    it('ReturnVisitor: ReturnValue → 空children', () => {
        const ast_with = make_ast('Return', ['return', make_ast('ReturnValue', [make_ast('Identifier', ['x'])])])
        const ast_empty = make_ast('Return', ['return', make_ast('ReturnValue', [], [])])
        expect(visit(ast_with, CommandVisitor).children.length).toBe(0)
        expect(visit(ast_empty, CommandVisitor).children.length).toBe(0)
    })
    it('CallVisitor: Await → Call', () => {
        const ast = make_ast('Call', [make_ast('Await', ['await']), make_ast('Identifier', ['x'])])
        const r = visit(ast, CommandVisitor)
        expect(r.type).toBe('Call')
        expect(r.children.length).toBe(1)
    })
    it('Throw/VM: 过滤关键字', () => {
        expect(visit(make_ast('Throw', ['throw', make_ast('StringLiteral', ['"err"'])]), CommandVisitor).children.length).toBe(1)
        expect(visit(make_ast('VM', ['vm', make_ast('StringLiteral', ['"code"'])]), CommandVisitor).children.length).toBe(1)
    })
    it('Increment/Decrement: 过滤字符串', () => {
        expect(visit(make_ast('Increment', [make_ast('Identifier', ['x']), '++']), CommandVisitor).children.length).toBe(1)
        expect(visit(make_ast('Decrement', [make_ast('Identifier', ['x']), '--']), CommandVisitor).children.length).toBe(1)
    })
    it('VarVisitor: 不崩溃', () => {
        expect(visit(make_ast('Var', ['var', make_ast('Identifier', ['x']), ':', make_ast('Identifier', ['T']), '=', make_ast('Identifier', ['v'])]), CommandVisitor)).toBeTruthy()
    })
    it('CondVisitor: 过滤( )', () => {
        expect(visit(make_ast('Cond', ['(', make_ast('Identifier', ['x']), ')']), CommandVisitor).children.length).toBe(1)
    })
    // CommandsVisitor 访问 children[1], 需要至少2个 children
    const ret_node = () => make_ast('Return', ['return', make_ast('ReturnValue', [])])
    const cmds_node = () => make_ast('Commands', ['{', ret_node(), '}'])
    it('IfStatement: 过滤 if', () => {
        expect(visit(make_ast('IfStatement', ['if', make_ast('Cond', []), cmds_node()]), CommandVisitor)).toBeTruthy()
    })
    it('Foreach/Try: 过滤关键字', () => {
        expect(visit(make_ast('ForeachStatement', ['for', make_ast('Identifier', ['x']), ':', make_ast('Identifier', ['arr']), cmds_node()]), CommandVisitor)).toBeTruthy()
        expect(visit(make_ast('TryStatement', ['try', cmds_node(), 'catch', cmds_node()]), CommandVisitor)).toBeTruthy()
    })
    it('BasicCommand/Commands: 不崩溃', () => {
        // Return 需要 children[1]=ReturnValue, 否则 ReturnVisitor 访问 undefined.type 崩溃
        expect(visit(make_ast('BasicCommand', [make_ast('Return', ['return', make_ast('ReturnValue', [])]), ';']), CommandVisitor)).toBeTruthy()
        expect(visit(make_ast('Commands', ['{', make_ast('Return', ['return', make_ast('ReturnValue', [])]), '}']), CommandVisitor).type).toBe('Return')
    })
})

describe('AST Block Visitor', () => {
    it('LinkVisitor: 过滤 as link', () => {
        const ast = make_ast('Link', ['link', make_ast('BlockName', ['a', 'b']), 'as', 'c'])
        expect(visit(ast, BlockVisitor).children.length).toBe(2)
    })
    it('BlockNameVisitor: 过滤 .', () => {
        expect(visit(make_ast('BlockName', ['a', '.', 'b', '.', 'c']), BlockVisitor).children).toEqual(['a', 'b', 'c'])
    })
    it('BlockVisitor_: 过滤字符串', () => {
        for (const t of ['Function', 'Class', 'Interface']) {
            expect(visit(make_ast(t, ['kw', make_ast('Identifier', ['name']), make_ast('Commands', [])]), BlockVisitor)).toBeTruthy()
        }
    })
    it('VariableVisitor: visitor不崩溃', () => {
        expect(visit(make_ast('Variable', ['var', make_ast('StringType', [], []), '=', make_ast('StringLiteral', ['"hi"']), ';']), BlockVisitor)).toBeTruthy()
    })
    it('ParamVisitor/ParamIdentifier: 过滤分隔符', () => {
        expect(visit(make_ast('Param', [make_ast('Identifier', ['x']), ':', make_ast('NumberType', [], [])]), BlockVisitor)).toBeTruthy()
        expect(visit(make_ast('ParamIdentifier', ['(', make_ast('Identifier', ['x']), ')']), BlockVisitor)).toBeTruthy()
    })
    it('EnumDataVisitor: 过滤 { }', () => {
        expect(visit(make_ast('EnumData', ['{', 'A', 'B', '}']), BlockVisitor).children).toEqual(['A', 'B'])
    })
    it('EnumVisitor: 过滤 enum', () => {
        expect(visit(make_ast('Enum', ['enum', make_ast('EnumData', ['A', 'B'])]), BlockVisitor)).toBeTruthy()
    })
})

// ==================== 集成: CST → AST (File 级别) ====================
describe('集成: CST→File→AST', () => {
    function flatten_cst(cst: any): any[] {
        if (Array.isArray(cst)) { const o: any[] = []; for (const i of cst) o.push(...flatten_cst(i)); return o }
        if (cst && typeof cst === 'object' && 'value' in cst && 'type' in cst) return [cst]
        return []
    }
    // 用 File 级别的 ASTParser (from index.ts) 做完整流水线
    it('link → File AST', () => {
        const cst = cst_gen(cst_link, [t('link'), t('('), id('a'), t('.'), id('b'), t(')'), t('as'), id('c')])
        const s = new ASTStream(Array.isArray(cst) ? cst : [cst])
        const ast = ASTParser(s)
        expect(ast.type).toBe('File')
    })
    it('Type: number → File AST', () => {
        const cst = cst_gen(cst_Type, [t('number')])
        const flat = flatten_cst(cst)
        const s = new ASTStream(flat)
        ast_Type.stream = s
        ast_Type.match()
        const ast = $.visit(ast_Type.generate(), IdentifierVisitor)
        expect(ast.type).toBe('Type')
    })
    it('Type: number[] → File AST', () => {
        const cst = cst_gen(cst_Type, [t('number'), t('['), t(']')])
        const flat = flatten_cst(cst)
        const s = new ASTStream(flat)
        ast_Type.stream = s
        ast_Type.match()
        const ast = $.visit(ast_Type.generate(), IdentifierVisitor)
        expect(ast.type).toBe('Type')
    })
})
