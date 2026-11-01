//系统测试:特性矩阵。每个小程序给出确定的输入输出,raw 与优化后都必须一致
import {describe, expect, it} from 'vitest'
import {exec} from '../interpreter'
import {bin_of, ir_of, opt_of} from '../unit/helper-ir'
import {decode} from '../sbin'

const M = (body: string) => `public m:module{ public static f:number(a:number){ ${body} } }`
//[名称, 函数体, [[输入, 期望], ...]]
const MATRIX: [string, string, [number, number][]][] = [
    ['算术优先级', 'return 1+2*3;', [[0, 7]]],
    ['括号与三元', 'var b:number=a>0?(a*2):(0-a); return b;', [[3, 6], [-3, 3]]],
    ['位运算组合', 'return (a&7)|(1<<3);', [[5, 13], [0, 8]]],
    ['移位', 'return (a>>1)<<2;', [[8, 16], [7, 12]]],
    ['除法与取模', 'return (a/2)*10+a%2;', [[7, 36], [8, 40]]],
    ['数组下标读', 'var d:number[]=[10,20,30]; return d[a%3];', [[4, 20], [2, 30]]],
    ['数组元素自增', 'var d:number[]=[1,1,1]; d[0]++; d[0]++; return d[0];', [[0, 3]]],
    ['短路与', 'var h:boolean=(a>0)&&(a<10); return h?1:0;', [[5, 1], [50, 0], [-1, 0]]],
    ['switch 分派', 'var r:number=0; switch(a%3){case 0=>r=10;case 1=>r=20;default=>r=30;} return r;',
        [[3, 10], [4, 20], [5, 30]]],
    ['复合赋值链', 'var b:number=a; b+=5; b-=2; b*=2; b/=2; return b;', [[1, 4], [7, 10]]],
    ['前后缀混合', 'var b:number=1; var c:number=b++; c=c+(++b); return c;', [[0, 4]]],
    ['科学计数法', 'return 1e2+5e-1;', [[0, 100.5]]],
    ['逻辑与复合赋值', 'var h:boolean=a>0; h&&=(a<5); return h?1:0;', [[3, 1], [9, 0]]],
    ['数组写入后自增', 'var d:number[]=[a,a*2]; d[1]++; return d[0]+d[1];', [[3, 10], [0, 1]]],
    ['嵌套三元', 'return a>0?(a>10?1:2):3;', [[20, 1], [5, 2], [-5, 3]]]
]

describe('system/特性矩阵·结果', () => {
    for (const [name, body, cases] of MATRIX)
        it(name, () => {
            const src = M(body)
            for (const [input, want] of cases) {
                expect(exec(ir_of(src), [input]).ret, `${name} a=${input} (raw)`).toBe(want)
                expect(exec(opt_of(src), [input]).ret, `${name} a=${input} (opt)`).toBe(want)
            }
        }, 20000)
})

describe('system/特性矩阵·字节码', () => {
    for (const [name, body] of MATRIX)
        it(name + ' 的字节码是确定的', () => {
            const src = M(body)
            const a = bin_of(src)
            expect(a.length).toBeGreaterThan(0)
            expect(a.equals(bin_of(src))).toBe(true)
        }, 20000)

    for (const [name, body] of MATRIX)
        it(name + ' 的产物能完整解码', () => {
            const src = M(body)
            const s = decode(bin_of(src))
            expect(s.blocks.size).toBe(opt_of(src).command.size)
            expect(s.pool.size).toBe(opt_of(src).pool.size)
        }, 20000)
})
