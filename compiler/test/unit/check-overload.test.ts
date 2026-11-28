import {describe, expect, it} from 'vitest'
import {run_to_check, run_to_desugar} from '../helpers'

//operation 重载决议语义:决议输入为接收者类型,形参约定=[接收者,...实参];
//引用串为相对名 <运算符>@<序号>,脱糖落地为 a.<运算符>@<序号>(实参) 成员调用
const OP_CLASS = `app: module {
    c: class {
        add: operation '+' (x: c, y: c) => c { return x; }
    }
    main: void() {
        var a: c = new c();
        var s: c = a + a;
    }
}`

describe('check overload: 运算符重载决议', () => {
    it('类 operation 二元运算命中且引用串为 相对名@序号', () => {
        const {files, scope} = run_to_check(OP_CLASS)
        expect(scope.global.error).toHaveLength(0)
        const decl = (files[0].children[0] as any).children[1].commands.commands[1]
        expect(decl.value.oper).toBe('+@0')
    })

    it('value 块 operation 命中 number 运算', () => {
        const {files, scope} = run_to_check(`value number {
    operation '+' (x: number, y: number) => number { return x; }
}
app: module {
    main: void() {
        var n: number = 1 + 2;
    }
}`)
        expect(scope.global.error).toHaveLength(0)
        const decl = (files[0].children[1] as any).children[0].commands.commands[0]
        expect(decl.value.oper).toBe('+@0')
    })

    it('() 调用重载', () => {
        const {files, scope} = run_to_check(`app: module {
    c: class {
        call: operation () (x: c) => number { return 1; }
    }
    main: void() {
        var a: c = new c();
        var n: number = a();
    }
}`)
        expect(scope.global.error).toHaveLength(0)
        const decl = (files[0].children[0] as any).children[1].commands.commands[1]
        expect(decl.value.oper).toBe('()@0')
    })

    it('[] 索引重载', () => {
        const {files, scope} = run_to_check(`app: module {
    c: class {
        get: operation [] (x: c, i: number) => number { return 1; }
    }
    main: void() {
        var a: c = new c();
        var n: number = a[1];
    }
}`)
        expect(scope.global.error).toHaveLength(0)
        const decl = (files[0].children[0] as any).children[1].commands.commands[1]
        expect(decl.value.oper).toBe('[]@0')
    })
})

describe('check overload: ++/-- 重载', () => {
    it('postfix++ 命中 (操作数) 单参重载', () => {
        const {files, scope} = run_to_check(`app: module {
    c: class {
        inc: operation '++' (x: c) => c { return x; }
    }
    main: void() {
        var a: c = new c();
        a++;
    }
}`)
        expect(scope.global.error).toHaveLength(0)
        const expr = (files[0].children[0] as any).children[1].commands.commands[1].data
        expect(expr.oper).toBe('++@0')
    })

    it('prefix++ 命中同一个 (操作数) 单参重载', () => {
        const {files, scope} = run_to_check(`app: module {
    c: class {
        inc: operation '++' (x: c) => c { return x; }
    }
    main: void() {
        var a: c = new c();
        ++a;
    }
}`)
        expect(scope.global.error).toHaveLength(0)
        const expr = (files[0].children[0] as any).children[1].commands.commands[1].data
        expect(expr.oper).toBe('++@0')
    })
})

describe('check overload: 初始化与赋值重载', () => {
    it('var 声明的 = 重载命中(第三形参为滚木 number)', () => {
        const {files, scope} = run_to_check(`app: module {
    c: class {
        mk: operation '=' (x: c, y: c, air: number) => c { return x; }
    }
    main: void() {
        var a: c = new c();
        var v: c = a;
    }
}`)
        expect(scope.global.error).toHaveLength(0)
        const decl = (files[0].children[0] as any).children[1].commands.commands[1]
        expect(decl.oper).toBe('=@0')
    })
})

describe('check overload: 决议失败', () => {
    it('两个相同签名 operation 无法具体性决议', () => {
        const {scope} = run_to_check(`app: module {
    c: class {
        p: operation '+' (x: c, y: c) => c { return x; }
        q: operation '+' (x: c, y: c) => c { return y; }
    }
    main: void() {
        var a: c = new c();
        var s: c = a + a;
    }
}`)
        expect(scope.global.error.length).toBeGreaterThan(0)
    })

    it('参数不匹配且无内建时报错', () => {
        const {scope} = run_to_check(`app: module {
    c: class {
        add: operation '+' (x: c, y: c) => c { return x; }
    }
    main: void() {
        var a: c = new c();
        var s: c = a + 1;
    }
}`)
        expect(scope.global.error.length).toBeGreaterThan(0)
    })
})

describe('desugar 对齐: operation 命名', () => {
    it('类 operation 成员脱糖后名为 运算符@N', () => {
        const desugared = run_to_desugar(OP_CLASS) as any
        const class_block = desugared[0].children[0].children[0]
        expect(class_block.children[0].name).toBe('+@0')
    })

    it('运算符使用点脱糖为 a.+@N(实参) 成员调用', () => {
        const desugared = run_to_desugar(OP_CLASS) as any
        const value = desugared[0].children[0].children[1].value.body.commands[1].value
        //ArgumentsPostfix(a.+@0)(a, a):接收者经 D_Arguments 补进参数区首位
        expect(value.constructor.name).toBe('ArgumentsPostfix')
        expect(value.expr.name).toBe('+@0')
        expect(value.expr.expr.name).toBe('a')
        expect(value.args).toHaveLength(2)
        expect(value.args[0].name).toBe('a')
    })

    it('value 块 operation 脱糖后为 Module(number) 下的 运算符@N', () => {
        const desugared = run_to_desugar(`value number {
    operation '+' (x: number, y: number) => number { return x; }
}`) as any
        const value_module = desugared[0].children[0]
        expect(value_module.name).toBe('number')
        expect(value_module.children[0].name).toBe('+@0')
    })
})
