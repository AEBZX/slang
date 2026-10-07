import {describe, expect, it} from 'vitest'
import desugar from '../../desugar'
import {render} from './helper'
import {
    AddExpression,
    BooleanType,
    Class,
    ClassType,
    Enum,
    ExprCommand,
    File,
    Function,
    IdentifierExpr,
    Interface,
    LambdaExpression,
    LogicAndExpression,
    MapExpression,
    Modifier,
    Module,
    NumberType,
    Return,
    StringType,
    Value,
    Variable,
    VoidType,
    Cast,
    Operation,
    NumberLiteral
} from '../../utils'

//脱糖一个节点并渲染
const D = (n: any) => render(desugar.run([n])[0])
const id = (s: string) => new IdentifierExpr(s)
const num = (s: string) => new NumberLiteral(s)
//缺省修饰符,写 ? 便于看清脱糖本身的结果
const mod = () => new Modifier(null, null, null)
const inst = () => new Modifier(true, null, null)
const lambda = (ret: any = new VoidType(), body: any = new Return(id('a'))) =>
    new LambdaExpression(new Map(), new Map([['x', new NumberType()]]), ret, body)

describe('desugar/块·File 与 Module', () => {
    it('File 的 children 会递归脱糖', () => {
        expect(D(new File([], [new Module(mod(), 'm', [])]))).toBe('|[?,?,?]m:module{}')
    })

    it('Module 的 children 会递归脱糖', () => {
        expect(D(new Module(mod(), 'm', [new Module(mod(), 'n', [])])))
            .toBe('[?,?,?]m:module{[?,?,?]n:module{}}')
    })

    it('同名模块不做合并(合并是 check 层的事)', () => {
        expect(D(new Module(mod(), 'm', [new Module(mod(), 'm', [])])))
            .toBe('[?,?,?]m:module{[?,?,?]m:module{}}')
    })
})

describe('desugar/块·Value 重载块', () => {
    it('value number 变成名为 number 的模块', () => {
        expect(D(new Value(new NumberType(), []))).toBe('[static,sync,public]number:module{}')
    })

    it('value string / value boolean', () => {
        expect(D(new Value(new StringType(), []))).toBe('[static,sync,public]string:module{}')
        expect(D(new Value(new BooleanType(), []))).toBe('[static,sync,public]boolean:module{}')
    })

    it('非字面量类型退化成空名字的模块(由 check 层的 Check_Value 拦下)', () => {
        expect(D(new Value(new ClassType(['A']), []))).toBe('[static,sync,public]:module{}')
    })

    it('value 块的修饰符固定为 static/public', () => {
        const out = desugar.run([new Value(new NumberType(), [])])[0] as Module
        expect(out.modifiers.unstatic).toBe(false)
        expect(out.modifiers._private).toBe(false)
    })
})

describe('desugar/块·Operation 与 Cast', () => {
    const oper = (): Operation => {
        const o = new Operation('+', lambda(new NumberType()))
        o.index = 3
        o.local = []
        return o
    }
    const cast = (): Cast => {
        const c = new Cast(new NumberType(), lambda(new NumberType()))
        c.id = 7
        c.local = []
        return c
    }

    it('operation 和普通函数一样脱糖成 Variable,名字是「运算符@序号」', () => {
        const out: any = desugar.run([oper()])[0]
        expect(out).toBeInstanceOf(Variable)
        expect(out.name).toBe('+@3')
        expect(D(oper())).toBe('[static,sync,public]+@3:()=>null=(x:number,:?)=>number{return a;};')
    })

    it('cast 和普通函数一样脱糖成 Variable,名字是「cast@序号」', () => {
        const out: any = desugar.run([cast()])[0]
        expect(out).toBeInstanceOf(Variable)
        expect(out.name).toBe('cast@7')
        expect(D(cast())).toBe('[static,sync,public]cast@7:()=>null=(x:number,:?)=>number{return a;};')
    })

    it('operation 的 lambda 体会脱糖', () => {
        const e = new AddExpression(id('a'), id('b'))
        ;(e as any).oper = 'o@0'
        const o = oper()
        o.command = lambda(new NumberType(), new Return(e))
        expect(D(o)).toContain('return (o@0((&a),(&b)));')
    })
})

describe('desugar/块·Function', () => {
    const fn = (ret: any = new VoidType(), params = new Map([['a', new NumberType()]])) =>
        new Function(mod(), 'f', new Map(), params, ret, new ExprCommand(id('b')))

    it('函数脱糖成 Variable,值是 lambda', () => {
        const out = desugar.run([fn()])[0]
        expect(out).toBeInstanceOf(Variable)
        expect((out as Variable).value).toBeInstanceOf(LambdaExpression)
    })

    it('名字带上重载序号', () => {
        expect(D(fn())).toContain('f@0')
        const f = fn()
        f.index = 2
        expect(D(f)).toContain('f@2')
    })

    it('参数表末尾补一个隐式 this 槽', () => {
        const out = desugar.run([fn()])[0] as Variable
        const params = ((out.value as LambdaExpression).params)
        expect(params.has('')).toBe(true)
        expect(params.get('')).toBeInstanceOf(ClassType)
    })

    it('返回 void 时在函数体末尾补 return this', () => {
        expect(D(fn())).toBe('[?,?,?]f@0:()=>null=(a:number,:?)=>void{b; return this;};')
    })

    it('返回非 void 时不补 return this', () => {
        expect(D(fn(new NumberType()))).toBe('[?,?,?]f@0:()=>null=(a:number,:?)=>number{b;};')
    })

    it('声明的类型是占位用的空 lambda 类型,真正的类型在值上', () => {
        const out = desugar.run([fn(new NumberType())])[0] as Variable
        expect((out.t as any).params).toBe(null)
        expect(((out.value as LambdaExpression).ret)).toBeInstanceOf(NumberType)
    })

    it('函数体先脱糖', () => {
        const e = new AddExpression(id('a'), id('b'))
        ;(e as any).oper = 'o@0'
        const f = new Function(mod(), 'f', new Map(), new Map(), new VoidType(), new ExprCommand(e))
        expect(D(f)).toContain('(o@0((&a),(&b)));')
    })
})

describe('desugar/块·Interface 与 Enum', () => {
    it('接口脱糖成类', () => {
        const out = desugar.run([new Interface(mod(), 'I', new Map(), null, [])])[0]
        expect(out).toBeInstanceOf(Class)
        expect(D(new Interface(mod(), 'I', new Map(), null, []))).toBe('[?,?,?]I:class{}')
    })

    it('枚举脱糖成类,成员是初值为 null 的 void 变量', () => {
        expect(D(new Enum(mod(), 'E', ['A', 'B'])))
            .toBe('[?,?,?]E:class{[static,sync,public]A:void=null;[static,sync,public]B:void=null;}')
    })

    it('空枚举脱糖成空类', () => {
        expect(D(new Enum(mod(), 'E', []))).toBe('[?,?,?]E:class{}')
    })
})

describe('desugar/块·Class 与实例成员', () => {
    it('类的成员会递归脱糖', () => {
        const c = new Class(mod(), 'C', new Map(), null, [
            new Variable(mod(), 'v', new NumberType(), num('1'))])
        expect(D(c)).toBe('[?,?,?]C:class{[?,?,?]v:number=1;}')
    })

    it('静态成员不加 this', () => {
        const c = new Class(mod(), 'C', new Map(), null, [
            new Function(mod(), 'f', new Map(), new Map(), new NumberType(), new ExprCommand(id('b')))])
        expect(D(c)).toBe('[?,?,?]C:class{[?,?,?]f@0:()=>null=(:?)=>number{b;};}')
    })

    it('实例方法给 lambda 补 this 参数', () => {
        const c = new Class(mod(), 'C', new Map(), null, [
            new Function(inst(), 'f', new Map(), new Map(), new NumberType(), new ExprCommand(id('b')))])
        expect(D(c)).toBe('[?,?,?]C:class{[unstatic,?,?]f@0:()=>null=(:?,this:?)=>number{b;};}')
    })

    it('实例变量作为 lambda 初值时也补 this 参数', () => {
        const value = new LambdaExpression(null, new Map(), new VoidType(), new ExprCommand(id('b')))
        const c = new Class(mod(), 'C', new Map(), null, [
            new Variable(inst(), 'f', new NumberType(), value)])
        expect(D(c)).toBe('[?,?,?]C:class{[unstatic,?,?]f:number=(this:?)=>void{b;};}')
    })

    it('静态成员不会被加 this', () => {
        const value = new LambdaExpression(null, new Map(), new VoidType(), new ExprCommand(id('b')))
        const c = new Class(mod(), 'C', new Map(), null, [
            new Variable(mod(), 'f', new NumberType(), value)])
        expect(D(c)).toBe('[?,?,?]C:class{[?,?,?]f:number=()=>void{b;};}')
    })

    it('块级变量初值里的逻辑与会展开成三目', () => {
        const c = new Class(mod(), 'C', new Map(), null, [
            new Variable(mod(), 'v', new BooleanType(), new LogicAndExpression(id('a'), id('b')))])
        expect(D(c)).toContain('(a?(a&b):false)')
    })

    it('块级变量初值里的 oper 会脱糖成运算符调用', () => {
        const e = new AddExpression(id('a'), id('b'))
        ;(e as any).oper = 'o@0'
        const c = new Class(mod(), 'C', new Map(), null, [
            new Variable(mod(), 'v', new NumberType(), e)])
        expect(D(c)).toContain('(o@0((&a),(&b)))')
    })

    it('块级变量声明上的 cast 会套到初值上', () => {
        const v = new Variable(mod(), 'v', new NumberType(), num('1'))
        ;(v as any).cast = 'C.cast@0'
        expect(D(v)).toBe('[?,?,?]v:number=((C.cast@0)(1));')
    })

    it('块级变量声明上的 oper 会带上变量自身作为左操作数', () => {
        const v = new Variable(mod(), 'v', new NumberType(), num('1'))
        ;(v as any).oper = 'C.set@0'
        expect(D(v)).toBe('[?,?,?]v:number=((C.set@0)((&v),(&1)));')
    })
})
