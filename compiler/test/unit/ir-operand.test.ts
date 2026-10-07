import {describe, expect, it} from 'vitest'
import {pipeline} from './helper'
import ir from '../../ir'
import {BINARY, CALL, CMP, CZ, IN, IRArgs, LOAD, MOV, NOT, OFFSET_GET, OUT, PARAM_LOAD, PARAM_SET} from '../../utils'

//编译到 IR,把所有块里的指令摊平
function compile(src: string): any[] {
    const {hscope, nodes} = pipeline(src)
    const tool: any = ir.run([hscope, nodes] as any)
    const all: any[] = []
    for (const list of tool.ir.values()) all.push(...list)
    return all
}
const one = (src: string, cls: any) => compile(src).find(i => i instanceof cls)
const form = (arg: IRArgs) => arg == null ? null : arg.type

const M = (body: string) => `public m:module{ ${body} }`
const F = (body: string, head = 'public static f:number(a:number)') => M(`${head}{ ${body} }`)

describe('ir/操作数形式', () => {
    it('二元运算:结果写槽(reg),两个操作数取槽里的值(value)', () => {
        const binary: any = one(F('var c:number=a+1; return c;'), BINARY)
        expect(binary.id).toBe('add')
        expect(form(binary.result)).toBe('reg')
        expect(form(binary.left)).toBe('value')
        expect(form(binary.right)).toBe('value')
    })

    it('load:目标是槽,源就是池 id 原样(reg)', () => {
        const load: any = one(F('var c:number=1; return c;'), LOAD)
        expect(form(load.reg)).toBe('reg')
        expect(form(load.data)).toBe('reg')
    })

    it('赋值:左值取槽(reg),右值取值(value)', () => {
        const mov: any = one(F('var c:number=a; return c;'), MOV)
        expect(form(mov.left)).toBe('reg')
        expect(form(mov.right)).toBe('value')
    })

    it('比较:第一个操作数既当目标又当左值(reg),右值取值(value)', () => {
        const cmp: any = one(F('var h:boolean=a>0; return 1;'), CMP)
        expect(form(cmp.left)).toBe('reg')
        expect(form(cmp.right)).toBe('value')
    })

    it('条件跳转:条件是值(value);就地取反要用槽(reg)', () => {
        const all = compile(F('if(a>0)a=1; return a;'))
        const cz: any = all.find(i => i instanceof CZ)
        const not: any = all.find(i => i instanceof NOT)
        expect(form(cz.cond)).toBe('value')
        expect(form(cz.target)).toBe('reg')
        expect(form(not.data)).toBe('reg')
    })

    it('取下标:目标是槽(reg),对象与下标取值(value)', () => {
        const get: any = one(F('var d:number[]=[a]; return d[0];'), OFFSET_GET)
        expect(form(get.target)).toBe('reg')
        expect(form(get.data)).toBe('value')
        expect(form(get.offset)).toBe('value')
    })

    it('后缀自增:结果操作数写穿地址,所以取值(value)', () => {
        const binary: any = one(F('a++; return a;'), BINARY)
        expect(binary.id).toBe('add')
        expect(form(binary.result)).toBe('value')
        expect(form(binary.left)).toBe('value')
    })

    it('调用:被调用者取值(value),实参取值、参数序号取槽(reg)', () => {
        const src = M(`public static g:number(x:number){return x;}
                       public static f:number(a:number){ return g(a); }`)
        const all = compile(src)
        const call: any = all.find(i => i instanceof CALL)
        const set: any = all.find(i => i instanceof PARAM_SET)
        const load: any = all.find(i => i instanceof PARAM_LOAD)
        expect(form(call.target)).toBe('value')
        expect(form(set.value)).toBe('value')
        expect(form(set.param)).toBe('reg')
        expect(form(load.data)).toBe('reg')
    })
})

describe('ir/vm 内联指令按各自的语义取形式', () => {
    it('add:c=a+b —— 结果槽 reg,两个加数 value', () => {
        const binary: any = one(F('var c:number=0; vm("add",c,a,1); return c;'), BINARY)
        expect(form(binary.result)).toBe('reg')
        expect(form(binary.left)).toBe('value')
        expect(form(binary.right)).toBe('value')
    })

    it('mov:目标是槽 reg,源 value', () => {
        const mov: any = one(F('var c:number=0; vm("mov",c,a); return c;'), MOV)
        expect(form(mov.left)).toBe('reg')
        expect(form(mov.right)).toBe('value')
    })

    it('in:oper 取值,data 是原始槽号(要写进去的那个变量)', () => {
        const inn: any = one(F('var c:number=0; vm("in",a,c); return c;'), IN)
        expect(form(inn.oper)).toBe('value')
        expect(form(inn.target)).toBe('reg')
    })

    it('out:oper 与 data 都取值(data 要的是对象句柄)', () => {
        const out: any = one(F('var c:number=0; vm("out",a,c); return c;'), OUT)
        expect(form(out.oper)).toBe('value')
        expect(form(out.target)).toBe('value')
    })
})
