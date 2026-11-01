//check/重载解析:按参数类型/个数选候选,具体形参优先于泛型形参
import {describe, expect, it} from 'vitest'
import {check_src} from './helper'

const has = (errs: string[], s: string) => errs.some(e => e.includes(s))
const non_std = (errs: string[]) => errs.filter(e => !e.includes('std.ObjectInterface'))

//两个重载返回不同类型,用"赋给谁"来观测选中的是哪一个
const TWO = `public m:module{
    public static f:string(a:number){ return "n"; }
    public static f:number(a:string){ return 1; }
`

describe('check/重载·按参数类型选择', () => {
    it('数字实参选中返回 string 的那个', () => {
        expect(check_src(TWO + `public static g:number(a:number){ var x:string=f(1); return a; } }`)).toEqual([])
    })

    it('字符串实参选中返回 number 的那个', () => {
        expect(check_src(TWO + `public static g:number(a:number){ var x:number=f("s"); return a; } }`)).toEqual([])
    })

    it('选错会报赋值类型错误', () => {
        expect(has(check_src(TWO + `public static g:number(a:number){ var x:number=f(1); return a; } }`), '赋值类型错误')).toBe(true)
    })

    it('三个重载各选各的', () => {
        const src = `public m:module{
            public static f:string(a:number){ return "n"; }
            public static f:boolean(a:boolean){ return true; }
            public static f:number(a:string){ return 1; }
            public static g:number(a:number){ var x:boolean=f(true); return a; }
            public static h:number(a:number){ var y:string=f(a); return a; }
        }`
        expect(check_src(src)).toEqual([])
    })
})

describe('check/重载·候选筛选', () => {
    it('参数个数不符', () => {
        const errs = check_src(TWO + `public static g:number(a:number){ var x:string=f(1,2); return a; } }`)
        expect(has(errs, '没有符合generic和param的重载')).toBe(true)
    })

    it('参数类型不符', () => {
        const errs = check_src(TWO + `public static g:number(a:number){ var x:string=f(true); return a; } }`)
        expect(has(errs, '没有符合generic和param的重载')).toBe(true)
    })

    it('一参和两参的重载并存', () => {
        const src = `public m:module{
            public static f:number(a:number){ return a; }
            public static f:number(a:number,b:number){ return a; }
            public static g:number(a:number){ return f(a,a); }
            public static h:number(a:number){ return f(a); }
        }`
        expect(check_src(src)).toEqual([])
    })

    it('没有重载表时按普通函数检查', () => {
        expect(check_src(`public m:module{ public static q:number(a:number){ return a; }
            public static g:number(a:number){ return q(a); } }`)).toEqual([])
    })
})

describe('check/重载·跨模块', () => {
    it('不同模块的同名函数互不干扰', () => {
        const src = `public a:module{ public static f:number(x:number){ return x; } }
                     public b:module{ public static f:string(x:number){ return "s"; } }
                     public m:module{ public static g:number(x:number){ var y:string=b.f(x); return x; } }`
        expect(check_src(src)).toEqual([])
    })
})

describe('check/重载·具体优先于泛型', () => {
    it('有具体候选时不会因为泛型候选而报歧义', () => {
        const src = `public m:module{
            public static f:<T>@T(x:@T){ return x; }
            public static f:number(x:number){ return x; }
            public static g:number(a:number){ return f(a); }
        }`
        expect(non_std(check_src(src))).toEqual([])
    })

    it('只有泛型候选时也能解析', () => {
        const src = `public m:module{
            public static f:<T>@T(x:@T){ return x; }
            public static g:number(a:number){ return f(a); }
        }`
        expect(non_std(check_src(src))).toEqual([])
    })
})
