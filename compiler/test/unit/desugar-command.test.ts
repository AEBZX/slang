import {describe, expect, it} from 'vitest'
import desugar from '../../src/desugar'
import {render} from './helper'
import {
    AAssign,
    AddAssign,
    AddExpression,
    AndAssign,
    Await,
    BooleanType,
    Case,
    DoWhileStatement,
    DivAssign,
    ExprCommand,
    ForeachStatement,
    ForStatement,
    IdentifierExpr,
    IfStatement,
    IncrementPostfix,
    ListCommand,
    ModAssign,
    MulAssign,
    NullLiteral,
    NumberLiteral,
    NumberType,
    OrAssign,
    ShlAssign,
    ShrAssign,
    CharType,
    SubAssign,
    SwitchStatement,
    Throw,
    TryStatement,
    VarDecl,
    VM,
    WhileStatement,
    XorAssign
} from '../../src/utils'

//脱糖一个节点并渲染。try 的 catch/finally/throw 名字带自己的序号,统一归一化掉
const D = (n: any) => render(desugar.run([n])[0])
    .replace(/(catch|finally|throw)@\d+/g, '$1@N')
    .replace(/(while|break)@\d+/g, '$1@N')
const id = (s: string) => new IdentifierExpr(s)
const num = (s: string) => new NumberLiteral(s)
const list = (...c: any[]) => new ListCommand(c)
//做条件用的标识符,type 决定要不要补 != null
const cond = (bool = false) => {
    const e = id('c')
    if (bool) (e as any).type = new BooleanType()
    return e
}

describe('desugar/命令·赋值', () => {
    it('普通赋值保持不变', () => {
        expect(D(new AAssign(id('a'), num('1')))).toBe('a=1;')
    })

    it('复合赋值展开成 赋值 + 二元运算', () => {
        expect(D(new AddAssign(id('a'), num('1')))).toBe('a=(a+1);')
        expect(D(new SubAssign(id('a'), num('1')))).toBe('a=(a-1);')
        expect(D(new MulAssign(id('a'), num('1')))).toBe('a=(a*1);')
        expect(D(new DivAssign(id('a'), num('1')))).toBe('a=(a/1);')
        expect(D(new ModAssign(id('a'), num('1')))).toBe('a=(a%1);')
        expect(D(new ShlAssign(id('a'), num('1')))).toBe('a=(a<<1);')
        expect(D(new ShrAssign(id('a'), num('1')))).toBe('a=(a>>1);')
        expect(D(new AndAssign(id('a'), num('1')))).toBe('a=(a&1);')
        expect(D(new OrAssign(id('a'), num('1')))).toBe('a=(a|1);')
        expect(D(new XorAssign(id('a'), num('1')))).toBe('a=(a^1);')
    })

    it('展开后的赋值左侧与右侧用的是同一个脱糖结果', () => {
        const n = new AddAssign(id('a'), num('1'))
        const out = desugar.run([n])[0] as AAssign
        expect(out.data).toBe((out.value as any).left)
    })

    it('带 oper 的赋值脱糖成运算符调用语句', () => {
        const n = new AAssign(id('a'), num('1'))
        ;(n as any).oper = 'o@0'
        expect(D(n)).toBe('(o@0((&a),(&1)));')
    })

    it('带 oper 的复合赋值也走 oper,不再展开', () => {
        const n = new AddAssign(id('a'), num('1'))
        ;(n as any).oper = 'o@0'
        expect(D(n)).toBe('(o@0((&a),(&1)));')
    })
})

describe('desugar/命令·var 声明', () => {
    it('var 声明脱糖成对标识符的赋值', () => {
        expect(D(list(new VarDecl('a', new NumberType(), num('1'))))).toBe('a=1;')
    })

    it('没有初值的 var 声明脱糖成赋 null', () => {
        expect(D(list(new VarDecl('a', new NumberType(), null)))).toBe('a=null;')
    })

    it('var 声明的 oper 会转交给赋值', () => {
        const v = new VarDecl('a', new NumberType(), num('1'))
        ;(v as any).oper = 'o@0'
        expect(D(list(v))).toBe('(o@0((&a),(&1)));')
    })
})

describe('desugar/命令·throw', () => {
    it('throw 保留节点,由 HIR 的 try 机制处理', () => {
        expect(D(list(new Throw(id('e'))))).toBe('throw e;')
    })

    it('throw 的实参先脱糖', () => {
        const e = new AddExpression(id('a'), id('b'))
        ;(e as any).oper = 'o@0'
        expect(D(list(new Throw(e)))).toBe('throw (o@0((&a),(&b)));')
    })
})

describe('desugar/命令·条件', () => {
    it('条件不是 boolean 时补 != null', () => {
        expect(D(new IfStatement(cond(), new ExprCommand(id('a')), null))).toBe('if((c!=null))a;')
        expect(D(new WhileStatement(cond(), new ExprCommand(id('a')))))
            .toBe('label while@N: if((c!=null))a; goto while@N;else goto break@N; label break@N:')
    })

    it('条件已经是 boolean 时不动', () => {
        expect(D(new IfStatement(cond(true), new ExprCommand(id('a')), null))).toBe('if(c)a;')
        expect(D(new WhileStatement(cond(true), new ExprCommand(id('a')))))
            .toBe('label while@N: if(c)a; goto while@N;else goto break@N; label break@N:')
    })

    it('if-else 两个分支都会脱糖', () => {
        expect(D(new IfStatement(cond(true), new ExprCommand(id('a')), new ExprCommand(id('b')))))
            .toBe('if(c)a;else b;')
    })
})

describe('desugar/命令·循环', () => {
    it('do-while 先做一遍,再按条件回到循环头', () => {
        expect(D(new DoWhileStatement(new ExprCommand(id('a')), cond(true))))
            .toBe('label while@N: a; if(c)goto while@N;else goto break@N; label break@N:')
    })

    it('for 展开成「初始化 + while(条件){体;步进}」', () => {
        expect(D(new ForStatement(
            [new VarDecl('i', new NumberType(), num('0'))],
            cond(true),
            [new ExprCommand(new IncrementPostfix(id('i')))],
            new ExprCommand(id('body')))))
            .toBe('i=0; label while@N: if(c)body; (i++); goto while@N;else goto break@N; label break@N:')
    })

    it('for 的初始化与步进都可以为空', () => {
        expect(D(new ForStatement([], cond(true), [], new ExprCommand(id('body')))))
            .toBe('label while@N: if(c)body; goto while@N;else goto break@N; label break@N:')
    })

    it('foreach 展开成带下标的 for', () => {
        expect(D(new ForeachStatement('c', id('s'), new ExprCommand(id('body')))))
            .toBe('for=0; c=null; label while@N: if(((s[for])!=null))c=(s[for]); body; (for++); goto while@N;else goto break@N; label break@N:')
    })

    //循环条件本身已经是布尔,不该再包一层 != null(以前包了两层,条件恒真,循环永不结束)
    it('foreach 的条件只包一层 != null', () => {
        const out = D(new ForeachStatement('c', id('s'), new ExprCommand(id('body'))))
        expect(out).toContain('(s[for])!=null')
        expect(out).not.toContain(')!=null)!=null')
    })

    it('foreach 的循环变量初值是 null,条件是与 null 比较', () => {
        const n = new ForeachStatement('c', id('s'), new ExprCommand(id('body')))
        const out = desugar.run([n])[0] as ListCommand
        //[for 声明, c 声明, while]
        expect(out.commands.length).toBe(3)
        expect((out.commands[0] as AAssign).data).toBeInstanceOf(IdentifierExpr)
        expect((out.commands[1] as AAssign).value).toBeInstanceOf(NullLiteral)
    })

    //switch 现在会展开成 if-else 链:条件先存进临时变量,避免每个 case 重复求值
    //临时变量名带全局序号,断言时归一化掉
    const norm = (s: string) => s.replace(/switch@\d+/g, 'switch@N')
    it('switch 展开成 if-else 链', () => {
        expect(norm(D(new SwitchStatement(cond(true), [new Case(num('1'), new ExprCommand(id('a')))], null))))
            .toBe('switch@N=c; if((switch@N==1))a;else ')
    })

    it('多个 case 按顺序串成 else-if', () => {
        expect(norm(D(new SwitchStatement(cond(true), [
            new Case(num('1'), new ExprCommand(id('a'))),
            new Case(num('2'), new ExprCommand(id('b')))
        ], null)))).toBe('switch@N=c; if((switch@N==1))a;else if((switch@N==2))b;else ')
    })

    it('有 default 时挂在最后一级 else', () => {
        expect(norm(D(new SwitchStatement(cond(true), [new Case(num('1'), new ExprCommand(id('a')))],
            new ExprCommand(id('d'))))))
            .toBe('switch@N=c; if((switch@N==1))a;else d;')
    })
})

describe('desugar/命令·try', () => {
    it('try 保留节点,只脱糖三个子块', () => {
        expect(D(new TryStatement(
            list(new ExprCommand(id('a'))),
            {iden: 'e', type: new CharType(), command: new ExprCommand(id('b'))},
            new ExprCommand(id('c')))))
            .toBe('try{a;}catch(e:string){b;}finally{c;}')
    })

    it('没有 finally 时保留为无 finally 的 try', () => {
        expect(D(new TryStatement(
            list(new ExprCommand(id('a'))),
            {iden: 'e', type: new CharType(), command: new ExprCommand(id('b'))},
            null)))
            .toBe('try{a;}catch(e:string){b;}')
    })

    it('try 体里的 throw 保持为 throw,不再展开标志', () => {
        expect(D(new TryStatement(
            list(new ExprCommand(id('a')), new Throw(id('x')), new ExprCommand(id('b'))),
            {iden: 'e', type: new CharType(), command: new ExprCommand(id('h'))},
            null)))
            .toBe('try{a; throw x; b;}catch(e:string){h;}')
    })

    it('catch/finally 体内的命令也会脱糖', () => {
        const e = new AddExpression(id('a'), id('b'))
        ;(e as any).oper = 'o@0'
        expect(D(new TryStatement(
            list(new ExprCommand(id('a'))),
            {iden: 'e', type: new CharType(), command: new ExprCommand(e)},
            null)))
            .toBe('try{a;}catch(e:string){(o@0((&a),(&b)));}')
    })
})

describe('desugar/命令·其它', () => {
    it('await 内部的命令会脱糖', () => {
        expect(D(new Await(new ExprCommand(id('a'))))).toBe('await a;')
    })

    it('vm 的参数会脱糖', () => {
        expect(D(new VM('out %d', [id('a')]))).toBe('vm("out %d",a);')
        expect(D(new VM('out', []))).toBe('vm("out");')
    })

    it('列表逐条脱糖并保持顺序', () => {
        expect(D(list(new ExprCommand(id('a')), new ExprCommand(id('b'))))).toBe('a; b;')
    })
})