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
//函数块(以 RET frame=1 结束)的块号,按块号升序(块号跟着源码顺序)
export function function_blocks(tool: any): number[] {
    const flow: Map<number, any[]> = tool.command ?? tool.ir
    return [...flow.entries()]
        .filter(([, list]) => list.some((i: any) => i.constructor.name == 'RET' && i.frame != null && i.frame.data == 1))
        .map(([bid]) => bid)
        .sort((a, b) => a - b)
}
//登记块:不含 PARAM_LOAD、没有 RET(1),就是模块/文件容器的初始化
function reg_blocks(flow: Map<number, any[]>, entry: number): number[] {
    return [...flow.entries()]
        .filter(([bid, list]) => bid != entry && list.length > 0
            && !list.some((i: any) => i.constructor.name == 'PARAM_LOAD')
            && !list.some((i: any) => i.constructor.name == 'RET' && i.frame != null && i.frame.data == 1))
        .map(([bid]) => bid)
        .sort((a, b) => a - b)
}
export function body_block(tool: any, which = -1): number {
    const flow: Map<number, any[]> = tool.command ?? tool.ir
    const entries = [...flow.entries()]
    const fn = function_blocks(tool)
    if (fn.length > 0) return fn[which < 0 ? fn.length - 1 : which]
    return entries.reduce((a, b) => b[1].length > a[1].length ? b : a)[0]
}

export function exec(tool: any, args: number[] = [], max_steps = 100000, opts: {entry?: number, which?: number, prelude?: boolean} = {}): exec_result {
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

    const entry = opts.entry ?? body_block(tool, opts.which ?? -1)
    //先把模块/文件登记块(straight-line)跑一遍,再进目标函数
    const prelude: any[] = []
    if (opts.prelude)
        for (const bid of reg_blocks(flow, entry)) prelude.push(...flow.get(bid))
    let block = entry
    let index = 0
    let steps = 0
    const frames: [number, number, number][] = []
    while (steps++ < max_steps) {
        const list = block == entry && prelude.length > 0 ? [...prelude, ...flow.get(entry)] : flow.get(block)
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
            //POP 没有操作数,靠这个栈记住"弹回来写哪个槽"
            stack.push([ir.target.data, slots.get(ir.target.data)])
        } else if (ir instanceof POP) {
            const saved = stack.pop()
            if (saved != null) slots.set(saved[0], saved[1])
        } else if (ir instanceof RET) {
            const frame = read(ir.frame)
            if (frame == 1) {
                //有调用点就返回调用之后,否则是顶层结束
                let at = -1
                for (let i = frames.length - 1; i >= 0; i--)
                    if (frames[i][2] == 1) { at = i; break }
                if (at < 0) return {ret: params[0], steps, halt: 'ret'}
                const f = frames[at]
                frames.length = at
                block = f[0]
                index = f[1]
                continue
            }
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
                    console.error('CALL target=' + JSON.stringify(target) + ' key22=' + JSON.stringify(slots.get(22)) + ' pool23=' + JSON.stringify(pool.get(23)) + ' cont=' + JSON.stringify([...containers.entries()]))
                frames.push([block, index, typeof frame == 'number' ? frame : 0])
                block = target
                index = 0
            }
        }
    }
    return {ret: params[0], steps, halt: 'timeout'}
}
