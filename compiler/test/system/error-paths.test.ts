//系统测试:错误路径。每个特性都要有对应的负例,且报的是"具体那一条"
import {describe, expect, it} from 'vitest'
import {check_src} from '../unit/helper'
import {opt_of} from '../unit/helper-ir'

const M = (b: string) => `public m:module{ public static f:number(a:number){ ${b} } }`
const has = (errs: string[], s: string) => errs.some(e => e.includes(s))
const errs_of = (b: string) => check_src(M(b))

//[名称, 函数体, 期望出现在诊断里的片段]
const CASES: [string, string, string][] = [
    ['声明类型不符', 'var b:number="s"; return a;', '赋值类型错误'],
    ['未定义变量', 'return zzz;', '未定义的变量zzz'],
    ['未定义函数', 'return ggg(1);', '未定义的变量ggg'],
    ['比较类型不符', 'var h:boolean=a>"s"; return a;', '二元运算符>的类型错误'],
    ['非操作符要布尔', 'var h:boolean=!a; return a;', '非操作符只能用于boolean类型'],
    ['return 类型不符', 'return "s";', '返回类型错误'],
    ['三元分支类型不符', 'var b:number=a>0?1:"s"; return b;', '三元运算符的true/false表达式不是同一类型'],
    ['赋值给常量', '1=2; return a;', '赋值的左侧不是可赋值的左值'],
    ['break 在循环外', 'break; return a;', 'break/continue只能在循环中使用'],
    ['continue 在循环外', 'continue; return a;', 'break/continue只能在循环中使用'],
    ['成员不存在', 'return a.zzz;', 'zzz不存在'],
    ['switch case 类型不符', 'switch(a){case "s"=>a=1;} return a;', 'switch case的类型和switch的类型不一致'],
    ['数组声明元素不符', 'var d:number[]=["s"]; return a;', '数组元素类型错误'],
    ['数组元素之间不一致', 'var d:number[]=[1,"s"]; return a;', '数组元素的类型不一致'],
    ['数组下标类型错', 'var d:number[]=[1]; return d["s"];', 'array的索引只能是number'],
    ['string 下标类型错', 'var s:string="a"; return s["x"];', 'string的索引只能是number'],
    ['cast 不存在', 'return (number)"s";', '类型转换失败'],
    ['泛型未声明', 'var x:@T=a; return x;', '泛型T不存在'],
    ['变量名重复', 'var b:number=1; var b:number=2; return a;', '重复声明'],
    ['void 声明', 'var b:void=1; return a;', '声明类型为void'],
    ['string[] 赋给 number[]', 'var s:string[]=["a"]; var d:number[]=s; return a;', '赋值类型错误'],
    ['数组整体赋给另一数组', 'var s:string[]=["a"]; var d:number[]=[1]; d=s; return a;', '赋值类型错误'],
    ['非空数组赋给 map', 'var d:number[]=[1]; var m:number{}=d; return a;', '赋值类型错误'],
    ['非空 map 赋给数组', 'var m:number{}=[k:1]; var d:number[]=m; return a;', '赋值类型错误']
]

describe('system/错误路径', () => {
    for (const [name, body, want] of CASES)
        it(name, () => {
            const errs = errs_of(body)
            expect(errs.length, name + ' 应该报错').toBeGreaterThan(0)
            expect(errs.some(e => e.includes(want)), name + ' 诊断: ' + JSON.stringify(errs)).toBe(true)
        })

    it('每条诊断都带行号和列号', () => {
        for (const [, body] of CASES)
            for (const e of errs_of(body))
                expect(/at line:\d+:\d+/.test(e), body + ' -> ' + e).toBe(true)
    })
})

describe('system/错误路径·不该报错的情形', () => {
    const OK: [string, string][] = [
        ['空数组字面量', 'var d:number[]=[]; return a;'],
        ['同类型数组', 'var d:number[]=[1,2]; return a;'],
        ['字符串数组', 'var d:string[]=["a","b"]; return a;'],
        ['除零常量(运行期问题)', 'return a/0;'],
        ['空语句块', '{ } return a;'],
        ['同类型赋值', 'var b:number=a; return b;'],
        ['同元素类型数组赋值', 'var s:number[]=[1]; var d:number[]=s; return a;'],
        ['字符串数组赋值', 'var s:string[]=["a"]; var d:string[]=s; return a;'],
        ['空字面量既能当空数组也能当空 map', 'var m:number{}=[]; return a;'],
        ['正常 map 字面量', 'var m:number{}=[k:1]; return a;']
    ]
    for (const [name, body] of OK)
        it(name, () => {
            expect(errs_of(body), name).toEqual([])
        })

    it('报错时不会产生字节码', () => {
        //check 阶段抛错,pipeline 不会走到优化/编码
        expect(() => opt_of(M('return zzz;'))).toThrow()
    })
})
