import {describe, expect, it} from 'vitest'
import {IRArgs, LOAD, OFFSET_GET, OFFSET_SET} from '../../src/utils'
import {all_of, opt_of, ir_of} from './helper-ir'

//成员访问的键是字符串常量,原始 IR 里以「池 id 原样」传;
//last 轮要把它搬进槽、操作数改成读槽(value),因为右值 reg 只能是立即数
const SRC = `
public n:module{ public static v:number; }
public m:module{ public static f:number(a:number){ return n.v; } }
`
const args = (ir: any) => Object.keys(ir).filter(k => ir[k] instanceof IRArgs).map(k => ir[k] as IRArgs)

describe('optimize/last·字符串操作数搬进槽', () => {
    //成员名是字符串常量,不能以 reg(池 id) 当右值,必须是"读槽"
    it('生成时成员键就是读槽(value)形式', () => {
        const tool = ir_of(SRC) as any
        const get = all_of(tool, OFFSET_GET)[0]
        expect(get).toBeDefined()
        expect(get.offset.type).toBe('value')
    })

    it('优化后成员键变成读槽(value 形式)', () => {
        const tool = opt_of(SRC)
        const get = all_of(tool, OFFSET_GET)[0]
        expect(get.offset.type).toBe('value')
    })

    it('引用成员之前会有一条 load 把池里的常量搬进槽', () => {
        const tool = ir_of(SRC) as any
        const get = all_of(tool, OFFSET_GET)[0]
        const slot = get.offset.data
        expect(all_of(tool, LOAD).some((l: LOAD) => l.reg.data === slot)).toBe(true)
    })

    it('同一个字符串键只搬一次', () => {
        const tool = ir_of(`
            public n:module{ public static v:number; }
            public m:module{ public static f:number(a:number){
                var x:number=n.v; var y:number=n.v; return x+y; } }
        `) as any
        const slots = new Set(all_of(tool, OFFSET_GET).map((g: any) => g.offset.data))
        const loads = all_of(tool, LOAD).filter((l: LOAD) => slots.has(l.reg.data))
        expect(loads.length).toBe(slots.size)
    })

    it('数字操作数不被搬(立即数保持 reg)', () => {
        const tool = opt_of(`public m:module{ public static f:number(a:number){ return a+1; } }`)
        const operands = [...tool.command.values()].flat().flatMap(args)
        //所有数字操作数要么是槽(reg)、要么是读槽(value),但都要是非负整数
        expect(operands.every(a => Number.isInteger(a.data) && a.data >= 0)).toBe(true)
    })

    it('last 之后没有残留的字符串 reg 操作数', () => {
        const tool = opt_of(SRC)
        const bad = [...tool.command.values()].flat()
            .flatMap((ir: any) => args(ir).map(a => ({ir, a})))
            .filter(({a}) => a.type == 'reg' && !Number.isInteger(a.data))
        expect(bad.map(({ir}) => ir.constructor.name)).toEqual([])
    })
})

describe('optimize/last·offset_set 的键同样处理', () => {
    it('数组下标写入的键是池 id,读槽形式对齐', () => {
        const tool = opt_of(`public m:module{ public static f:number(a:number){ var d:number[]=[1]; d[0]=a; return d[0]; } }`)
        const set = all_of(tool, OFFSET_SET)[0]
        expect(set).toBeDefined()
        //静态下标的键保持 reg(池 id),动态下标才是读槽
        expect(['reg', 'value']).toContain(set.offset.type)
    })
})
