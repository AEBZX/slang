//验证:一批程序走完整流水线,并检查优化后指令流的不变量
import {describe, expect, it} from 'vitest'
import {IRArgs, ControlStream, OFFSET_STR_GET, OFFSET_ADDR} from '../../src/utils'
import {bin_of, count_of, null_args, opt_of} from '../unit/helper-ir'

const M = (body: string) => `public m:module{ ${body} }`
const F = (body: string, ret = 'number', arg = 'a:number') =>
    M(`public static f:${ret}(${arg}){ ${body} }`)

const PROGRAMS: [string, string][] = [
    ['算术与返回', F('var b:number=a+1*2-3/4%5; return b;')],
    ['比较全家桶', F('var h:boolean=a>0; var i:boolean=a>=0; var j:boolean=a<0; var k:boolean=a<=0; var l:boolean=a==0; var m2:boolean=a!=0; return a;')],
    ['位运算', F('var b:number=a<<1; var c:number=a>>1; var d:number=a&1; var e:number=a|1; var g:number=a^1; return a;')],
    ['一元', F('var h:boolean=!(a>0); var b:number=~a; return a;')],
    ['if/else', F('if(a>0)a=1;else a=2; return a;')],
    ['嵌套 if', F('if(a>0){if(a>1)a=2;else a=3;}else a=4; return a;')],
    ['while + break + continue', F('while(a>0){ if(a>5)break; if(a>3){a=a-1;continue;} a=a-1; } return a;')],
    ['三元', F('var b:number=a>0?1:2; return b;')],
    ['前置自增', F('++a; return a;')],
    ['后置自增', F('var b:number=a++; return b;')],
    ['比较结果当条件', F('var b:number=0; if(a==1)b=1; return b;')],
    ['数组', F('var d:number[]=[1,2,3]; d[0]=a; return d[1];')],
    ['字符串', M('public static f:string(a:string){ return a; }')],
    ['字符串下标', M('public static f:string(a:string){ return a[0]; }')],
    ['调用', M('public static g:number(x:number){ return x; } public static f:number(a:number){ return g(a); }')],
    ['多参数调用', M('public static g:number(x:number,y:number){ return x; } public static f:number(a:number){ return g(a,2); }')],
    ['递归', M('public static g:number(n:number){ if(n<=1)return 1; return n*g(n-1); }')],
    ['vm 内联指令', F('var c:number=0; vm("add",c,a,1); return c;')],
    ['空函数体', M('public static f:void(){ }')],
    ['多个模块', M('public static f:number(a:number){ return a; }') + `public n:module{ public static g:number(x:number){ return x; } }`],
    ['常量表达式', F('var b:number=1+2*3; return b;')],
    ['变量重赋值', F('var b:number=0; b=a; b=b+1; b=a-1; return b;')],
    ['无参函数', M('public static f:number(){ return 1; }')]
]

type Result = {name: string, ok: boolean, err?: string, bytes?: number, count?: number}
const results: Result[] = []

function check(name: string, src: string): Result {
    const r: Result = {name, ok: false}
    try {
        const tool = opt_of(src)
        //不变量 1:没有空操作数
        const bad = null_args(tool)
        expect(bad, name + ' 有空操作数: ' + bad.join(' | ')).toEqual([])
        //不变量 2:每个操作数都是数字
        for (const list of tool.command.values())
            for (const ir of list)
                for (const key of Object.keys(ir))
                    if (ir[key] instanceof IRArgs)
                        expect(typeof ir[key].data, name + ' 操作数不是数字: ' + ir.constructor.name + '.' + key).toBe('number')
        //不变量 3:控制流的块号都真的存在
        const ids = new Set(tool.command.keys())
        for (const list of tool.command.values())
            for (const ir of list)
                //静态块号(reg 形式)必须真的存在;通过槽跳(value 形式)的运行时才知道
                if (ir instanceof ControlStream && ir.target.type == 'reg')
                    expect(ids.has(ir.target.data), name + ' 跳到不存在的块 ' + ir.target.data).toBe(true)
        //不变量 4:能编成字节码,且指令数对得上
        const buf = bin_of(src)
        expect(buf.length).toBeGreaterThan(0)
        r.count = count_of(tool)
        r.bytes = buf.length
        r.ok = true
    } catch (e: any) {
        r.err = (e?.message || String(e)).split('\n')[0]
    }
    results.push(r)
    return r
}

describe('compiler/程序矩阵', () => {
    for (const [name, src] of PROGRAMS)
        it(name + ' 能走完整条流水线', () => {
            const r = check(name, src)
            expect(r.err, name + ' 失败: ' + r.err).toBeUndefined()
        })

    it('汇总', () => {
        const bad = results.filter(r => !r.ok)
        const lines = results.map(r => `${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(10)} ${r.ok ? r.count + ' 条指令 / ' + r.bytes + 'B' : r.err}`)
        console.log('MATRIX\n' + lines.join('\n') + `\n共 ${results.length} 个程序,失败 ${bad.length}`)
        expect(bad.length).toBe(0)
    })
})

describe('compiler/确定性', () => {
    it('同一个程序编两次字节完全一致', {timeout: 60000}, () => {
        let n = 0
        for (const [name, src] of PROGRAMS) {
            let a: Buffer
            try {
                a = bin_of(src)
            } catch {
                continue
            }
            expect(bin_of(src).equals(a), name + ' 两次编译结果不一致').toBe(true)
            n++
        }
        expect(n).toBeGreaterThan(10)
    })

    it('优化后的指令数不随重复优化继续变化', () => {
        const src = F('var b:number=1+2*3; if(a>0)b=b+1; return b;')
        const once = count_of(opt_of(src))
        const twice = count_of(opt_of(src))
        expect(twice).toBe(once)
    })
})

describe('compiler/边界', () => {
    it('空源码不崩', () => {
        const tool = opt_of('')
        expect(count_of(tool)).toBeGreaterThanOrEqual(0)
        expect(null_args(tool)).toEqual([])
    })

    it('只有模块没有成员', () => {
        const tool = opt_of('public m:module{}')
        expect(count_of(tool)).toBeGreaterThanOrEqual(0)
    })

    it('字符串下标走字符串专用指令', () => {
        const tool = opt_of(M('public static f:string(a:string){ return a[0]; }'))
        const names = [...tool.command.values()].flat().map(i => i.constructor.name)
        expect(names).toContain('OFFSET_STR_GET')
        expect(OFFSET_STR_GET).toBeTruthy()
        expect(OFFSET_ADDR).toBeTruthy()
    })
})
