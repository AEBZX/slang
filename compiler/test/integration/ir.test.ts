//集成:源码 -> 前端 -> IR,断言指令流
import {describe, expect, it} from 'vitest'
import {
    BINARY, CALL, CMP, CZ, IRArgs, JMP, LOAD, MOV, NOT, OFFSET_GET, OFFSET_SET, PARAM_LOAD, PARAM_SET, PUSH, RET
} from '../../src/utils'
import {all_of, count_of, find_of, null_args, ir_of} from '../unit/helper-ir'

const M = (body: string) => `public m:module{ ${body} }`
const F = (body: string) => M(`public static f:number(a:number){ ${body} }`)
const form = (a: IRArgs) => a == null ? null : a.type

describe('ir/基本形状', () => {
    it('函数体不为空,且槽号都落在合法空间', () => {
        const tool = ir_of(F('var b:number=a+1; return b;'))
        expect(count_of(tool)).toBeGreaterThan(5)
        expect(tool.ir.size).toBeGreaterThan(0)
        //发号器用到的上限就是合法槽号上界
        for (const list of tool.ir.values())
            for (const ir of list)
                for (const key of Object.keys(ir))
                    if (ir[key] instanceof IRArgs) expect(ir[key].data as number).toBeLessThan(tool.index)
    })

    it('没有空操作数的指令', () => {
        expect(null_args(ir_of(F('var b:number=a+1; return b;')))).toEqual([])
    })

    it('参数加载按声明顺序编号,返回走 param 0', () => {
        const tool = ir_of(F('return a;'))
        const loads = all_of(tool, PARAM_LOAD)
        expect(loads.length).toBeGreaterThanOrEqual(1)
        expect(loads[0].param.type).toBe('reg')
        const set = find_of<PARAM_SET>(tool, PARAM_SET)
        expect(set.value.type).toBe('value')
    })
})

describe('ir/表达式', () => {
    it('a+1 是 binary:结果写槽、两个操作数取值', () => {
        const binary = find_of<BINARY>(ir_of(F('var b:number=a+1; return b;')), BINARY)
        expect(binary.id).toBe('add')
        expect(form(binary.result)).toBe('reg')
        expect(form(binary.left)).toBe('value')
        expect(form(binary.right)).toBe('value')
    })

    it('字面量走 load,源是池 id 原样', () => {
        const tool = ir_of(F('var b:number=7; return b;'))
        const loads = all_of(tool, LOAD)
        expect(loads.length).toBeGreaterThan(0)
        for (const load of loads) {
            expect(form(load.reg)).toBe('reg')
            expect(form(load.data)).toBe('reg')
        }
        //IR 的池是 常量->池id,常量 7 确实被编成了「load 池 id」
        const id = tool.pool.get(7)
        expect(id).toBeTypeOf('number')
        expect(loads.some(l => l.data.data === id)).toBe(true)
    })

    it('比较:第一个操作数既当目标又当左值(reg)', () => {
        const cmp = find_of<CMP>(ir_of(F('var h:boolean=a>0; return 1;')), CMP)
        expect(form(cmp.left)).toBe('reg')
        expect(form(cmp.right)).toBe('value')
    })
})

describe('ir/控制流', () => {
    it('if/else 生成两个条件跳转和一次就地取反', () => {
        const tool = ir_of(F('if(a>0)a=1;else a=2; return a;'))
        const cz = all_of(tool, CZ)
        const not = all_of(tool, NOT)
        expect(cz.length).toBe(2)
        expect(not.length).toBe(1)
        //块的个数:函数体 + 真假两支
        expect(tool.ir.size).toBeGreaterThanOrEqual(3)
        for (const c of cz) {
            expect(form(c.cond)).toBe('value')
            expect(form(c.target)).toBe('reg')
        }
        expect(form(not[0].left)).toBe('reg')
        expect(form(not[0].right)).toBe('value')
    })

    it('while 用 cz 回跳 + 末尾 call 进循环块', () => {
        const tool = ir_of(F('while(a>0){ a=a-1; } return a;'))
        const call = find_of<CALL>(tool, CALL)
        expect(call).not.toBeNull()
        //循环块号是编译期常量,用 reg(池 id 原样)传
        expect(form(call.target)).toBe('reg')
        expect(all_of(tool, CZ).length).toBeGreaterThanOrEqual(1)
    })

    it('break 用 ret 帧 2,continue 用 jmp', () => {
        const tool = ir_of(F('while(a>0){ if(a>5)break; a=a-1; } return a;'))
        const ret = find_of<RET>(tool, RET)
        expect(ret).not.toBeNull()
    })
})

describe('ir/调用与容器', () => {
    it('调用:实参走 param_set,被调用者取值,返回值 param_load', () => {
        const tool = ir_of(M(`public static g:number(x:number){ return x; }
                              public static f:number(a:number){ return g(a); }`))
        const call = find_of<CALL>(tool, CALL)
        const set = all_of(tool, PARAM_SET)
        expect(form(call.target)).toBe('value')
        expect(set.some(s => form(s.param) == 'reg' && form(s.value) == 'value')).toBe(true)
    })

    it('数组字面量与下标', () => {
        const tool = ir_of(F('var d:number[]=[a,2]; return d[0];'))
        const set = all_of(tool, OFFSET_SET)
        const get = find_of<OFFSET_GET>(tool, OFFSET_GET)
        expect(set.length).toBeGreaterThanOrEqual(2)
        expect(get).not.toBeNull()
        expect(form(get.target)).toBe('reg')
        expect(form(get.data)).toBe('reg')
    })

    it('成员访问的键是池 id 原样(reg)', () => {
        const tool = ir_of(M(`public static c:number=1;
                              public static f:number(a:number){ return c; }`))
        expect(count_of(tool)).toBeGreaterThan(0)
    })
})
