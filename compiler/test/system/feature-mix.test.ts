//系统测试:把多种特性放进一个程序里,端到端核对具体结果
import {describe, expect, it} from 'vitest'
import {exec} from '../interpreter'
import {bin_of, opt_of, ir_of} from '../unit/helper-ir'

const MIX = `public m:module{ public static f:number(a:number){
    var d:number[]=[1,2,3];
    d[0]=a; d[1]++;
    var h:boolean=(d[0]>0)&&(d[1]<10);
    var r:number=0;
    switch(d[1]){case 3=>r=d[0]+d[1];case 4=>r=100;default=>r=200;}
    return h?r:0;
} }`

const LOGIC = `public m:module{ public static f:number(a:number){
    var h:boolean=a>0;
    h&&=(a<100);
    var g:boolean=a<0;
    h||=g;
    var s:number=0;
    for(var i:number=0;;i++;){ s=s+1; if(s>2)break; }
    return h?s:-1;
} }`

const run = (src: string, a: number) => exec(ir_of(src), [a]).ret
const run_opt = (src: string, a: number) => exec(opt_of(src), [a]).ret

describe('system/feature-mix', () => {
    it('数组 + 下标自增 + 逻辑与 + switch + 三目', () => {
        expect(run(MIX, 5)).toBe(8)      // d=[5,3,3] → r=8, h=真
        expect(run(MIX, 0)).toBe(0)      // d[0]=0 → h=假
        expect(run(MIX, -3)).toBe(0)
        expect(run_opt(MIX, 5)).toBe(8)
        expect(run_opt(MIX, 0)).toBe(0)
    })

    it('&&= / ||= + 省略条件的 for + break', () => {
        expect(run(LOGIC, 5)).toBe(3)    // h 保持真,循环跑三次
        expect(run(LOGIC, 0)).toBe(-1)   // h 假,a<0 也假 → h||=g 仍是假 → -1
        expect(run_opt(LOGIC, 5)).toBe(3)
    })

    it('两种输入下优化前后一致', () => {
        for (const src of [MIX, LOGIC])
            for (const a of [-5, 0, 1, 5, 200]) {
                const raw = run(src, a)
                expect(run_opt(src, a), `${src.slice(0, 20)} a=${a}`).toEqual(raw)
            }
    }, 30000)

    it('能编出确定性的字节码', () => {
        for (const src of [MIX, LOGIC]) {
            const a = bin_of(src)
            const b = bin_of(src)
            expect(a.length).toBeGreaterThan(0)
            expect(a.equals(b)).toBe(true)
        }
    })
})
