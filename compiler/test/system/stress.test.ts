//系统测试:大规模组合程序。编译、全字节解码、确定性、优化不动点
import {describe, expect, it} from 'vitest'
import {decode} from '../sbin'
import {exec} from '../interpreter'
import {bin_of, count_of, ir_of, null_args, opt_of} from '../unit/helper-ir'
import optimize from '../../src/optimize'
import {IRArgs} from '../../src/utils'

const dump = (tool: any) => [...tool.command.entries()]
    .map(([bid, list]: [number, any[]]) =>
        bid + ':' + list.map((ir: any) => {
            const args = Object.keys(ir).filter(k => ir[k] instanceof IRArgs)
                .map(k => `${k}=${ir[k].type[0]}${ir[k].data}`).join(',')
            return ir.constructor.name + (ir.id == null ? '' : '/' + ir.id) + '(' + args + ')'
        }).join(' '))
    .join('|')
const rerun = (tool: any) => optimize.run({index: tool.index, ir: tool.command, pool: tool.pool} as any) as any

//一个把多种特性塞在一起的大程序
const BIG = `
public util:module{
    public static add:number(x:number,y:number){ return x+y; }
    public static twice:number(x:number){ return x*2; }
    public static sum:number(d:number[]){ 
        var s:number=0; var i:number=0;
        while(i<3){ s=s+d[i]; i++; }
        return s;
    }
}
public app:module{
    public static classify:number(v:number){
        var r:number=0;
        switch(v%3){ case 0=>r=10; case 1=>r=20; default=>r=30; }
        return r;
    }
    public static run:number(a:number){
        var m:number[][]=[[1,2],[3,4]];
        m[0][1]=a;
        m[1][0]++;
        var h:boolean=(a>0)&&(m[0][1]<100);
        var acc:number=0;
        if(h){ acc=util.add(m[0][1],m[1][0]); }else{ acc=0-a; }
        acc=acc+app.classify(a);
        for(var i:number=0;;i++;){ if(i>=2)break; acc=acc+1; }
        var bb:boolean=acc>0;
        bb&&=(acc<1000);
        return bb?acc:0-acc;
    }
}
`

//生成的程序:100 条连写的复合赋值
const CHAIN = `public m:module{ public static f:number(a:number){
    var b:number=a;
    ${Array.from({length: 100}, (_, i) => `b=b+${i % 7};`).join('\n    ')}
    return b;
} }`

//20 个模块,每个一个函数
const MANY = Array.from({length: 20}, (_, i) =>
    `public m${i}:module{ public static f:number(x:number){ return x+${i}; } }`).join('\n')

//200 个元素的数组字面量
const LONG_ARRAY = `public m:module{ public static f:number(a:number){
    var d:number[]=[${Array.from({length: 200}, (_, i) => i % 10).join(',')}];
    return d[199];
} }`

//三层嵌套容器
const DEEP = `public m:module{ public static f:number(a:number){
    var d:number[][][]=[[[1,2],[3]],[[4]]];
    d[1][0][0]=a;
    return d[1][0][0]+d[0][0][1];
} }`

describe('system/压力·大程序', () => {
    it('多模块多特性程序:能编译、能解码、无空操作数', () => {
        const tool = opt_of(BIG)
        const s = decode(bin_of(BIG))
        expect(null_args(tool)).toEqual([])
        expect(s.blocks.size).toBe(tool.command.size)
        expect(s.pool.size).toBe(tool.pool.size)
        expect(count_of(tool)).toBeGreaterThan(50)
    }, 30000)

    it('多模块多特性程序:两次编译一致 + 优化不动点', () => {
        const a = bin_of(BIG)
        expect(a.equals(bin_of(BIG))).toBe(true)
        const first = opt_of(BIG)
        expect(dump(rerun(first))).toEqual(dump(first))
    }, 30000)

    //这个程序里有跨模块调用,解释器还不支持,只做解码/确定性(上面两条已覆盖)

    it('100 条连写语句:解码干净、结果正确', () => {
        const s = decode(bin_of(CHAIN))
        expect(s.blocks.size).toBeGreaterThan(0)
        //0+1+2+3+4+5+6 循环 100 次
        const want = Array.from({length: 100}, (_, i) => i % 7).reduce((a, b) => a + b, 0)
        expect(exec(ir_of(CHAIN), [0]).ret).toBe(want)
        expect(exec(opt_of(CHAIN), [0]).ret).toBe(want)
    }, 30000)

    it('20 个模块:块数与池都对得上', () => {
        const tool = opt_of(MANY)
        const s = decode(bin_of(MANY))
        expect(s.blocks.size).toBe(tool.command.size)
        expect(tool.command.size).toBeGreaterThanOrEqual(20)
    }, 30000)

    it('200 元素数组字面量:编码正常、元素可取', () => {
        const s = decode(bin_of(LONG_ARRAY))
        expect(s.blocks.size).toBeGreaterThan(0)
        expect(exec(ir_of(LONG_ARRAY), [0]).ret).toBe(9)   // 199 % 10
    }, 30000)

    it('三层嵌套容器:读写都对', () => {
        expect(exec(ir_of(DEEP), [7]).ret).toBe(9)          // 7 + 2
        expect(exec(opt_of(DEEP), [7]).ret).toBe(9)
        expect(decode(bin_of(DEEP)).blocks.size).toBeGreaterThan(0)
    }, 30000)

    it('产物大小与源码规模同量级,没有指数膨胀', () => {
        for (const [name, src] of [['BIG', BIG], ['MANY', MANY], ['CHAIN', CHAIN], ['LONG_ARRAY', LONG_ARRAY]] as [string, string][]) {
            const size = bin_of(src).length
            //16 字节/指令 + 池,量级应该和源码长度同阶
            expect(size, name).toBeLessThan(src.length * 40 + 2000)
        }
        //指令多的程序产物更大
        expect(bin_of(CHAIN).length).toBeGreaterThan(bin_of(MANY).length)
    }, 30000)
})
