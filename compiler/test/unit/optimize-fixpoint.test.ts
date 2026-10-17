//优化器不动点:优化完的结果再优化一遍,必须一模一样(不再有任何改写)
import {describe, expect, it} from 'vitest'
import optimize from '../../src/optimize'
import {IRArgs} from '../../src/utils'
import {opt_of} from './helper-ir'

const M = (body: string) => `public m:module{ public static f:number(a:number){ ${body} } }`
//把 OPTTool 的指令流当成输入再跑一遍优化器
const rerun = (tool: any) => optimize.run({index: tool.index, ir: tool.command, pool: tool.pool} as any) as any

const dump = (tool: any) => [...tool.command.entries()]
    .map(([bid, list]: [number, any[]]) =>
        bid + ':' + list.map((ir: any) => {
            const args = Object.keys(ir).filter(k => ir[k] instanceof IRArgs)
                .map(k => `${k}=${ir[k].type[0]}${ir[k].data}`).join(',')
            return ir.constructor.name + (ir.id == null ? '' : '/' + ir.id) + '(' + args + ')'
        }).join(' '))
    .join('|')

const PROGRAMS: [string, string][] = [
    ['常量算术', M('var b:number=1+2*3; return b;')],
    ['参数算术', M('var b:number=a+1; var c:number=b*2; return c;')],
    ['比较与分支', M('if(a>0)return 1; else return 2;')],
    ['循环', M('var s:number=0; while(a>0){ s=s+a; a=a-1; } return s;')],
    ['数组', M('var d:number[]=[1,2]; d[0]=a; d[1]++; return d[0]+d[1];')],
    ['自增', M('var b:number=5; var c:number=b++; return b*10+c;')],
    ['逻辑复合赋值', M('var h:boolean=a>0; h&&=(a<10); return h?1:0;')],
    ['switch 展开', M('switch(a){case 1=>a=10;default=>a=30;} return a;')]
]

describe('optimize/不动点', () => {
    for (const [name, src] of PROGRAMS)
        it(name + ' 再优化一遍没有变化', () => {
            const first = opt_of(src)
            const second = rerun(first)
            expect(dump(second)).toEqual(dump(first))
        })

    it('连续两轮再优化都稳定', () => {
        const first = opt_of(PROGRAMS[4][1])
        const second = rerun(first)
        const third = rerun(second)
        expect(dump(third)).toEqual(dump(second))
        expect(dump(second)).toEqual(dump(first))
    })

    it('再优化不会改变产物大小', () => {
        for (const [name, src] of PROGRAMS) {
            const first = opt_of(src)
            const second = rerun(first)
            const size = (tool: any) => [...tool.command.values()].reduce((a, b) => a + b.length, 0)
            expect(size(second), name).toEqual(size(first))
        }
    })
})
