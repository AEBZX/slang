import {describe, expect, it} from 'vitest'
import {check_src} from './helper'

const M = (body: string) => `public m:module{ public static f:number(a:number){ ${body} } }`
const has = (errs: string[], s: string) => errs.some(e => e.includes(s))
//没有 link std 时,类/接口相关的报错是设计如此(见 check-symbol 的用例),这里排除掉
const non_std = (errs: string[]) => errs.filter(e => !e.includes('std.ObjectInterface'))
//类必须声明在模块里(文件顶层只能放 link/module/value)
const CLASS = `public m:module{ public C:class{ public v:number; }`

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
