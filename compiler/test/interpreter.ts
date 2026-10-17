//精简 IR 解释器:只是为了验证"优化前后语义一致",不是完整的 VM
//语义按作者约定:右值 reg=立即数、左值 reg=槽号、value=读槽、load 的源是池 id
import {
    BINARY, BIT_NOT, CMP, IRArgs, IRTree, LOAD, MOV, NOT,
    OFFSET_GET, OFFSET_SET, PARAM_LOAD, PARAM_SET, POP, PUSH, RET, ControlStream
} from '../src/utils'

const int32 = (v: any) => {
    const n = typeof v == 'number' ? (Number.isFinite(v) ? Math.trunc(v) : 0) : 0
    return n | 0
}
const truthy = (v: any) => typeof v == 'number' ? v != 0 : (v == null || v == '\0' ? false : String(v).length > 0)

const BIN: Record<string, (a: any, b: any) => number> = {
    add: (a, b) => a + b,
    sub: (a, b) => a - b,
    mul: (a, b) => a * b,
    div: (a, b) => a / b,
    mod: (a, b) => int32(a) % int32(b),
    shl: (a, b) => int32(a) << int32(b),
    shr: (a, b) => int32(a) >> int32(b),
    and: (a, b) => int32(a) & int32(b),
    or: (a, b) => int32(a) | int32(b),
    xor: (a, b) => int32(a) ^ int32(b)
}
const CMP_FN: Record<number, (a: any, b: any) => number> = {
    0: (a, b) => a == b ? 1 : 0,
    1: (a, b) => a > b ? 1 : 0,
    2: (a, b) => a >= b ? 1 : 0,
    3: (a, b) => a != b ? 1 : 0,
    4: (a, b) => a < b ? 1 : 0,
    5: (a, b) => a <= b ? 1 : 0
}

export type exec_result = {ret: any, steps: number, halt: string}

//函数体所在的块:单函数程序里指令最多那块
export function body_block(tool: any): number {
    const flow: Map<number, any[]> = tool.command ?? tool.ir
    const entries = [...flow.entries()]
    //优先选函数块(以 RET frame=1 结束),没有函数块时退回指令最多的块
    const fn = entries.filter(([, list]) =>
        list.some((i: any) => i.constructor.name == 'RET' && i.frame != null && i.frame.data == 1))
    const pick = fn.length > 0 ? fn : entries
    return pick.reduce((a, b) => b[1].length > a[1].length ? b : a)[0]
}

export function exec(tool: any, args: number[] = [], max_steps = 100000): exec_result {
    //字节码流:IRTool 用 .ir,OPTTool 用 .command
    const flow: Map<number, IRTree[]> = tool.command ?? tool.ir
    //常量池统一成 id -> 值:IRTool 的 pool 是 值->id,OPTTool 的已经是 id->值
    const pool = new Map<number, any>()
    if (tool.cprop_table == null)
        for (const [v, id] of tool.pool as Map<any, number>) pool.set(id, v)
    else
        for (const [id, v] of tool.pool as Map<number, any>) pool.set(id, v)
    const slots = new Map<number, any>()
    const containers = new Map<string, any>()
    const stack: any[] = []
    //param 约定:0 存返回值,1..n 存实参
    const params: any[] = [null, ...args]
    const read = (a: IRArgs) => a.type == 'reg' ? a.data : slots.get(a.data)
    const write = (a: IRArgs, v: any) => {
        if (a.type == 'reg') slots.set(a.data, v)
        else slots.set(read(a), v)
    }
    const key = (a: IRArgs) => a.type == 'reg' ? a.data : slots.get(a.data)

    let block = body_block(tool)
    let index = 0
    let steps = 0
    const frames: [number, number, number][] = []
    while (steps++ < max_steps) {
        const list = flow.get(block)
        if (list == null) return {ret: params[0], steps, halt: 'bad-block-' + block}
        if (index >= list.length) {
            //块跑完:有帧就回,没有就结束
            const f = frames.pop()
            if (f == null) return {ret: params[0], steps, halt: 'end'}
            ;[block, index] = [f[0], f[1]]
            continue
        }
        const ir: any = list[index]
        index++
        if (ir instanceof PARAM_LOAD) {
            write(ir.data, params[read(ir.param)])
        } else if (ir instanceof PARAM_SET) {
            params[read(ir.param)] = read(ir.value)
        } else if (ir instanceof LOAD) {
            //load 的源是池 id 特例
            slots.set(ir.reg.data, pool.get(ir.data.data))
        } else if (ir instanceof MOV) {
            write(ir.left, read(ir.right))
        } else if (ir instanceof BINARY) {
            const fn = BIN[ir.id]
            if (fn == null) return {ret: params[0], steps, halt: 'bad-binary-' + ir.id}
            write(ir.result, fn(read(ir.left), read(ir.right)))
        } else if (ir instanceof NOT) {
            write(ir.left, truthy(read(ir.right)) ? 0 : 1)
        } else if (ir instanceof BIT_NOT) {
            write(ir.left, ~int32(read(ir.right)))
        } else if (ir instanceof CMP) {
            //CMP 的左操作数既是目标又是左值:要先读槽内容,不是立即数
            const fn = CMP_FN[read(ir.oper) as number]
            if (fn == null) return {ret: params[0], steps, halt: 'bad-cmp-' + read(ir.oper)}
            write(ir.left, fn(slots.get(ir.left.data), read(ir.right)))
        } else if (ir instanceof OFFSET_SET) {
            containers.set(`${key(ir.target)}|${key(ir.offset)}`, read(ir.value))
        } else if (ir instanceof OFFSET_GET) {
            write(ir.target, containers.get(`${key(ir.data)}|${key(ir.offset)}`))
        } else if (ir instanceof PUSH) {
            stack.push(slots.get(ir.target.data))
        } else if (ir instanceof POP) {
            //精简解释器里 pop 不还原(调用语义由作者维护)
            stack.pop()
        } else if (ir instanceof RET) {
            const frame = read(ir.frame)
            if (frame == 1) return {ret: params[0], steps, halt: 'ret'}
            //break:一直弹到循环帧
            let done = false
            while (frames.length > 0) {
                const f = frames.pop()
                if (f[2] == 2) {
                    ;[block, index] = [f[0], f[1]]
                    done = true
                    break
                }
            }
            if (!done) return {ret: params[0], steps, halt: 'break-out'}
            continue
        } else if (ir instanceof ControlStream) {
            const target = read(ir.target)
            const frame = read(ir.frame)
            const cond = 'cond' in ir ? read((ir as any).cond) : 1
            //JMP 是尾跳(continue/循环回跳用),不需要返回点
            if (ir.constructor.name == 'JMP') {
                block = target
                index = 0
            }
            //CALL 和条件跳转要记下返回点:那个块跑完时回到这里
            else if (ir.constructor.name == 'CALL' || truthy(cond)) {
                frames.push([block, index, typeof frame == 'number' ? frame : 0])
                block = target
                index = 0
            }
        }
    }
    return {ret: params[0], steps, halt: 'timeout'}
}
