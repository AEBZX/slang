//desugar/try:throw 标志、catch/finally lambda 的生成形态
import {describe, expect, it} from 'vitest'
import desugar from '../../src/desugar'
import {parse, run_check, render} from './helper'

const M = (b: string) => `public m:module{ public static f:number(a:number){ ${b} } }`
//走一遍 check 再脱糖,渲染成文本(和真实编译链路一致)
const D = (body: string) => {
    const f: any = parse(M(body))
    run_check([f])
    return (desugar.run([f]) as any).map((x: any) => render(x)).join('|')
}
//每个 try 的 catch/finally/throw 都带自己的序号,断言时归一化掉
const N = (body: string) => D(body)
    .replace(/(catch|finally|throw)@\d+/g, '$1@N')

describe('desugar/try·基本形态', () => {
    it('进 try 前把 throw 标志置 false,并生成 catch/finally 两个 lambda', () => {
        const out = N('try{ a=1; }catch(e:number){ a=2; } return a;')
        expect(out).toContain('throw@N=false;')
        expect(out).toContain('catch@N=(e:number)=>void{')
        expect(out).toContain('finally@N=()=>void{')
    })

    it('try 体结束后调用 finally', () => {
        const out = N('try{ a=1; }catch(e:number){ a=2; } return a;')
        expect(out).toContain('a=1; (finally@N());')
    })

    it('catch 体末尾也调用 finally', () => {
        const out = N('try{ a=1; }catch(e:number){ a=2; } return a;')
        expect(out).toMatch(/catch@N=\(e:number\)=>void\{a=2; \(finally@N\(\)\);/)
    })

    it('finally 体进 finally lambda', () => {
        const out = N('try{ a=1; }catch(e:number){ a=2; }finally{ a=3; } return a;')
        expect(out).toContain('finally@N=()=>void{a=3;}')
    })
})

describe('desugar/try·throw 的重抛', () => {
    it('catch 里的 throw 重新置位标志', () => {
        const out = N('try{ a=1; }catch(e:number){ throw e; } return a;')
        expect(out).toContain('(catch@N(e)); throw@N=true;')
    })

    it('finally 里的 throw 也置位标志', () => {
        const out = N('try{ a=1; }catch(e:number){ a=2; }finally{ throw a; } return a;')
        expect(out).toContain('(catch@N(a)); throw@N=true;')
    })

    it('连续两个 throw:后一个被 if(throw) 保护,不会重复抛', () => {
        const out = N('try{ throw a; throw a; }catch(e:number){ a=2; } return a;')
        expect(out).toContain('throw@N=true; if(throw@N)throw@N=false;')
    })
})

//以下三条是当前实现的缺口
describe('desugar/try·已知缺口', () => {
    it('只有 finally 的 try 能解析', () => {
        const out = N('try{ a=1; }finally{ a=3; } return a;')
        expect(out).toContain('finally@N=()=>void{a=3;}')
        //没有 catch:只生成 finally,throw 交给外层
        expect(out).not.toContain('catch@N=')
    })

    it('既不写 catch 也不写 finally 也能解析', () => {
        expect(() => D('try{ a=1; } return a;')).not.toThrow()
    })


    it('控制结构里的 throw 之后的语句会被包进 if(throw)', () => {
        const out = N('try{ if(a>0)throw a; a=1; }catch(e:number){ a=2; } return a;')
        expect(out).toMatch(/if\(throw@N\)throw@N=false; a=1/)
    })
})
