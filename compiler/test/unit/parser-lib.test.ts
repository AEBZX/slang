import {describe, expect, it} from 'vitest'
import Parser, {$} from '../../utils/lib/parser'
import {ast_data, ast_rule, ASTTree, TokenType} from '../../utils'
import {lex_src} from './helper'

//用一个「原样返回 cst」的生成器跑规则,这样能直接断言 CST 结构本身
function cst(rule: ast_rule, code: string): any {
    const p = new Parser().use([rule]).use(((data: ast_data) => data) as any)
    return p.run([lex_src(code)])[0]
}

describe('parser/规则引擎', () => {
    it('seg 按出现顺序占 child 槽位', () => {
        const r = $.s('S', TokenType.Number, TokenType.String)
        const d = cst(r, '1 "a"')
        expect(d.type).toBe('S')
        expect(d.children.get(0)).toBe('1')
        expect(d.children.get(1)).toBe('a')
    })

    it('delete 规则只做字面量匹配,不占 child 槽位', () => {
        const r = $.s('S', TokenType.Number, $.d(','), TokenType.String)
        const d = cst(r, '1,"a"')
        //若 delete 占了槽位,第二个值会落在 2 而不是 1
        expect(d.children.get(0)).toBe('1')
        expect(d.children.get(1)).toBe('a')
        expect(d.children.size).toBe(2)
    })

    it('delete 匹配失败时整条规则失败', () => {
        const r = $.s('S', TokenType.Number, $.d(','), TokenType.String)
        expect(() => cst(r, '1 "a"')).toThrow()
    })

    it('字面量不匹配时报出期望的 token 与位置', () => {
        const r = $.s('S', $.d('class'))
        expect(() => cst(r, 'module')).toThrow(/class/)
    })

    it('child 规则解包出内部的规则节点', () => {
        const inner = $.s('Inner', TokenType.Number)
        const r = $.s('S', $.t('(', $.r('Inner'), ')'), TokenType.String)
        const p = new Parser().use([r, inner]).use(((data: ast_data) => data) as any)
        const d = p.run([lex_src('(1)"a"')])[0]
        expect(d.children.get(0).type).toBe('Inner')
        expect(d.children.get(1)).toBe('a')
    })

    it('child 规则内全是 token 时没有可解包的节点,得到空壳', () => {
        const r = $.s('S', $.t('(', TokenType.Number, ')'))
        const d = cst(r, '(1)')
        expect(d.children.get(0).type).toBe(null)
        expect(d.children.get(0).children.size).toBe(0)
    })

    it('or 按顺序尝试,失败回退到下一个分支', () => {
        const r = $.o('O', $.s('A', TokenType.Number), $.s('B', TokenType.String))
        expect(cst(r, '1').type).toBe('A')
        expect(cst(r, '"x"').type).toBe('B')
    })

    it('or 的回退会还原游标:前面的失败分支不吃掉后续 token', () => {
        const r = $.s('S',
            $.o('O', $.s('A', TokenType.Number), $.s('B', TokenType.String)),
            TokenType.String)
        const d = cst(r, '"x""y"')
        expect(d.children.get(0).type).toBe('B')
        expect(d.children.get(1)).toBe('y')
    })

    it('or 全部分支失败时抛错', () => {
        const r = $.o('O', $.s('A', TokenType.Number), $.s('B', TokenType.String))
        expect(() => cst(r, 'true')).toThrow(/无法找到/)
    })

    it('choose 全部失败时返回 null 而不抛错', () => {
        const r = $.s('S', $.c(TokenType.Number), TokenType.String)
        const d = cst(r, '"a"')
        //choose 没匹配就不占槽位
        expect(d.children.get(0)).toBe('a')
        expect(d.children.size).toBe(1)
    })

    it('choose 不把 delete 的包装当成结果', () => {
        const r = $.s('S', $.c($.d('<'), TokenType.Number, $.d('>')), TokenType.String)
        const d = cst(r, '<7>"a"')
        expect(d.children.get(0)).toBe('7')
    })

    it('while 规则:元素 + 分隔符交替,收尾处静默停止', () => {
        const r = $.s('S', $.w('W', TokenType.Number, ','))
        expect(cst(r, '1,2,3').children.get(0).children.size).toBe(3)
        expect(cst(r, '1').children.get(0).children.size).toBe(1)
        expect(cst(r, '').children.get(0).children.size).toBe(0)
    })

    it('while 规则遇到不匹配的分隔符时保留已收元素', () => {
        const r = $.s('S', $.w('W', TokenType.Number, ','), TokenType.String)
        const d = cst(r, '1,2"a"')
        expect(d.children.get(0).type).toBe('W')
        expect(d.children.get(0).children.size).toBe(2)
        expect(d.children.get(1)).toBe('a')
    })

    it('loop 规则重复到无法前进为止', () => {
        const r = $.s('S', $.l('L', TokenType.Number))
        expect(cst(r, '1 2 3').children.get(0).children.size).toBe(3)
        expect(cst(r, '').children.get(0).children.size).toBe(0)
    })

    it('call 规则按名字引用其他规则', () => {
        const inner = $.s('Inner', TokenType.Number)
        const outer = $.s('Outer', $.r('Inner'), TokenType.String)
        const p = new Parser().use([outer, inner]).use(((data: ast_data) => data) as any)
        const d = p.run([lex_src('1"a"')])[0]
        expect(d.children.get(0).type).toBe('Inner')
    })

    it('引用不存在的规则会抛错', () => {
        const outer = $.s('Outer', $.r('Missing'))
        const p = new Parser().use([outer]).use(((data: ast_data) => data) as any)
        expect(() => p.run([lex_src('1')])).toThrow()
    })

    it('注释 token 不参与解析', () => {
        const r = $.s('S', TokenType.Number, TokenType.String)
        expect(() => cst(r, '1 // 注释\n "a"')).not.toThrow()
        expect(() => cst(r, '1 /* 块注释 */ "a"')).not.toThrow()
        const d = cst(r, '/* x */ 1 "a" // tail')
        expect(d.children.get(0)).toBe('1')
        expect(d.children.get(1)).toBe('a')
    })

    it('还有剩余 token 时报错,而不是产出截断的结果', () => {
        const r = $.s('S', TokenType.Number)
        expect(() => cst(r, '1 2')).toThrow(/未解析的 token/)
    })

    it('生成节点会继承 cst 的行信息', () => {
        const r = $.s('S', TokenType.Number, TokenType.String)
        const p = new Parser().use([r]).use(new Map<string, any>([['S', () => new ASTTree()]]))
        const n: any = p.run([lex_src('1 "a"')])[0]
        expect(n.line.join('')).toContain('1 "a"')
    })

    it('没有入口规则时抛错', () => {
        const p = new Parser().use(new Map())
        expect(() => p.run([lex_src('1')])).toThrow(/入口规则不存在/)
    })

    it('run 逐文件解析,每个文件一棵树', () => {
        const r = $.s('S', TokenType.Number)
        const p = new Parser().use([r]).use(((data: ast_data) => data) as any)
        const out = p.run([lex_src('1'), lex_src('2')])
        expect(out.length).toBe(2)
        expect(out[0].children.get(0)).toBe('1')
        expect(out[1].children.get(0)).toBe('2')
    })
})
