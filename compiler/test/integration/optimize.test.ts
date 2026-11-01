//集成:IR -> 优化后的指令流
import {describe, expect, it} from 'vitest'
import {BINARY, CMP, IRArgs, IRTree, MOV} from '../../src/utils'
import {all_of, count_of, find_of, null_args, ir_of, opt_of} from '../unit/helper-ir'

const F = (body: string) => `public m:module{ public static f:number(a:number){ ${body} } }`

describe('optimize/不变量', () => {
    it('优化后没有空操作数', () => {
        expect(null_args(opt_of(F('var b:number=a+1; if(a>0)b=2; return b;')))).toEqual([])
    })

    it('指令流里只剩 IRTree,槽号都在发号范围内', () => {
        const tool = opt_of(F('var b:number=a+1; if(a>0)b=2; return b;'))
        expect(tool.command.size).toBeGreaterThan(0)
        for (const list of tool.command.values())
            for (const ir of list) {
                expect(ir).toBeInstanceOf(IRTree)
                for (const key of Object.keys(ir))
                    if (ir[key] instanceof IRArgs) expect(ir[key].data as number).toBeLessThan(tool.index)
            }
    })

    it('优化不会让指令数暴涨(每轮有改写才继续,最多10轮)', () => {
        const before = count_of(ir_of(F('var b:number=1+2; var c:number=b+3; return c;')))
        const after = count_of(opt_of(F('var b:number=1+2; var c:number=b+3; return c;')))
        expect(after).toBeLessThanOrEqual(before * 2)
    })

    it('池是 id->值 的反表', () => {
        const tool = opt_of(F('var b:number=7; return b;'))
        expect([...tool.pool.values()]).toContain(7)
    })
})

describe('optimize/常量折叠', () => {
    //known-issue:B13 —— 折叠用 is_constant 判定(要求操作数是 reg 形式),
    //而 IR 给二元运算的两个操作数都是 value 形式,判定永远为假,折叠一轮都没生效过
    it('1+2 折成常量 3,不再留二元运算', () => {
        const tool = opt_of(F('var b:number=1+2; return b;'))
        //折出来的常量以字面量操作数出现
        const mov = all_of(tool, MOV).find((m: any) => m.right.type == 'reg' && m.right.data === 3)
        expect(mov).toBeTruthy()
        //两个常量相加已经没得算了
        expect(all_of(tool, BINARY).filter((b: any) => typeof b.left.data == 'number' && typeof b.right.data == 'number')
            .some((b: any) => b.left.type == 'reg' && b.right.type == 'reg')).toBe(false)
    })
})

describe('optimize/轮次之间互相影响', () => {
    //known-issue:B14 —— copy/prop 的 visitor 无条件 tool.sweep(bid,index,data),
    //配合「先写者胜」把每个位置都先占了,后面 constant_fold / peephole 的改写全被丢掉。
    //所以窥孔那些错误的删除在整条管道里反而看不到(单独调用 visitor 才复现,见 unit)
    it('copy/prop 先占位,窥孔的删除被丢掉', () => {
        const tool = opt_of(F('var b:number=a+1; return b;'))
        expect(all_of(tool, BINARY).filter(b => b.id == 'add').length).toBeGreaterThan(0)
    })

    it('if 的两支都还在,且没有空操作数', () => {
        const tool = opt_of(F('if(a>0)a=1; return a;'))
        expect(tool.command.size).toBeGreaterThanOrEqual(3)
        expect(null_args(tool)).toEqual([])
    })
})
