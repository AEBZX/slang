import {describe, expect, it} from 'vitest'
import {parse, check_src, parse_expr} from './helper'
import {CALL} from '../../src/utils'
import {all_of, ir_of} from './helper-ir'

const M = (body: string) => `public m:module{ public static f:number(a:number){ ${body} } }`
const has = (errs: string[], s: string) => errs.some(e => e.includes(s))
//没有 link std 时,类/接口相关的报错是设计如此(见 check-symbol 的用例),这里排除掉
const non_std = (errs: string[]) => errs.filter(e => !e.includes('std.ObjectInterface'))
//类必须声明在模块里(文件顶层只能放 link/module/value)
const CLASS = `public m:module{ public C:class{ public v:number; }`

describe('check/类型转换', () => {
    it('转换语法是 (类型)表达式', () => {
        expect(() => parse(M('return (number)a;'))).not.toThrow()
        expect(() => parse(M('return number(a);'))).toThrow()
        expect(() => parse(M('return a:number;'))).toThrow()
    })

    it('没有可用转换时报告类型转换失败', () => {
        expect(has(check_src(M('return (number)"s";')), '类型转换失败')).toBe(true)
    })

    //作者的约定:(T)x 这种显式转换必须存在对应的 cast,同类型也要
    it('同类型的显式转换也要有 cast', () => {
        expect(has(check_src(M('return (number)a;')), '类型转换失败')).toBe(true)
    })

    it('value 块里可以声明 cast', () => {
        expect(() => parse(`value string{ cast number(a:string)=>number{ return 1; } }`)).not.toThrow()
        expect(check_src(`value string{ cast number(a:string)=>number{ return 1; } }`)).toEqual([])
    })

    it('cast 体里的返回类型错误会被发现', () => {
        const errs = check_src(`value number{ cast number(a:number)=>number{ return "x"; } }`)
        expect(has(errs, '返回类型错误')).toBe(true)
    })

    it('自定义 cast 会生成调用', () => {
        const src = `value string{ cast number(a:string)=>number{ return 1; } }` + M('return (number)"s";')
        expect(all_of(ir_of(src), CALL).length).toBeGreaterThan(0)
    })

    //cast 声明之后,对应方向的隐式转换就成立了(这正是 cast 的用途)
    it('声明的 cast 让隐式转换可用', () => {
        const cast = `value string{ cast number(a:string)=>number{ return 1; } }`
        expect(has(check_src(M('return "x";')), '返回类型错误')).toBe(true)
        expect(check_src(cast + M('return "x";'))).toEqual([])
        //方向不相关的 cast 不影响这件事
        expect(has(check_src(`value string{ cast boolean(a:string)=>boolean{ return true; } }` + M('return "x";')),
            '返回类型错误')).toBe(true)
    })
})

describe('check/泛型', () => {
    it('未声明的泛型参数会报错', () => {
        expect(has(check_src(M('var x:@T=a; return x;')), '泛型T不存在')).toBe(true)
    })

    it('泛型类能解析', () => {
        expect(() => parse('public C:class<T>{ public v:@T; }')).not.toThrow()
    })

    it('泛型实参个数不匹配会报错', () => {
        const src = `public C:class<T>{ public v:@T; }
                     public m:module{ public static f:number(a:number){ var x:C<number,number>; return a; } }`
        expect(has(check_src(src), '泛型')).toBe(true)
    })

    //隐式推断现在可用了:实参类型绑到 @T 上,返回类型能解析
    it('泛型函数可以隐式推断调用', () => {
        const src = `public m:module{
            public static g:<T>@T(x:@T){ return x; }
            public static f:number(a:number){ return g(a); }
        }`
        expect(non_std(check_src(src))).toEqual([])
    })

    it('泛型函数可以用显式实参调用', () => {
        const src = `public m:module{
            public static g:<T>@T(x:@T){ return x; }
            public static f:number(a:number){ return g<number>(a); }
        }`
        expect(non_std(check_src(src))).toEqual([])
    })

    it('显式泛型实参和实参类型冲突会报错', () => {
        const src = `public m:module{
            public static g:<T>@T(x:@T){ return x; }
            public static f:number(a:number){ return g<string>(a); }
        }`
        expect(non_std(check_src(src)).length).toBeGreaterThan(0)
    })

    it('显式泛型实参会进 AST', () => {
        const e: any = parse_expr('g<number>(a)')
        expect(e.generic.map((g: any) => g.constructor.name)).toEqual(['NumberType'])
    })

    //已知缺陷:类型后面紧跟 = 时会被词法成 >=
    it.fails('泛型类型后面直接跟 = 也能解析', () => {
        expect(() => parse(`public m:module{ public static f:number(a:number){
            var x:C<number>=a; return a; } }`)).not.toThrow()
    })
})

describe('check/对象创建', () => {
    it('模块里的类可以 new(只报 std 相关的错)', () => {
        const src = CLASS + ` public static f:number(a:number){ var c:C=new C(); return a; } }`
        expect(non_std(check_src(src))).toEqual([])
    })

    it('类不能声明在文件顶层', () => {
        expect(has(check_src(`public C:class{ }`), '文件顶层只能是link/module/value')).toBe(true)
    })

    it('没有构造函数时 new 不能带实参', () => {
        const src = CLASS + ` public static f:number(a:number){ var c:C=new C(a); return a; } }`
        expect(has(check_src(src), '没有构造函数')).toBe(true)
        //不带实参则正常
        expect(non_std(check_src(CLASS + ` public static f:number(a:number){ var c:C=new C(); return a; } }`))).toEqual([])
    })

})
