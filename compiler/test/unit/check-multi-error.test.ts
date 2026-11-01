import {describe, expect, it} from 'vitest'
import {check_src} from './helper'

const M = (body: string) => `public m:module{ ${body} }`
const has = (errs: string[], s: string) => errs.some(e => e.includes(s))

describe('check/多错误报告', () => {
    it('一个函数里的多个错误都会报出来', () => {
        const errs = check_src(M('public static f:number(a:number){ var b:number="s"; return zzz+1; }'))
        expect(errs.length).toBeGreaterThanOrEqual(2)
        expect(has(errs, 'zzz')).toBe(true)
    })

    it('不同函数里的错误都会报出来', () => {
        const errs = check_src(M(`public static f:number(a:number){ return nope1; }
                                  public static g:number(a:number){ return nope2; }`))
        expect(has(errs, 'nope1')).toBe(true)
        expect(has(errs, 'nope2')).toBe(true)
    })

    it('同一个表达式里只报一次,不会指数级重复', () => {
        const errs = check_src(M('public static f:number(a:number){ return a+"s"+"t"+"u"; }'))
        expect(errs.length).toBeGreaterThan(0)
        expect(errs.length).toBeLessThan(20)
    })

    it('报错不会中断后续检查(还能发现后面的错)', () => {
        const errs = check_src(M('public static f:number(a:number){ var b:number="s"; return c; }'))
        expect(errs.length).toBeGreaterThanOrEqual(2)
    })
})

describe('check/错误定位', () => {
    it('消息里带出出错的那行源码', () => {
        const src = M('public static f:number(a:number){ return zzz; }')
        const errs = check_src(src)
        expect(errs.some(e => e.includes('return zzz;'))).toBe(true)
    })

    it('诊断带行号', () => {
        const src = `public m:module{
            public static f:number(a:number){
                return zzz;
            }
        }`
        const errs = check_src(src)
        expect(errs.some(e => /at line:3:\d+/.test(e)), JSON.stringify(errs)).toBe(true)
    })

    it('不同行的错误报不同的行号', () => {
        const src = `public m:module{
            public static f:number(a:number){
                return nope1;
            }
            public static g:number(a:number){
                return nope2;
            }
        }`
        const errs = check_src(src)
        expect(errs.some(e => e.includes('nope1') && /at line:3:\d+/.test(e))).toBe(true)
        expect(errs.some(e => e.includes('nope2') && /at line:6:\d+/.test(e))).toBe(true)
    })

    it('诊断带行号和列号', () => {
        const src = `public m:module{
            public static f:number(a:number){
                return zzz;
            }
        }`
        const errs = check_src(src)
        expect(errs.some(e => /at line:3:24/.test(e)), JSON.stringify(errs)).toBe(true)
    })
})
