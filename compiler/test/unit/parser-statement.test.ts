import {describe, expect, it} from 'vitest'
import {parse_commands} from './helper'

//语句的语法以 cst/command.ts 为准
const cmds = (body: string) => parse_commands(body) as any[]
const kinds = (body: string) => cmds(body).map((c: any) => c.constructor.name)

describe('parser/语句·赋值', () => {
    it('普通赋值', () => {
        expect(kinds('a=1;')).toEqual(['AAssign'])
    })

    //每种赋值都有独立的 AST 节点
    const assigns: [string, string][] = [
        ['+=', 'AddAssign'], ['-=', 'SubAssign'], ['*=', 'MulAssign'], ['/=', 'DivAssign'],
        ['%=', 'ModAssign'], ['&=', 'AndAssign'], ['|=', 'OrAssign'], ['^=', 'XorAssign'],
        ['<<=', 'ShlAssign'], ['>>=', 'ShrAssign']
    ]
    for (const [op, node] of assigns)
        it('复合赋值 ' + op, () => {
            expect(kinds('a' + op + '1;')).toEqual([node])
        })

    //&&= / ||= 现在有语法规则了,AST 上是 LogicAndAssign / LogicOrAssign
    it('&&= 和 ||= 有语法规则', () => {
        expect(kinds('a&&=1;')).toEqual(['LogicAndAssign'])
        expect(kinds('a||=1;')).toEqual(['LogicOrAssign'])
    })

    it('||= 有语法规则', () => {
        expect(kinds('a||=1;')).toEqual(['LogicOrAssign'])
    })
})

describe('parser/语句·基本命令', () => {
    it('变量声明(带/不带初始化)', () => {
        expect(kinds('var a:number;')).toEqual(['VarDecl'])
        expect(kinds('var a:number=1;')).toEqual(['VarDecl'])
    })

    it('表达式语句', () => {
        expect(kinds('f();')).toEqual(['ExprCommand'])
        expect(kinds('a;')).toEqual(['ExprCommand'])
    })

    it('return 带值和不带值', () => {
        expect(kinds('return a;')).toEqual(['Return'])
        expect(kinds('return;')).toEqual(['Return'])
    })

    it('break/continue/throw', () => {
        expect(kinds('break;')).toEqual(['Break'])
        expect(kinds('continue;')).toEqual(['Continue'])
        expect(kinds('throw a;')).toEqual(['Throw'])
    })

    it('await 接一条命令', () => {
        expect(kinds('await f();')).toEqual(['Await'])
    })

    it('vm 内联指令:字符串 + 任意个参数', () => {
        expect(kinds('vm("add",a,1);')).toEqual(['VM'])
        expect(kinds('vm("gc");')).toEqual(['VM'])
    })

    it('多条命令按顺序成列表', () => {
        expect(kinds('a=1;b=2;return a;')).toEqual(['AAssign', 'AAssign', 'Return'])
    })
})

describe('parser/语句·控制流', () => {
    it('if / if-else', () => {
        expect(kinds('if(a>0)a=1;')).toEqual(['IfStatement'])
        expect(kinds('if(a>0)a=1;else a=2;')).toEqual(['IfStatement'])
    })

    it('while', () => {
        expect(kinds('while(a>0)a=1;')).toEqual(['WhileStatement'])
    })

    it('do-while', () => {
        expect(kinds('do{a=1;}while(a>0);')).toEqual(['DoWhileStatement'])
    })

    it('for:初始化段带分号,步进段是一条命令', () => {
        expect(kinds('for(var i:number=0;i<10;i++;){a=1;}')).toEqual(['ForStatement'])
    })

    //语法里 Expression(条件)是必填的,不能整段省略
    //条件段可以省略;初始化段也全省的写法(for(;;i++))不支持——文法里 init 的 ; 由 VarDecl 自己带
    it('for 省略条件也能解析', () => {
        expect(kinds('for(var i:number=0;;i++;){break;}')).toEqual(['ForStatement'])
        expect(kinds('for(var i:number=0;;){break;}')).toEqual(['ForStatement'])
    })

    it('foreach:标识符 : 表达式', () => {
        expect(kinds('foreach(x:d){a=x;}')).toEqual(['ForeachStatement'])
    })

    it('switch 用 => 分隔分支', () => {
        expect(kinds('switch(a){case 1=>a=2;default=>a=3;}')).toEqual(['SwitchStatement'])
    })

    it('try-catch / try-catch-finally', () => {
        expect(kinds('try{a=1;}catch(e:number){a=2;}')).toEqual(['TryStatement'])
        expect(kinds('try{a=1;}catch(e:number){a=2;}finally{a=3;}')).toEqual(['TryStatement'])
    })

    it('裸块', () => {
        expect(kinds('{a=1;}')).toEqual(['ListCommand'])
    })
})

describe('parser/语句·解析错误', () => {
    it('缺分号报错', () => {
        expect(() => cmds('a=1')).toThrow()
    })

    it('括号不配对报错', () => {
        expect(() => cmds('if(a>0{a=1;}')).toThrow()
    })

    it('case 用冒号(旧写法)不被接受', () => {
        expect(() => cmds('switch(a){case 1:a=2;}')).toThrow()
    })
})
