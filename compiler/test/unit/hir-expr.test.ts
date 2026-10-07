import {describe, expect, it} from 'vitest'
import {hir_src, pipeline, render} from './helper'

const M = (body: string) => `public m:module{ ${body} }`
const F = (body: string, head = 'public static f:number(a:number)') => M(`${head}{ ${body} }`)

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

describe('hir/表达式·已知缺陷', () => {
    //已知缺陷:compiler/hir/expr.ts:123 的 H_MemberExpr
    //check 会给每次函数调用设 call_target(形如 m.g@0),脱糖把它改写成点路径 MemberPostfix(m,'g@0'),
    //但这个合成出来的 IdentifierExpr('m') 没有 type,于是 H_MemberExpr 走最后一条分支用裸名 scope.get('g@0'),
    //而符号表里注册的是 'm.g@0' —— 查不到就新分配一个 id,调用目标彻底错掉。
    it.fails('同模块内调用函数应该解析到函数自己的 id', () => {
        const out = hir_src(M(`public static g:number(x:number){return x;}
                               public static f:number(){ return g(1); }`))
        //g 的 id 是 2,调用点必须也是 2
        expect(out).toContain('(#2(1))')
    })

    //已知缺陷:compiler/hir/expr.ts:107-118
    //命中 link 别名后,lnk_name 取的是最后一段名字('print')而不是匹配上的前缀('io'),
    //postfix 又从头切,于是 scope.get 拿到的键是 'print.print' 这种不存在的名字,只能新分配 id。
    it.fails('通过 link 别名做成员访问应该解析到目标模块的成员 id', () => {
        const out = hir_src(`link std.io as io;
public std:module{ public io:module{ public static print:void(){} } }
public m:module{ public static f:void(){ io.print(); } }`)
        expect(out).not.toMatch(/\(#[0-9]+\.[0-9]+\)\.\d+/)
    })

    //同上:别名调用一样会被 call_target 改写成点路径,同样是查错符号
    it.fails('通过 link 别名直接调用应该解析到函数自己的 id', () => {
        const out = hir_src(`link std.io.print as print;
public std:module{ public io:module{ public static print:void(){} } }
public m:module{ public static f:void(){ print(); } }`)
        //print 的真实 id 是 3,调用点不能出现别的 id
        expect(out).toContain('(#3())')
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
