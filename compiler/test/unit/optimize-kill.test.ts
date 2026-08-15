import { describe, expect, it } from 'vitest'
import {
    CALL, CZ, DELETE, IRTool, JZ, LOAD, MOV, PARAM_SET, RETN, TZ
} from '../../utils'
import { kill } from '../../optimize/kill'

//手工构造单块/多块 IR,直接跑逃逸分析,避免 o1 优化提前折叠掉变量
function tool_of(blocks: [number, any[]][], pool: Map<number, number | string> = new Map()): IRTool {
    return new IRTool(100, new Map(blocks) as any, pool)
}
function after_kill(tool: IRTool, bid: number): any[] {
    kill(tool)
    return tool.command.get(bid)
}

describe('kill 逃逸分析:delete 插入', () => {
    it('局部变量仅块内使用 → 在 retn 前插 delete', () => {
        //x=5(槽1);return x(值,非地址);块尾 retn
        const out = after_kill(tool_of([[0, [
            new LOAD(['reg', 1], ['reg', 2]),
            new PARAM_SET(['reg', 0], ['value', 1]),
            new RETN()
        ]]], new Map([[2, 5]])), 0)
        expect(out.length).toBe(4)
        expect(out[2]).toBeInstanceOf(DELETE)
        expect((out[2] as DELETE).data).toEqual(['reg', 1])
        expect(out[3]).toBeInstanceOf(RETN)
    })
    it('return &x(param_set 0 收地址) → x 不删', () => {
        const out = after_kill(tool_of([[0, [
            new LOAD(['reg', 1], ['reg', 2]),   //x=5
            new MOV(['reg', 3], ['reg', 1]),    //t=&x
            new PARAM_SET(['reg', 0], ['value', 3]),
            new RETN()
        ]]], new Map([[2, 5]])), 0)
        expect(out.some((i: any) => i instanceof DELETE && i.data[1] == 1)).toBe(false)
    })
    it('&x 写入跨块读的槽(块外) → x 不删', () => {
        const tool = tool_of([
            [0, [
                new LOAD(['reg', 1], ['reg', 2]),   //x=5
                new MOV(['reg', 9], ['reg', 1]),    //g=&x(g被其他块读)
                new RETN()
            ]],
            [1, [
                new MOV(['reg', 4], ['value', 9]),  //跨块读 g
                new RETN()
            ]]
        ], new Map([[2, 5]]))
        const a = after_kill(tool, 0)
        expect(a.some((i: any) => i instanceof DELETE && i.data[1] == 1)).toBe(false)
    })
    it('跨块 value 读 → 不删', () => {
        const tool = tool_of([
            [0, [new LOAD(['reg', 1], ['reg', 2]), new RETN()]],
            [1, [new MOV(['reg', 4], ['value', 1]), new RETN()]]  //其他块读 x
        ], new Map([[2, 5]]))
        const a = after_kill(tool, 0)
        expect(a.some((i: any) => i instanceof DELETE && i.data[1] == 1)).toBe(false)
    })
    it('thread 传 &x → x 不删', () => {
        const out = after_kill(tool_of([[0, [
            new LOAD(['reg', 1], ['reg', 2]),
            new MOV(['reg', 3], ['reg', 1]),        //t=&x
            new PARAM_SET(['reg', 1], ['value', 3]),//参数1=&x
            new TZ(['value', 5], ['reg', 1]),        //thread
            new RETN()
        ]]], new Map([[2, 5]])), 0)
        expect(out.some((i: any) => i instanceof DELETE && i.data[1] == 1)).toBe(false)
    })
    it('call 传 &x(向内安全) → x 删', () => {
        const out = after_kill(tool_of([[0, [
            new LOAD(['reg', 1], ['reg', 2]),
            new MOV(['reg', 3], ['reg', 1]),        //t=&x
            new PARAM_SET(['reg', 1], ['value', 3]),//参数1=&x(向内)
            new CALL(['value', 5], ['reg', 1]),      //call
            new RETN()
        ]]], new Map([[2, 5]])), 0)
        expect(out.some((i: any) => i instanceof DELETE && i.data[1] == 1)).toBe(true)
    })
    it('重复执行不重复插 delete(去重)', () => {
        const tool = tool_of([[0, [
            new LOAD(['reg', 1], ['reg', 2]),
            new PARAM_SET(['reg', 0], ['value', 1]),
            new RETN()
        ]]], new Map([[2, 5]]))
        kill(tool)
        kill(tool)
        const out = tool.command.get(0)
        expect(out.filter((i: any) => i instanceof DELETE && i.data[1] == 1).length).toBe(1)
    })
    it('无 ret/retn 的块(jmp 结尾)不插 delete', () => {
        const out = after_kill(tool_of([[0, [
            new LOAD(['reg', 1], ['reg', 2]),
            new JZ(['reg', 5], ['reg', 1])
        ]]], new Map([[2, 5]])), 0)
        expect(out.some((i: any) => i instanceof DELETE)).toBe(false)
    })
})

describe('delete/call/cz 指令二进制', () => {
    it('delete 1参:opcode 167,操作数为槽号', () => {
        expect(new DELETE(['reg', 1]).generate()).toEqual([167, 1, 0, 0])
        expect(new DELETE(['value', 1]).generate()).toEqual([168, 1, 0, 0])
    })
    it('call 带 is_func_call=1 标识', () => {
        expect(new CALL(['reg', 7], ['reg', 1]).generate()).toEqual([100, 7, 1, 0])
        expect(new CALL(['value', 7], ['reg', 1]).generate()).toEqual([101, 7, 1, 0])
    })
    it('cz 带 is_func_call=0 标识', () => {
        expect(new CZ(['reg', 7], ['value', 3], ['reg', 0]).generate()).toEqual([89, 7, 3, 0])
    })
})
