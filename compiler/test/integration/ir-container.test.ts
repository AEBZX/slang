//集成:数组容器的身份与下标读写(容器的操作数身份是槽号)
import {describe, expect, it} from 'vitest'
import {exec} from '../interpreter'
import {MOV, OFFSET_GET, OFFSET_SET} from '../../src/utils'
import {all_of, ir_of, opt_of} from '../unit/helper-ir'

const M = (body: string) => `public m:module{ public static f:number(a:number){ ${body} } }`
const run = (src: string, a = 0) => exec(ir_of(src), [a])
const run_opt = (src: string, a = 0) => exec(opt_of(src), [a])

describe('集成/数组容器·字面量建在目标槽里', () => {
    it('数组字面量赋值给变量时,容器就建在这个变量的槽里', () => {
        const tool = ir_of(M('var d:number[]=[1,2]; return a;'))
        const set = all_of(tool, OFFSET_SET)[0]
        expect(set).toBeDefined()
        expect(set.target.type).toBe('reg')
        //没有"先建到临时槽再 mov 过去"的多余搬运:该槽号就是变量的槽
        const moved = all_of(tool, MOV).filter((m: MOV) => m.right.type == 'value' && m.right.data == set.target.data)
        expect(moved.length).toBe(0)
    })

    it('三个元素的数组生成三次写入(加上模块登记共四次)', () => {
        const tool = ir_of(M('var d:number[]=[1,2,3]; return a;'))
        expect(all_of(tool, OFFSET_SET).length).toBe(4)
    })
})

describe('集成/数组容器·下标读写', () => {
    const SRC = 'var d:number[]=[1,2]; '

    it('读:取第二个元素', () => {
        expect(run(M(SRC + 'return d[1];')).ret).toBe(2)
    })

    it('写:用参数覆盖', () => {
        expect(run(M(SRC + 'd[1]=a; return d[1];'), 7).ret).toBe(7)
    })

    it('动态下标', () => {
        expect(run(M(SRC + 'var i:number=a; return d[i];'), 1).ret).toBe(2)
    })

    it('下标目标的后缀自增会写回', () => {
        expect(run(M(SRC + 'd[1]++; return d[1];')).ret).toBe(3)
        expect(run_opt(M(SRC + 'd[1]++; return d[1];')).ret).toBe(3)
    })

    it('下标目标的后缀自增:表达式值是旧值', () => {
        const src = M(SRC + 'var c:number=d[1]++; return c*10+d[1];')
        expect(run(src).ret).toBe(23)
        expect(run_opt(src).ret).toBe(23)
    })

    it('下标目标的前缀自增:表达式值是新值', () => {
        const src = M(SRC + 'var c:number=++d[1]; return c*10+d[1];')
        expect(run(src).ret).toBe(33)
        expect(run_opt(src).ret).toBe(33)
    })

    it('下标目标的后缀自减', () => {
        expect(run(M(SRC + 'd[1]--; return d[1];')).ret).toBe(1)
    })

    it('变量自增与下标自增互不影响', () => {
        const src = M(SRC + 'var b:number=5; d[0]++; b++; return d[0]*10+b;')
        expect(run(src).ret).toBe(26)
    })
})

describe('集成/成员容器·自增', () => {
    const OBJ = `public n:module{ public static v:number; }
                 public m:module{ public static f:number(a:number){ `
    const src = (body: string) => OBJ + body + ' } }'

    it('n.v++ 会写回', () => {
        expect(run(src('n.v=5; n.v++; return n.v;')).ret).toBe(6)
        expect(run_opt(src('n.v=5; n.v++; return n.v;')).ret).toBe(6)
    })

    it('n.v++ 的表达式值是旧值', () => {
        const s = src('n.v=5; var c:number=n.v++; return c*10+n.v;')
        expect(run(s).ret).toBe(56)
        expect(run_opt(s).ret).toBe(56)
    })

    it('++n.v 的表达式值是新值', () => {
        const s = src('n.v=5; var c:number=++n.v; return c*10+n.v;')
        expect(run(s).ret).toBe(66)
        expect(run_opt(s).ret).toBe(66)
    })

    it('n.v-- 会写回', () => {
        expect(run(src('n.v=5; n.v--; return n.v;')).ret).toBe(4)
    })

    it('成员赋值后能直接读回', () => {
        expect(run(src('n.v=5; return n.v;')).ret).toBe(5)
        expect(run(src('n.v=a; return n.v;'), 9).ret).toBe(9)
        expect(run_opt(src('n.v=a; return n.v;'), 9).ret).toBe(9)
    })
})

describe('集成/数组容器·结构', () => {
    it('下标读生成 OFFSET_GET,下标写生成 OFFSET_SET', () => {
        const tool = ir_of(M('var d:number[]=[1,2]; d[0]=a; return d[1];'))
        expect(all_of(tool, OFFSET_GET).length).toBeGreaterThan(0)
        //字面量两次 + 一次下标写
        expect(all_of(tool, OFFSET_SET).length).toBeGreaterThanOrEqual(3)
    })

    it('下标自增会生成一次读 + 一次写', () => {
        const tool = ir_of(M('var d:number[]=[1,2]; d[0]++; return d[0];'))
        expect(all_of(tool, OFFSET_GET).length).toBeGreaterThanOrEqual(2)
        expect(all_of(tool, OFFSET_SET).length).toBeGreaterThanOrEqual(3)
    })
})
