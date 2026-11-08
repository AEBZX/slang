//desugar/try:新实现把 try/catch/finally 保留到 HIR,这里只钉住"子块被脱糖、结构不被改写"
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

describe('desugar/try·结构保留', () => {
    it('try/catch/finally 原样保留', () => {
        const out = D('try{ a=1; }catch(e:number){ a=2; }finally{ a=3; } return a;')
        expect(out).toContain('try{a=1;}catch(e:number){a=2;}finally{a=3;}')
    })

    it('没有 finally 时保留无 finally 的 try', () => {
        const out = D('try{ a=1; }catch(e:number){ a=2; } return a;')
        expect(out).toContain('try{a=1;}catch(e:number){a=2;}')
        expect(out).not.toContain('finally{')
    })

    it('只有 finally 的 try 也能解析', () => {
        const out = D('try{ a=1; }finally{ a=3; } return a;')
        expect(out).toContain('try{a=1;}')
        expect(out).toContain('finally{a=3;}')
    })

    it('既不写 catch 也不写 finally 也能解析', () => {
        expect(() => D('try{ a=1; } return a;')).not.toThrow()
    })

    it('throw 留在 try 体内,不再展开成 catch 调用 + 标志位', () => {
        const out = D('try{ a=1; throw a; }catch(e:number){ a=2; } return a;')
        expect(out).toContain('try{a=1; throw a;}')
        expect(out).not.toContain('throw@')
    })

    it('catch/finally 里的复合赋值会脱糖', () => {
        const out = D('try{ a=1; }catch(e:number){ a+=2; }finally{ a+=3; } return a;')
        expect(out).toContain('catch(e:number){a=(a+2);}')
        expect(out).toContain('finally{a=(a+3);}')
    })

    it('嵌套 try 都保留', () => {
        const out = D('try{ try{ a=1; }catch(e:number){ a=2; } }catch(e:number){ a=3; } return a;')
        expect(out).toContain('try{try{a=1;}catch(e:number){a=2;}}catch(e:number){a=3;}')
    })
})
