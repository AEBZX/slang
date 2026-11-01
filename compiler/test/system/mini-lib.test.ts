//系统测试:把一个小库完整编译成字节码,并核对产物与运行结果
import {describe, expect, it} from 'vitest'
import {exec} from '../interpreter'
import {bin_of, count_of, null_args, opt_of} from '../unit/helper-ir'

const LIB = `
public math:module{
    public static add:number(a:number,b:number){ return a+b; }
    public static sub:number(a:number,b:number){ return a-b; }
    public static twice:number(a:number){ return a*2; }
}
public util:module{
    public static id:number(a:number){ return a; }
    public static sum3:number(a:number,b:number,c:number){ return a+b+c; }
}
`

describe('system/mini-lib', () => {
    it('多模块多函数能编成字节码', () => {
        const buf = bin_of(LIB)
        expect(buf.length).toBeGreaterThan(0)
        expect(buf.toString('latin1').startsWith('SLANG1.0.0')).toBe(true)
    })

    it('产物里没有空操作数,结构自洽', () => {
        expect(null_args(opt_of(LIB))).toEqual([])
        expect(count_of(opt_of(LIB))).toBeGreaterThan(10)
    })

    it('每个函数都有独立的块', () => {
        const tool = opt_of(LIB)
        expect(tool.command.size).toBeGreaterThanOrEqual(5)
        expect([...tool.pool.values()].every(v => typeof v == 'number' || typeof v == 'string')).toBe(true)
    })

    it('两次编译产物完全一致', () => {
        expect(bin_of(LIB).equals(bin_of(LIB))).toBe(true)
    })

    it('单个函数能解释执行出正确结果', () => {
        const src = `public m:module{ public static twice:number(a:number){ return a*2; } }`
        const r = exec(opt_of(src), [21])
        expect(r.halt).not.toBe('timeout')
        expect(r.ret).toBe(42)
    })

    it('带分支的函数结果正确', () => {
        const src = `public m:module{ public static f:number(a:number){
            var s:number=0;
            if(a>10)s=1; else if(a>5)s=2; else s=3;
            return s;
        } }`
        expect(exec(opt_of(src), [20]).ret).toBe(1)
        expect(exec(opt_of(src), [7]).ret).toBe(2)
        expect(exec(opt_of(src), [1]).ret).toBe(3)
    })
})
