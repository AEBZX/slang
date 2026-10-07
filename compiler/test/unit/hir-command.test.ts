import {describe, expect, it} from 'vitest'
import {hir_src, pipeline} from './helper'

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
const hir_of = (src: string) => pipeline(src).nodes[0]
//把函数体的命令拍平(脱糖会给函数体外面再套一层 ListCommand)
function flat_commands(root: any): any[] {
    const fn = deep_find(root, 'HVariable')
    const list = fn.value.commands
    const out: any[] = []
    const walk = (c: any) => {
        if (c == null) return
        if (c.constructor.name == 'HListCommand') c.commands.forEach(walk)
        else out.push(c)
    }
    walk(list)
    return out
}

describe('hir/命令·基本命令', () => {
    it('赋值', () => {
        expect(hir_src(F('a=1; return a;'))).toMatch(/#[0-9]+=1;/)
    })

    it('表达式语句', () => {
        expect(hir_src(M('public static g:void(){ 1+2; }'))).toMatch(/\(1\+2\);/)
    })

    it('return 带值', () => {
        expect(hir_src(F('return a;'))).toMatch(/return #[0-9]+;/)
    })

    it('return 不带值时实参是 null', () => {
        const cs = flat_commands(hir_of(M('public static g:void(){ return; }')))
        //脱糖会在 void 函数体末尾补一句 return this,所以有两个 HReturn
        expect(cs[0].constructor.name).toBe('HReturn')
        expect(cs[0].data).toBe(null)
        expect(cs[1].constructor.name).toBe('HReturn')
    })

    it('break / continue', () => {
        expect(hir_src(M('public static g:void(){ while(true){ break; } }'))).toContain('break;')
        expect(hir_src(M('public static g:void(){ while(true){ continue; } }'))).toContain('continue;')
    })

    it('vm 指令', () => {
        expect(hir_src(M('public static g:void(){ vm("out"); }'))).toContain('vm("out");')
    })

    it('await', () => {
        expect(hir_src(M(`public static g:void(){}
                          public static f:void(){ await g(); }`))).toContain('await ')
    })
})

describe('hir/命令·流程控制', () => {
    it('if', () => {
        expect(hir_src(F('if(a>0){ a=1; } return a;'))).toMatch(/if\(\(#[0-9]+>0\)\)#[0-9]+=1;/)
    })

    it('if-else', () => {
        expect(hir_src(F('if(a>0){ a=1; }else{ a=2; } return a;')))
            .toMatch(/if\(\(#[0-9]+>0\)\)#[0-9]+=1;else #[0-9]+=2;/)
    })

    it('while', () => {
        expect(hir_src(F('while(a>0){ a=a-1; } return a;'))).toMatch(/while\(\(#[0-9]+>0\)\)#[0-9]+=\(#[0-9]+-1\);/)
    })

    it('条件不是 boolean 时脱糖会补 != null', () => {
        expect(hir_src(F('if(a){ a=1; } return a;'))).toMatch(/if\(\(#[0-9]+!=null\)\)/)
    })

    it('命令列表按顺序保留', () => {
        const out = hir_src(F('a=1; a=2; return a;'))
        expect(out.indexOf('=1;')).toBeLessThan(out.indexOf('=2;'))
    })
})

describe('hir/命令·节点形状', () => {
    it('赋值是 HAssign', () => {
        expect(flat_commands(hir_of(F('a=1; return a;')))[0].constructor.name).toBe('HAssign')
    })

    it('if 是 HIfStatement,while 是 HWhileStatement', () => {
        const cs = flat_commands(hir_of(F('if(a>0){a=1;} while(a>0){a=2;} return a;')))
        expect(cs[0].constructor.name).toBe('HIfStatement')
        expect(cs[1].constructor.name).toBe('HWhileStatement')
    })

    it('vm 是 HVM', () => {
        expect(deep_find(hir_of(M('public static g:void(){ vm("out"); }')), 'HVM')).toBeTruthy()
    })

    it('return 是 HReturn', () => {
        expect(flat_commands(hir_of(F('return a;')))[0].constructor.name).toBe('HReturn')
    })

    it('表达式语句是 HExprCommand', () => {
        expect(flat_commands(hir_of(M('public static g:void(){ 1+2; }')))[0].constructor.name).toBe('HExprCommand')
    })

    it('break / continue 是 HBreak / HContinue', () => {
        expect(deep_find(hir_of(M('public static g:void(){ while(true){ break; } }')), 'HBreak')).toBeTruthy()
        expect(deep_find(hir_of(M('public static g:void(){ while(true){ continue; } }')), 'HContinue')).toBeTruthy()
    })

    it('await 是 HAwait', () => {
        expect(deep_find(hir_of(M(`public static g:void(){}
                                   public static f:void(){ await g(); }`)), 'HAwait')).toBeTruthy()
    })
})

describe('hir/命令·已知缺陷', () => {
    //已知缺陷:compiler/hir/expr.ts:123 —— check 给每次函数调用设的 call_target
    //让脱糖把 callee 改写成点路径,而 HIR 用裸名查符号表,查不到就新分配 id,调用目标错掉。
    it.fails('同模块函数调用应该指向函数自己的 id', () => {
        const out = hir_src(M(`public static g:number(x:number){return x;}
                               public static f:number(){ return g(1); }`))
        expect(out).toContain('(#2(1))')
    })

    it.fails('await 的调用目标也应该指向函数自己的 id', () => {
        const out = hir_src(M(`public static g:void(){}
                               public static f:void(){ await g(); }`))
        //g 的 id 是 2
        expect(out).toContain('await #2()')
    })
})
