import {describe, expect, it} from 'vitest'
import {pipeline, render} from './helper'
import {HScope} from '../../hir/tool'

const M = (body: string) => `public m:module{ ${body} }`

//深度查找
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
const all_of = (v: any, cls: string, out: any[] = [], seen = new Set<any>()): any[] => {
    if (v == null || typeof v != 'object' || seen.has(v)) return out
    seen.add(v)
    if (v.constructor && v.constructor.name == cls) out.push(v)
    const vals = Array.isArray(v) ? v : Object.keys(v).map(k => v[k])
    for (const i of vals) all_of(i, cls, out, seen)
    return out
}

describe('hir/块·File 与 Module', () => {
    it('File 变成名字为 null 的 HModule', () => {
        const {nodes} = pipeline(M(''))
        expect(nodes.length).toBe(1)
        expect(nodes[0].constructor.name).toBe('HModule')
        expect(nodes[0].name).toBe(null)
    })

    it('File 的 children 逐个进 HModule', () => {
        const {nodes} = pipeline('public a:module{}\npublic b:module{}')
        expect(nodes[0].children.length).toBe(2)
        expect(nodes[0].children[0].name).toBe(1)
        expect(nodes[0].children[1].name).toBe(2)
    })

    it('模块 id 由 HScope 顺序分配', () => {
        expect(render(pipeline('public a:module{}').nodes[0])).toBe('null:module{1:module{}}')
    })

    it('嵌套模块套在 HModule 里', () => {
        const {nodes} = pipeline('public a:module{ public b:module{} }')
        const outer = nodes[0].children[0]
        expect(outer.constructor.name).toBe('HModule')
        expect(outer.children[0].constructor.name).toBe('HModule')
    })

    it('模块名带上了祖先路径', () => {
        const {hscope} = pipeline('public a:module{ public b:module{} }')
        expect(hscope.get('a.b')).toBeTruthy()
    })

    it('类的成员也会进 HModule', () => {
        const {nodes} = pipeline('public std:module{ public ObjectInterface:interface{} }\n' +
            'public m:module{ public C:class{ public static v:number=1; } }')
        const inner = deep_find(nodes[0], 'HModule')
        expect(inner.children.some((c: any) => c.constructor.name == 'HModule')).toBe(true)
    })
})

describe('hir/块·Variable', () => {
    it('静态变量标成 _static', () => {
        const {nodes} = pipeline(M('public static v:number=1;'))
        const v = deep_find(nodes[0], 'HVariable')
        expect(v._static).toBe(true)
        expect(v.entry).toBe(false)
    })

    it('实例成员不是 _static', () => {
        const {nodes} = pipeline('public std:module{ public ObjectInterface:interface{} }\n' +
            'public m:module{ public C:class{ public v:number=1; } }')
        const vars = all_of(nodes[0], 'HVariable').filter(v => v.value.constructor.name == 'HNumberLiteral')
        expect(vars[0]._static).toBe(false)
    })

    it('名字以 main 结尾的变量是入口', () => {
        const {nodes} = pipeline(M('public static main:void(){}'))
        const v = deep_find(nodes[0], 'HVariable')
        expect(v.entry).toBe(true)
    })

    it('名字不叫 main 的不是入口', () => {
        const {nodes} = pipeline(M('public static f:void(){}'))
        expect(deep_find(nodes[0], 'HVariable').entry).toBe(false)
    })

    it('main 经过路径与重载序号的修饰后仍然能识别出来', () => {
        //脱糖后名字是 main@0,路径前缀是模块名
        const {nodes} = pipeline('public a:module{ public b:module{ public static main:void(){} } }')
        expect(deep_find(nodes[0], 'HVariable').entry).toBe(true)
    })
})

describe('hir/块·link', () => {
    it('link 的别名写进 link_target', () => {
        const {hscope} = pipeline(`link std.io as io;
public std:module{ public io:module{} }
public m:module{}`)
        expect(hscope.link_target.get('io')).toBe('std.io')
    })

    it('逐个 link 都记录', () => {
        const {hscope} = pipeline(`link std.io as io;
link std.math as math;
public std:module{ public io:module{} public math:module{} }
public m:module{}`)
        expect(hscope.link_target.get('io')).toBe('std.io')
        expect(hscope.link_target.get('math')).toBe('std.math')
    })
})

describe('hir/HScope', () => {
    it('根作用域从空路径开始', () => {
        expect(new HScope(null, null).path).toBe('')
    })

    it('path_ 逐段拼接', () => {
        const s = new HScope(null, null)
        expect(s.path_('m')).toBe('m')
        expect(s.path_('n')).toBe('m.n')
        expect(s.path).toBe('m.n')
    })

    it('id 自增', () => {
        const s = new HScope(null, null)
        expect(s.id()).toBe(1)
        expect(s.id()).toBe(2)
    })

    it('get 首次分配 id,之后复用', () => {
        const s = new HScope(null, null)
        const id = s.get('x')
        expect(id).toBe(1)
        expect(s.get('x')).toBe(1)
        expect(s.get('y')).toBe(2)
    })

    it('子作用域优先查自己,再查 parent', () => {
        const root = new HScope(null, null)
        root.set('x', 10)
        const inner = new HScope(root, root)
        expect(inner.get('x')).toBe(10)
        inner.set('x', 11)
        expect(inner.get('x')).toBe(11)
        expect(root.get('x')).toBe(10)
    })

    it('enter / leave 成对', () => {
        const root = new HScope(null, null)
        const inner = root.enter()
        expect(inner.parent).toBe(root)
        expect(inner.leave()).toBe(root)
    })

    it('enter 出来的子作用域沿用 parent 的 path', () => {
        const root = new HScope(null, null)
        root.path = 'm'
        expect(root.enter().path).toBe('m')
    })

    it('带 global 时 id 统一由 global 分配', () => {
        const root = new HScope(null, null)
        const inner = new HScope(root, root)
        const a = inner.id()
        const b = root.id()
        expect(b).toBe(a + 1)
    })

    it('lnk / lnk_get 会沿 parent 往上找', () => {
        const root = new HScope(null, null)
        root.lnk(5, 9)
        expect(root.lnk_get(5)).toBe(9)
        const inner = new HScope(root, root)
        expect(inner.lnk_get(5)).toBe(9)
        expect(inner.lnk_get(6)).toBe(null)
    })

    it('自己登记过的 link 优先于 parent', () => {
        const root = new HScope(null, null)
        root.lnk(5, 9)
        const inner = new HScope(root, root)
        inner.lnk(5, 99)
        expect(inner.lnk_get(5)).toBe(99)
    })

    it('根作用域的 parent 为 null 也不会炸', () => {
        const root = new HScope(null, null)
        expect(root.get('x')).toBeTruthy()
        expect(root.lnk_get(1)).toBe(null)
    })
})
