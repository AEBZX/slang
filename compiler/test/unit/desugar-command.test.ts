import {describe, expect, it} from 'vitest'
import desugar from '../../desugar'
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
    StringType,
    SubAssign,
    SwitchStatement,
    Throw,
    TryStatement,
    VarDecl,
    VM,
    WhileStatement,
    XorAssign
} from '../../utils'

//脱糖一个节点并渲染
const D = (n: any) => render(desugar.run([n])[0])
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
    it('throw 脱糖成调用 catch + 置位 throw 标志', () => {
        expect(D(list(new Throw(id('e'))))).toBe('(catch(e)); throw=true;')
    })

    it('throw 的实参先脱糖', () => {
        const e = new AddExpression(id('a'), id('b'))
        ;(e as any).oper = 'o@0'
        expect(D(list(new Throw(e)))).toBe('(catch((o@0((&a),(&b))))); throw=true;')
    })
})

describe('desugar/命令·条件', () => {
    it('条件不是 boolean 时补 != null', () => {
        expect(D(new IfStatement(cond(), new ExprCommand(id('a')), null))).toBe('if((c!=null))a;')
        expect(D(new WhileStatement(cond(), new ExprCommand(id('a'))))).toBe('while((c!=null))a;')
    })

    it('条件已经是 boolean 时不动', () => {
        expect(D(new IfStatement(cond(true), new ExprCommand(id('a')), null))).toBe('if(c)a;')
        expect(D(new WhileStatement(cond(true), new ExprCommand(id('a'))))).toBe('while(c)a;')
    })

    it('if-else 两个分支都会脱糖', () => {
        expect(D(new IfStatement(cond(true), new ExprCommand(id('a')), new ExprCommand(id('b')))))
            .toBe('if(c)a;else b;')
    })
})

describe('desugar/命令·循环', () => {
    it('do-while 展开成「先做一遍 + while」', () => {
        expect(D(new DoWhileStatement(new ExprCommand(id('a')), cond(true)))).toBe('a; while(c)a;')
    })

    it('for 展开成「初始化 + while(条件){体;步进}」', () => {
        expect(D(new ForStatement(
            [new VarDecl('i', new NumberType(), num('0'))],
            cond(true),
            [new ExprCommand(new IncrementPostfix(id('i')))],
            new ExprCommand(id('body')))))
            .toBe('i=0; while(c)body; (i++);')
    })

    it('for 的初始化与步进都可以为空', () => {
        expect(D(new ForStatement([], cond(true), [], new ExprCommand(id('body')))))
            .toBe('while(c)body;')
    })

    it('foreach 展开成带下标的 for', () => {
        expect(D(new ForeachStatement('c', id('s'), new ExprCommand(id('body')))))
            .toBe('for=0; c=null; while((((s[for])!=null)!=null))c=(s[for]); body; (for++);')
    })

    it('foreach 的循环变量初值是 null,条件是与 null 比较', () => {
        const n = new ForeachStatement('c', id('s'), new ExprCommand(id('body')))
        const out = desugar.run([n])[0] as ListCommand
        //[for 声明, c 声明, while]
        expect(out.commands.length).toBe(3)
        expect((out.commands[0] as AAssign).data).toBeInstanceOf(IdentifierExpr)
        expect((out.commands[1] as AAssign).value).toBeInstanceOf(NullLiteral)
    })

    it('switch 的分支体会脱糖', () => {
        expect(D(new SwitchStatement(cond(true), [new Case(num('1'), new ExprCommand(id('a')))], null)))
            .toBe('switch(c){case 1=>a;}')
    })
})

describe('desugar/命令·try', () => {
    it('try 脱糖成 throw 标志 + catch/finally 两个 lambda + try 体', () => {
        expect(D(new TryStatement(
            list(new ExprCommand(id('a'))),
            {iden: 'e', type: new StringType(), command: new ExprCommand(id('b'))},
            new ExprCommand(id('c')))))
            .toBe('throw=false; catch=(e:string)=>void{b; (finally());}; finally=()=>void{c;}; a; (finally());')
    })

    it('没有 finally 时 finally lambda 体为空', () => {
        expect(D(new TryStatement(
            list(new ExprCommand(id('a'))),
            {iden: 'e', type: new StringType(), command: new ExprCommand(id('b'))},
            null)))
            .toBe('throw=false; catch=(e:string)=>void{b; (finally());}; finally=()=>void{}; a; (finally());')
    })

    it('try 体里 throw 之后的语句会被包进 if(throw),避免执行两遍', () => {
        expect(D(new TryStatement(
            list(new ExprCommand(id('a')), new Throw(id('x')), new ExprCommand(id('b'))),
            {iden: 'e', type: new StringType(), command: new ExprCommand(id('h'))},
            null)))
            .toBe('throw=false; catch=(e:string)=>void{h; (finally());}; finally=()=>void{}; ' +
                'a; (catch(x)); throw=true; if(throw)throw=false; b;else  (finally());')
    })

    it('try 体里没有 throw 时不插入 if(throw)', () => {
        const out = D(new TryStatement(
            list(new ExprCommand(id('a')), new ExprCommand(id('b'))),
            {iden: 'e', type: new StringType(), command: new ExprCommand(id('h'))},
            null))
        expect(out).not.toContain('if(throw)')
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
