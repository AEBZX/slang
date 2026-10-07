import {describe, expect, it} from 'vitest'
import desugar from '../../desugar'
import {render} from './helper'
import {
    AddExpression,
    AddressPrefix,
    AndExpression,
    ArgumentsPostfix,
    ArrayExpression,
    BooleanLiteral,
    ClassType,
    IdentifierExpr,
    IncrementPostfix,
    IndexPostfix,
    LambdaExpression,
    LogicAndExpression,
    LogicOrExpression,
    MapExpression,
    MemberPostfix,
    MinusPrefix,
    NewPrefix,
    NumberLiteral,
    NumberType,
    OrExpression,
    Return,
    StringLiteral,
    TernaryExpression,
    VoidType
} from '../../utils'

//脱糖一个节点并渲染
const D = (n: any) => render(desugar.run([n])[0])
const id = (s: string) => new IdentifierExpr(s)
const num = (s: string) => new NumberLiteral(s)

//给节点挂上 check 层算出来的运算符重载 / 类型转换标记
const with_oper = <T,>(n: T, oper: string): T => {
    (n as any).oper = oper
    return n
}
const with_cast = <T,>(n: T, cast: string): T => {
    (n as any).cast = cast
    return n
}
//一个必然会被脱糖的内部节点(MemberPostfix 在表里),两段 cast 名渲染成点路径
const inner = () => with_cast(new MemberPostfix(id('x'), 'y'), 'C.cast@0')

describe('desugar/表达式·oper 与 cast', () => {
    it('既没有 oper 也没有 cast 的节点原样返回,不会被丢掉', () => {
        const n = new AddExpression(id('a'), id('b'))
        expect(D(n)).toBe('(a+b)')
        expect(desugar.run([n])[0]).toBe(n)
    })

    it('oper 脱糖成对运算符函数的调用,实参取地址', () => {
        expect(D(with_oper(new AddExpression(id('a'), id('b')), 'std.add@0')))
            .toBe('((std.add@0)((&a),(&b)))')
    })

    it('单段的 oper 直接就是标识符', () => {
        expect(D(with_oper(new AddExpression(id('a'), id('b')), 'add@0')))
            .toBe('(add@0((&a),(&b)))')
    })

    it('cast 脱糖成对转换函数的调用,实参不取地址', () => {
        expect(D(with_cast(new AddExpression(id('a'), id('b')), 'number.cast@0')))
            .toBe('((number.cast@0)((a+b)))')
    })

    it('oper 优先于 cast', () => {
        const n = with_cast(with_oper(new AddExpression(id('a'), id('b')), 'std.add@0'), 'number.cast@0')
        expect(D(n)).toBe('((std.add@0)((&a),(&b)))')
    })

    it('空字符串的 oper/cast 视为没有', () => {
        const n = new AddExpression(id('a'), id('b'))
        ;(n as any).oper = ''
        ;(n as any).cast = ''
        expect(D(n)).toBe('(a+b)')
    })

    it('一元节点的 oper 脱糖只有一个实参', () => {
        expect(D(with_oper(new IncrementPostfix(id('a')), 'A.inc@1')))
            .toBe('((A.inc@1)((&a)))')
    })
})

describe('desugar/表达式·前缀', () => {
    it('负号展开成 0 减', () => {
        expect(D(new MinusPrefix(id('a')))).toBe('(0-a)')
    })

    it('负号的内部表达式先脱糖', () => {
        expect(D(new MinusPrefix(with_oper(new AddExpression(id('a'), id('b')), 'std.add@0'))))
            .toBe('(0-((std.add@0)((&a),(&b))))')
    })

    it('new 直接解包成被创建的对象', () => {
        expect(D(new NewPrefix(id('A')))).toBe('A')
    })

    it('取地址等其它前缀原样保留', () => {
        expect(D(new AddressPrefix(id('a')))).toBe('(&a)')
    })

    it('前缀内部先脱糖', () => {
        expect(D(new AddressPrefix(with_oper(new AddExpression(id('a'), id('b')), 'std.add@0'))))
            .toBe('(&((std.add@0)((&a),(&b))))')
    })
})

describe('desugar/表达式·逻辑短路', () => {
    it('逻辑与展开成三目:a ? (a & b) : false', () => {
        expect(D(new LogicAndExpression(id('a'), id('b')))).toBe('(a?(a&b):false)')
    })

    it('逻辑或展开成三目:a ? false : (a | b)', () => {
        expect(D(new LogicOrExpression(id('a'), id('b')))).toBe('(a?false:(a|b))')
    })

    it('按位与/或不受影响', () => {
        expect(D(new AndExpression(id('a'), id('b')))).toBe('(a&b)')
        expect(D(new OrExpression(id('a'), id('b')))).toBe('(a|b)')
    })

    it('短路展开时左侧两个位置用的是同一个脱糖结果', () => {
        expect(D(new LogicAndExpression(inner(), id('b'))))
            .toBe('(((C.cast@0)((x.y)))?(((C.cast@0)((x.y)))&b):false)')
    })

    it('短路展开后的右侧也没有 oper/cast 时保持原样', () => {
        expect(D(new LogicOrExpression(id('a'), inner())))
            .toBe('(a?false:(a|((C.cast@0)((x.y)))))')
    })
})

describe('desugar/表达式·调用', () => {
    it('实参逐个脱糖', () => {
        expect(D(new ArgumentsPostfix(id('f'), [], [num('1'), inner()])))
            .toBe('(f(1,((C.cast@0)((x.y)))))')
    })

    it('call_target 把 callee 换成点路径', () => {
        const n = new ArgumentsPostfix(id('f'), [], [num('1')])
        n.call_target = 'std.math.abs'
        expect(D(n)).toBe('(((std.math).abs)(1))')
    })

    it('call_target 连同泛型实参一起保留', () => {
        const n = new ArgumentsPostfix(id('f'), [new NumberType()], [num('1')])
        n.call_target = 'std.math.abs'
        expect(D(n)).toBe('(((std.math).abs)<number>(1))')
    })

    it('callee 也会先脱糖', () => {
        const n = new ArgumentsPostfix(inner(), [], [num('1')])
        expect(D(n)).toBe('(((C.cast@0)((x.y)))(1))')
    })

    it('调用类型为 ClassType 的对象成员时把对象本身追加为最后一个实参', () => {
        const owner = id('obj')
        owner.type = new ClassType(['A'])
        expect(D(new ArgumentsPostfix(new MemberPostfix(owner, 'f'), [], [num('1')])))
            .toBe('((obj.f)(1,obj))')
    })

    it('对象成员调用再加上 call_target 时不会再补 this', () => {
        const owner = id('obj')
        owner.type = new ClassType(['A'])
        const n = new ArgumentsPostfix(new MemberPostfix(owner, 'f'), [], [num('1')])
        n.call_target = 'A.f'
        expect(D(n)).toBe('((A.f)(1,obj))')
    })

    it('callee 不是 ClassType 成员时不追加 this', () => {
        expect(D(new ArgumentsPostfix(new MemberPostfix(id('obj'), 'f'), [], [num('1')])))
            .toBe('((obj.f)(1))')
    })

    it('普通的直接调用不追加 this', () => {
        expect(D(new ArgumentsPostfix(id('f'), [], [num('1')]))).toBe('(f(1))')
    })
})

describe('desugar/表达式·递归', () => {
    it('成员访问的基对象会脱糖', () => {
        expect(D(new MemberPostfix(inner(), 'b'))).toBe('(((C.cast@0)((x.y))).b)')
    })

    it('下标的基对象与下标都会脱糖', () => {
        expect(D(new IndexPostfix(inner(), inner()))).toBe('(((C.cast@0)((x.y)))[((C.cast@0)((x.y)))])')
    })

    it('数组元素会脱糖', () => {
        expect(D(new ArrayExpression([num('1'), inner()]))).toBe('[1,((C.cast@0)((x.y)))]')
    })

    it('Map 的值会脱糖', () => {
        expect(D(new MapExpression(new Map([['k', inner()]])))).toBe('[k:((C.cast@0)((x.y)))]')
    })

    it('lambda 的体会脱糖', () => {
        const n = new LambdaExpression(new Map(), new Map(), new VoidType(), new Return(inner()))
        expect(D(n)).toBe('()=>void{return ((C.cast@0)((x.y)));}')
    })

    it('三目的三个子表达式都会脱糖', () => {
        expect(D(new TernaryExpression(inner(), inner(), inner())))
            .toBe('(((C.cast@0)((x.y)))?((C.cast@0)((x.y))):((C.cast@0)((x.y))))')
    })

    it('字面量不需要脱糖', () => {
        expect(D(num('1'))).toBe('1')
        expect(D(new StringLiteral('s'))).toBe('"s"')
        expect(D(new BooleanLiteral('true'))).toBe('true')
    })

    it('标识符上的 cast 会被脱糖', () => {
        expect(D(with_cast(id('a'), 'c@0'))).toBe('(c@0(a))')
    })

    it('调用实参里标识符上的 cast 会被脱糖', () => {
        expect(D(new ArgumentsPostfix(id('f'), [], [with_cast(id('x'), 'c@0')])))
            .toBe('(f((c@0(x))))')
    })

    it('成员访问基对象上的 cast 会被脱糖', () => {
        expect(D(new MemberPostfix(with_cast(id('a'), 'c@0'), 'b'))).toBe('((c@0(a)).b)')
    })
})
