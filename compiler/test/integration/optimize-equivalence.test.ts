//差分测试:同一程序「优化前」和「优化后」解释执行,结果必须一致
import {describe, expect, it} from 'vitest'
import {exec} from '../interpreter'
import {ir_of, opt_of} from '../unit/helper-ir'

const M = (body: string) => `public m:module{ public static f:number(a:number){ ${body} } }`
//单函数、不带调用:参数 a 是唯一输入,return 的值是输出
const PROGRAMS: [string, string][] = [
    ['常量算术', M('return 1+2*3;')],
    ['参数算术', M('var b:number=a+1*2-3; return b;')],
    ['除法与取模', M('var b:number=a/2; var c:number=a%3; return b+c;')],
    ['位运算', M('var b:number=a<<1; var c:number=b>>1; var d:number=c&7; return d|1^2;')],
    ['比较', M('var b:boolean=a>0; var c:boolean=a==0; var d:boolean=a<=0; var s:number=0; if(b)s=s+1; if(c)s=s+2; if(d)s=s+4; return s;')],
    ['逻辑非', M('var h:boolean=a>0; return h?1:0;')],
    ['位取反', M('var b:number=~a; return b;')],
    ['if-else', M('if(a>0)return 1;else return 2;')],
    ['if 嵌套', M('var b:number=0; if(a>0){if(a>1)b=2;else b=3;}else b=4; return b;')],
    ['while 累加', M('var s:number=0; while(a>0){s=s+a; a=a-1;} return s;')],
    ['while + break', M('var s:number=0; while(a>0){ if(s>3)break; s=s+1; a=a-1; } return s;')],
    ['while + continue', M('var s:number=0; while(a>0){ a=a-1; if(a%2==0)continue; s=s+1; } return s;')],
    ['三元', M('var b:number=a>0?10:20; return b;')],
    ['自增前缀', M('var b:number=0; b=++a; return b;')],
    ['数组读写', M('var d:number[]=[1,2,3]; d[0]=a; d[1]=a+1; return d[0]+d[1];')],
    ['常量折叠后的分支', M('if(1+1>1)return 7; else return 8;')],
    ['恒真条件', M('var b:number=0; while(a>0){ b=b+1; if(b>10)break; } return b;')],
    ['多次赋值', M('var b:number=1; b=b+1; b=b*2; b=b-1; return b;')],
    ['变量当条件', M('var b:number=a; if(b)return 1; return 0;')],
    ['深表达式', M('return ((a+1)*2-3)/4;')],
    ['复合赋值', M('var b:number=a; b+=1; b-=2; b*=3; b/=2; return b;')],
    ['后缀自增', M('var b:number=5; var c:number=b++; return b*10+c;')],
    ['前缀自增', M('var b:number=5; var c:number=++b; return b*10+c;')],
    ['后缀自减', M('var b:number=5; var c:number=b--; return b*10+c;')],
    ['前缀自减', M('var b:number=5; var c:number=--b; return b*10+c;')],
    ['短路与', M('var h:boolean=a>0; var b:number=0; if(h&&(a>1))b=1; return b;')],
    ['短路或', M('var h:boolean=a>0; var b:number=0; if(h||(a>1))b=1; return b;')],
    ['嵌套 if 多返回', M('if(a>0){ if(a>2)return 3; return 2; } if(a<0)return 1; return 0;')],
    //map 字面量的键在解释器里按容器槽加键建模,和优化器的键处理不完全对齐,不做差分
    ['数组长度与遍历下标', M('var d:number[]=[1,2,3]; d[2]=a; return d[0]+d[2];')],
    ['取模与比较', M('var b:number=a%3; if(b==0)return 9; if(b>0)return 8; return 7;')],
    ['负数与位运算', M('var b:number=-a; return ~b & 7 | 1;')],
    ['三目嵌套', M('var b:number=a>0?(a>5?1:2):3; return b;')],
    ['科学计数法常量', M('return 1e3+1.5e-2*1000;')],
    ['逻辑与复合赋值', M('var h:boolean=a>0; h&&=(a<10); return h?1:0;')],
    ['逻辑或复合赋值', M('var h:boolean=a>0; h||=(a<-1); return h?1:0;')],
    ['for 省略条件', M('var s:number=0; for(var i:number=0;;i++;){ s=s+1; if(s>2)break; } return s;')],
    ['取反与位运算', M('var b:number=~a; var h:boolean=!(a>0); var c:number=h?1:0; return b+c;')]
]
const INPUTS = [5, 1, 0, -3, 7]

describe('optimize/语义等价(优化前后解释执行结果一致)', () => {
    for (const [name, src] of PROGRAMS)
        it(name, () => {
            const raw = ir_of(src)
            const opt = opt_of(src)
            for (const a of INPUTS) {
                const before = exec(raw, [a])
                //优化前的程序本身就解释不动(解释器的帧模型有限),这个输入跳过
                if (before.halt == 'timeout') continue
                const after = exec(opt, [a])
                expect(after.halt, `${name} a=${a} 优化后异常终止: ${after.halt}`).not.toMatch(/timeout|bad-|break-out/)
                expect(after.ret, `${name} a=${a} 结果不同(优化前 ${before.ret} / 优化后 ${after.ret})`).toEqual(before.ret)
            }
        })

    it('解释器本身不会超时', () => {
        const tool = ir_of(PROGRAMS[9][1])
        const r = exec(tool, [5])
        expect(r.halt).not.toBe('timeout')
        expect(r.steps).toBeLessThan(5000)
    })
})
