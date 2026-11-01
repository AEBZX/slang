import {describe, expect, it} from 'vitest'
import {check_src} from './helper'

const M = (body: string) => `public m:module{ ${body} }`
const F = (body: string, ret = 'number', arg = 'a:number') =>
    M(`public static f:${ret}(${arg}){ ${body} }`)
const G = `public static g:number(x:number){ return x; }`
//有错:返回错误列表(至少一条)
const bad = (src: string) => check_src(src)
//没错
const good = (src: string) => expect(check_src(src), src).toEqual([])

describe('check/合法程序不报错', () => {
    it('算术与返回', () => good(F('var b:number=a+1*2; return b;')))
    it('比较与逻辑', () => good(F('var h:boolean=a>0; var i:boolean=h&&h; return a;')))
    it('if/while/foreach/switch', () => good(F(
        'var d:number[]=[1,2]; foreach(x:d){ a=x; } if(a>0)a=1;else a=2; while(a>0){break;} switch(a){case 1=>a=2;default=>a=3;} return a;')))
    it('try-catch', () => good(F('try{a=1;}catch(e:number){a=2;}finally{a=3;} return a;')))
    it('调用本模块函数', () => good(M(G + 'public static f:number(a:number){ return g(a); }')))
    it('数组与字符串下标', () => good(M('public static f:number(d:number[],s:string){ var c:string=s[0]; return d[0]; }')))
    //类默认 implements std.ObjectInterface,没有 link std 时按设计会报错(见 check-symbol 里的用例)
    it('类需要 link std 才能干净通过', () => {
        const errs = check_src(M('public C:class{ public static v:number; } public static f:number(a:number){ return C.v; }'))
        expect(errs.some(e => e.includes('std.ObjectInterface'))).toBe(true)
    })
    it('void 函数', () => good(M('public static h:void(a:number){ } public static f:number(a:number){ h(a); return a; }')))
})

describe('check/符号错误', () => {
    it('用了未定义的标识符', () => {
        expect(bad(F('return zzz;')).length).toBeGreaterThan(0)
    })

    it('调用未定义的函数', () => {
        expect(bad(F('return nope(a);')).length).toBeGreaterThan(0)
    })

    it('同一作用域重复定义变量', () => {
        expect(bad(F('var b:number=1; var b:number=2; return b;')).length).toBeGreaterThan(0)
    })

    it('访问不存在的类成员', () => {
        expect(bad(M('public C:class{ } public static f:number(a:number){ return C.nope; }')).length).toBeGreaterThan(0)
    })

    it('引用未定义的模块', () => {
        expect(bad(M('public static f:number(a:number){ return nope.x; }')).length).toBeGreaterThan(0)
    })
})

describe('check/类型错误', () => {
    it('变量初始化类型不符', () => {
        expect(bad(F('var b:number="s"; return b;')).length).toBeGreaterThan(0)
    })

    it('返回类型不符', () => {
        expect(bad(F('return "s";')).length).toBeGreaterThan(0)
    })

    it('void 函数返回了值', () => {
        expect(bad(M('public static h:void(){ return 1; }')).length).toBeGreaterThan(0)
    })

    it('实参类型不符', () => {
        expect(bad(M(G + 'public static f:number(a:number){ return g("s"); }')).length).toBeGreaterThan(0)
    })

    it('实参个数不符', () => {
        expect(bad(M(G + 'public static f:number(a:number){ return g(a,a); }')).length).toBeGreaterThan(0)
    })

    it('number 和 string 不能相加', () => {
        expect(bad(F('var b:number=a+"s"; return b;')).length).toBeGreaterThan(0)
    })

    //条件不强制 boolean:脱糖阶段会补 `!= null`,所以 number 当条件也合法
    it('条件不必是 boolean', () => good(F('if(a)a=1; return a;')))

    it('非运算只能用于 boolean', () => {
        expect(bad(F('var h:boolean=!a; return a;')).length).toBeGreaterThan(0)
    })

    it('赋值类型不符', () => {
        expect(bad(F('a="s"; return a;')).length).toBeGreaterThan(0)
    })
})

describe('check/控制流合法性', () => {
    it('循环外 break 报错', () => {
        expect(bad(F('break; return a;')).length).toBeGreaterThan(0)
    })

    it('循环外 continue 报错', () => {
        expect(bad(F('continue; return a;')).length).toBeGreaterThan(0)
    })

    it('循环内 break 不报错', () => good(F('while(a>0){break;} return a;')))
})
