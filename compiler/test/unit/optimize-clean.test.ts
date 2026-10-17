import {describe, expect, it} from 'vitest'
import {BINARY, IRArgs, LOAD, MOV} from '../../src/utils'
import {all_of, opt_of} from '../unit/helper-ir'

const M = (body: string) => `public m:module{ public static f:number(a:number){ ${body} } }`
const PROGRAMS: [string, string][] = [
    ['常量算术', M('var b:number=1+2*3; return b;')],
    ['参数算术', M('var b:number=a+1; var c:number=b*2; return c;')],
    ['比较', M('var h:boolean=a>0; var s:number=0; if(h)s=1; return s;')],
    ['循环', M('var s:number=0; while(a>0){s=s+a; a=a-1;} return s;')],
    ['数组', M('var d:number[]=[1,2]; d[0]=a; return d[1];')]
]

describe('optimize/优化后不该留下"一眼能化简"的形态', () => {
    for (const [name, src] of PROGRAMS) {
        it(name + ' 没有两个常量操作数的二元运算', () => {
            const tool = opt_of(src)
            const left = all_of(tool, BINARY).filter((b: BINARY) =>
                b.left.type == 'reg' && b.right.type == 'reg')
            expect(left.map((b: BINARY) => b.id)).toEqual([])
        })

        it(name + ' 没有还能传播掉的 load', () => {
            const tool = opt_of(src)
            //load 的源如果是池里的数字常量,常量传播应该已经把它换成 mov
            const left = all_of(tool, LOAD).filter((l: LOAD) =>
                typeof tool.pool.get(l.data.data) == 'number')
            expect(left.length).toBe(0)
        })

        it(name + ' 没有读自己写的空转 mov', () => {
            const tool = opt_of(src)
            const self = all_of(tool, MOV).filter((m: MOV) =>
                m.left.type == 'reg' && m.right.type == 'value' && m.left.data == m.right.data)
            expect(self.length).toBe(0)
        })
    }
})

describe('optimize/优化结果稳定', () => {
    it('同一程序两次优化的指令序列一致', () => {
        for (const [name, src] of PROGRAMS) {
            const a = opt_of(src)
            const b = opt_of(src)
            const dump = (tool: any) => [...tool.command.entries()]
                .map(([bid, list]: [number, any[]]) =>
                    bid + ':' + list.map((i: any) => {
                        const args = Object.keys(i).filter(k => i[k] instanceof IRArgs)
                            .map(k => `${i[k].type[0]}${i[k].data}`).join(',')
                        return i.constructor.name + (i.id == null ? '' : '/' + i.id) + '(' + args + ')'
                    }).join(' '))
                .join('|')
            expect(dump(b), name + ' 两次优化不一致').toEqual(dump(a))
        }
    })
})
