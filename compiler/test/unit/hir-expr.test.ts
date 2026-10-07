import {describe, expect, it} from 'vitest'
import {hir_src, pipeline, render} from './helper'

const M = (body: string) => `public m:module{ ${body} }`
const F = (body: string, head = 'public static f:number(a:number)') => M(`${head}{ ${body} }`)

//在 HIR 树里按类名深度查找第一个匹配节点
function deep_find(v: any, cls: string, seen = new Set<any>()): any {
    if (v == null || typeof v != 'object' || seen.has(v)) return null
    seen.add(v)
    if (v.constructor && v.constructor.name == cls) return v
    if (Array.isArray(v)) {
        for (const i of v) {
            const r = deep_find(i, cls, seen)
            if (r) return r
        }
        return null
    }
    for (const k of Object.keys(v)) {
        const r = deep_find(v[k], cls, seen)
        if (r) return r
    }
    return null
}

describe('hir/表达式·字面量', () => {
    it('数字字面量转成 JS number', () => {
        expect(hir_src(F('return 1;'))).toContain('return 1;')
        expect(hir_src(F('return 1.5;'))).toContain('return 1.5;')
    })

    it('进制字面量按各自的进制换算', () => {
        expect(hir_src(F('return 0x1F;'))).toContain('return 31;')
        expect(hir_src(F('return 0b1010;'))).toContain('return 10;')
        expect(hir_src(F('return 0o17;'))).toContain('return 15;')
    })

    it('字符串字面量直接用词法阶段去掉引号后的值', () => {
        //回归:这里若再 slice 一次会把首尾字符吃掉
        expect(hir_src(M("public static g:string(){ return 'ab'; }"))).toContain('return "ab";')
        expect(hir_src(M('public static g:string(){ return "a"; }'))).toContain('return "a";')
    })

    it('布尔字面量转成真正的 boolean', () => {
        expect(hir_src(M('public static g:boolean(){ return true; }'))).toContain('return true;')
        expect(hir_src(M('public static g:boolean(){ return false; }'))).toContain('return false;')
    })

    it('null 保留成 HNullLiteral', () => {
        expect(hir_src(M('public static g:void(){ return null; }'))).toContain('return null;')
    })

    it('数组元素与下标都是 HIR 节点', () => {
        const out = hir_src(F('var x:number[]=[1,2,3]; return x[0];'))
        expect(out).toContain('[1,2,3]')
        expect(out).toMatch(/return \(#[0-9]+\[0\]\);/)
    })

    it('Map 字面量的值与键', () => {
        const out = hir_src(M(`public static g:number{}(d:number){ return [k:d]; }`))
        expect(out).toContain('[k:')
    })
})

describe('hir/表达式·标识符与作用域', () => {
    it('标识符被换成作用域里分配的数字 id', () => {
        //参数表里除了 a 还有一个隐式 this 槽
        expect(hir_src(F('return a;'))).toMatch(/\(#[0-9]+(?:,#[0-9]+)*\)=>return #[0-9]+;/)
    })

    it('同一个名字在作用域内解析到同一个 id', () => {
        const out = hir_src(F('var x:number=1; var y:number=x; return x;'))
        const ids = [...out.matchAll(/#(\d+)/g)].map(m => m[1])
        expect(new Set(ids).size).toBeLessThan(ids.length)
    })

    it('lambda 参数会进入参数表并拿到自己的 id', () => {
        const out = hir_src(M('public static f:number(){ var g:(x:number)=>number=(x:number)=>number{return x;}; return 1; }'))
        expect(out).toMatch(/\(#[0-9]+\)=>return #[0-9]+;/)
    })

    it('lambda 里的同名参数遮蔽外层,出 lambda 后外层恢复', () => {
        const out = hir_src(F(`var a:number=1;
                               var g:(x:number)=>number=(a:number)=>number{return a;};
                               var b:number=a;
                               return b;`))
        const outer = out.match(/#(\d+)=1;/)
        const param = out.match(/\(#(\d+)\)=>return #\d+;/)
        expect(outer).not.toBeNull()
        expect(param).not.toBeNull()
        //参数用的是新 id
        expect(param![1]).not.toBe(outer![1])
        //lambda 之后引用 a 又回到外层 id
        expect(out).toMatch(new RegExp(`#\\d+=#${outer![1]};`))
    })

    it('成员访问会用点路径去查符号表', () => {
        const out = hir_src(M(`public static v:number=1;
                               public static g:number(){ return m.v; }`))
        expect(out).toMatch(/return \(#[0-9]+\.[0-9]+\);/)
    })

    it('三元 / 逻辑非 / 按位取反都映射到对应的 HIR 节点', () => {
        expect(hir_src(F('return a>0?1:2;'))).toMatch(/return \(\(#[0-9]+>0\)\?1:2\);/)
        expect(hir_src(M('public static g:boolean(a:boolean){ return !a; }'))).toMatch(/return \(!#[0-9]+\);/)
        expect(hir_src(F('return ~a;'))).toMatch(/return \(~#[0-9]+\);/)
    })

    it('负号已经在脱糖阶段展开成 0 减', () => {
        expect(hir_src(F('return -a;'))).toMatch(/return \(0-#[0-9]+\);/)
    })

    it('二元运算保留运算符', () => {
        expect(hir_src(F('return a+1;'))).toMatch(/return \(#[0-9]+\+1\);/)
        expect(hir_src(F('return a*2-1;'))).toMatch(/return \(\(#[0-9]+\*2\)-1\);/)
    })

    it('前后缀自增自减', () => {
        const out = hir_src(F('a++; ++a; return a;'))
        expect(out).toContain('(#')
        expect(out).toContain('(++')
    })
})

describe('hir/表达式·调用目标与 link 解析', () => {
    it('同模块内调用函数解析到函数自己的 id', () => {
        const out = hir_src(M(`public static g:number(x:number){return x;}
                               public static f:number(){ return g(1); }`))
        //m 是 1、g 是 2,调用点要写成对 m.g 的成员访问
        expect(out).toContain('((#1.2)(1))')
    })

    it('通过 link 别名做成员访问解析到目标模块的成员 id', () => {
        const out = hir_src(`link std.io as io;
public std:module{ public io:module{ public static print:void(){} } }
public m:module{ public static f:void(){ io.print(); } }`)
        //std 是 1、io 是 2、print 是 3,别名要展开成 std.io.print
        expect(out).toContain('(((#1.2).3)())')
    })

    it('通过 link 别名直接调用解析到函数自己的 id', () => {
        const out = hir_src(`link std.io.print as print;
public std:module{ public io:module{ public static print:void(){} } }
public m:module{ public static f:void(){ print(); } }`)
        expect(out).toContain('(((#1.2).3)())')
    })

    it('运算符重载的目标按点路径解析', () => {
        const {nodes, hscope} = pipeline(`value number{ operation + (a:number,b:number)=>number{ return a; } }
public m:module{ public static f:number(a:number){ return a+1; } }`)
        //脱糖把 a+1 变成对 number.+@0 的调用,调用目标必须正好是那个函数的符号
        const call = deep_find(nodes[0], 'HArgumentsExpr')
        expect(call.target.member).toBe(hscope.get('number.+@0'))
    })

    it('跨模块的全路径调用解析到函数自己的 id', () => {
        const out = hir_src(`public std:module{ public math:module{ public static pow:number(a:number,b:number){return a;} } }
public m:module{ public static f:number(){ return std.math.pow(2,3); } }`)
        //std 是 1、math 是 2、pow 是 3
        expect(out).toContain('((#1.2).3)(2,3)')
    })

    it('枚举成员按点路径解析', () => {
        const out = hir_src(M(`public E:enum{A,B}
                               public static f:number(){ return m.E.A; }`))
        //m 是 1、E 是 2、成员 A 是 3
        expect(out).toContain('((#1.2).3)')
    })
})

describe('hir/表达式·HIR 节点形状', () => {
    it('顶层是 HModule,名字为 null', () => {
        const {nodes} = pipeline(M(''))
        expect(nodes.length).toBe(1)
        expect(nodes[0].constructor.name).toBe('HModule')
        expect(nodes[0].name).toBe(null)
    })

    it('模块内第一个块是名字为 1 的 HModule', () => {
        const {nodes} = pipeline(M(''))
        expect(nodes[0].children[0].constructor.name).toBe('HModule')
        expect(nodes[0].children[0].name).toBe(1)
    })

    it('函数脱糖成 HVariable,值是 HLambdaExpr', () => {
        const {nodes} = pipeline(M('public static f:number(a:number){return a;}'))
        const fn = nodes[0].children[0].children[0]
        expect(fn.constructor.name).toBe('HVariable')
        expect(fn.value.constructor.name).toBe('HLambdaExpr')
    })

    it('渲染是纯函数,重复渲染结果一致', () => {
        const {nodes} = pipeline(M('public static v:number=1;'))
        expect(render(nodes[0])).toBe(render(nodes[0]))
    })
})
