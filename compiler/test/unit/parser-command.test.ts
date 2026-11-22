import {describe, expect, it} from 'vitest'
import parser from '../../src/parser'
import {lexer, tokens} from '../../src/utils'
import {
    AddAssign, AAssign, Break, Continue, Delete, DoWhileStatement, Expression, ForeachStatement,
    ForStatement, GotoCommand, IfStatement, LabelCommand, ListCommand, NumberLiteral, Return,
    SwitchStatement, Throw, TryStatement, VarDecl, VM, WhileStatement
} from '../../src/utils'

const parse_body = (src: string) => {
    const file = parser.run([lexer(`m: void() { ${src} }`, tokens)])[0] as any
    const commands = file.children[0].commands
    return commands instanceof ListCommand ? commands.commands : [commands]
}

describe('parser 语句', () => {
    it('变量声明', () => {
        const [decl] = parse_body('var x: number = 1;') as any[]
        expect(decl).toBeInstanceOf(VarDecl)
        expect(decl.name).toBe('x')
        expect(decl.value).toBeInstanceOf(NumberLiteral)
    })

    it('赋值与复合赋值', () => {
        const [assign] = parse_body('x = 1;') as any[]
        expect(assign).toBeInstanceOf(AAssign)
        const [add] = parse_body('x += 1;') as any[]
        expect(add).toBeInstanceOf(AddAssign)
    })

    it('if/else', () => {
        const [if_stmt] = parse_body('if (c) { a(); } else { b(); }') as any[]
        expect(if_stmt).toBeInstanceOf(IfStatement)
        expect(if_stmt.else_).toBeDefined()
    })

    it('while 与 do-while', () => {
        expect(parse_body('while (c) { }')[0]).toBeInstanceOf(WhileStatement)
        const [do_while] = parse_body('do { } while (c);') as any[]
        expect(do_while).toBeInstanceOf(DoWhileStatement)
    })

    it('for 语句拆解出 init/condition/step', () => {
        const [for_stmt] = parse_body('for (var i: number = 0; i < 3; i = i + 1;) { }') as any[]
        expect(for_stmt).toBeInstanceOf(ForStatement)
        expect(for_stmt.init).toHaveLength(1)
        expect(for_stmt.init[0]).toBeInstanceOf(VarDecl)
        expect(for_stmt.condition).toBeDefined()
        expect(for_stmt.step).toHaveLength(1)
    })

    it('foreach 语句', () => {
        const [foreach] = parse_body('foreach (v: data) { }') as any[]
        expect(foreach).toBeInstanceOf(ForeachStatement)
        expect(foreach.iden).toBe('v')
    })

    it('switch 的 case 与 default', () => {
        const [switch_stmt] = parse_body('switch (x) { case 1 => { } default => { } }') as any[]
        expect(switch_stmt).toBeInstanceOf(SwitchStatement)
        expect(switch_stmt.case_list).toHaveLength(1)
        expect(switch_stmt.default_).toBeDefined()
    })

    it('try/catch/finally', () => {
        const [try_stmt] = parse_body('try { } catch (e: number) { } finally { }') as any[]
        expect(try_stmt).toBeInstanceOf(TryStatement)
        expect(try_stmt.catch_.iden).toBe('e')
        expect(try_stmt.finally_).toBeDefined()
    })

    it('label 与 goto', () => {
        const commands = parse_body('lbl: goto lbl;')
        expect(commands[0]).toBeInstanceOf(LabelCommand)
        expect(commands[1]).toBeInstanceOf(GotoCommand)
        expect((commands[1] as GotoCommand).name).toBe('lbl')
    })

    it('vm 内联指令', () => {
        const [vm_stmt] = parse_body('vm("add", 1, 2, 3);') as any[]
        expect(vm_stmt).toBeInstanceOf(VM)
        expect(vm_stmt.data).toBe('add')
        expect(vm_stmt.param).toHaveLength(3)
    })

    it('return/break/continue/throw/delete', () => {
        const commands = parse_body('return 1; break; continue; throw e; delete x;')
        expect(commands[0]).toBeInstanceOf(Return)
        expect(commands[1]).toBeInstanceOf(Break)
        expect(commands[2]).toBeInstanceOf(Continue)
        expect(commands[3]).toBeInstanceOf(Throw)
        expect(commands[4]).toBeInstanceOf(Delete)
        expect((commands[0] as Return).data).toBeInstanceOf(Expression)
    })
})
