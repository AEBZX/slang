import { describe, expect, it } from 'vitest'
import { lexer } from '../../utils/lexer'
import cst_parse from '../../parser/cst'
import ast_parse from '../../parser/ast'
import {
    asm_args, ast_data, BINARY, BIT_NOT, CALL, CMP, CZ, File, GC, IN, IR, IRTool, JMP,
    JZ, LOAD, MOV, NOT, OFFSET_ADDR, OFFSET_GET, OFFSET_SET, OUT, PARAM_LOAD, PARAM_SET,
    POP, PUSH, RET, RETN, STR_GET, THREAD, TZ, to
} from '../../utils'
import check from '../../check'
import desugar from '../../desugar'
import hir from '../../hir'
import ir from '../../ir'
import { build, kill } from '../../optimize/cfg'
import CP from '../../optimize/cp'
import CONSTANT from '../../optimize/constant'
import PEEPHOLE from '../../optimize/peephole'
import { DCE, slots as d_slots, build as d_build, global_use } from '../../optimize/dce'

//模拟执行优化后的IR指令,验证o0/o1/o2语义等价。
//修复回归:cp2解引用写非法传播、P_CMP分支反、DCE自反use漏判、S_CMP漏记读、
//I_LambdaExpr覆盖根块、while循环体仅执行一次、if/while块内return(RE TN弹到函数帧)、
//函数调用栈帧(call前压入全部局部槽/返回后恢复,递归不再覆盖caller的槽)。
const BINOPS: Record<string, (a: any, b: any) => any> = {
    add: (a, b) => a + b, sub: (a, b) => a - b, mul: (a, b) => a * b, div: (a, b) => a / b,
    mod: (a, b) => a % b, shr: (a, b) => a >> b,shl: (a, b)=>(a<<b),
    and: (a, b) => a & b, or: (a, b) => a | b, xor: (a, b) => a ^ b
}
const CMPS: Record<number, (a: any, b: any) => number> = {
    0: (a, b) => (a == b ? 1 : 0), 1: (a, b) => (a != b ? 1 : 0),
    2: (a, b) => (a > b ? 1 : 0), 3: (a, b) => (a < b ? 1 : 0),
    4: (a, b) => (a >= b ? 1 : 0), 5: (a, b) => (a <= b ? 1 : 0)
}
class Sim {
    slots = new Map<number, any>()
    //对象模型与 VM 对齐:offset[对象槽][键]=值(独立映射,对象槽=操作数原样,不依赖槽内容)
    offsets = new Map<number, Map<any, any>>()
    addr = new Map<number, { obj: any, key: any }>()
    param: any[] = []
    stack: any[] = []
    //func=true:函数/线程调用帧;loop=true:while 循环帧;块帧(if)两者皆非
    //retn弹到函数帧,ret(break)弹到最近循环帧
    calls: { b: number, i: number, func: boolean, loop?: boolean }[] = []
    private addr_id = -1
    private steps = 0
    constructor(private blocks: Map<number, IR[]>, private consts: Map<number, any>, entryParam: any[] = []) {
        this.param = [...entryParam]
    }
    resolve(a: asm_args) { return a[0] == 'reg' ? a[1] : this.slots.get(a[1]) }
    target(a: asm_args) { return a[0] == 'reg' ? a[1] : this.slots.get(a[1]) }
    run(): any {
        let b = 0, i = 0
        for (; ;) {
            if (++this.steps > 2000000) throw new Error('infinite loop')
            const block = this.blocks.get(b)
            if (!block || i >= block.length) {
                if (this.calls.length == 0) return this.param[0]
                const f = this.calls.pop()!
                b = f.b; i = f.i
                continue
            }
            const ins = block[i++]
            if (ins instanceof MOV) {
                const src = this.resolve(ins.right)
                if (ins.left[0] == 'reg') this.slots.set(ins.left[1], src)
                else {
                    const h = this.resolve(ins.left)
                    const t = this.addr.get(h)
                    if (t) t.obj[t.key] = src
                    else this.slots.set(h, src)
                }
            } else if (ins instanceof LOAD) {
                this.slots.set(ins.reg[1], this.consts.get(ins.data[1]))
            } else if (ins instanceof BINARY) {
                this.slots.set(ins.result[1], BINOPS[ins.id](this.resolve(ins.left), this.resolve(ins.right)))
            } else if (ins instanceof NOT) {
                this.slots.set(ins.data[1], this.slots.get(ins.data[1]) ? 0 : 1)
            } else if (ins instanceof BIT_NOT) {
                this.slots.set(ins.data[1], ~this.slots.get(ins.data[1]))
            } else if (ins instanceof CMP) {
                this.slots.set(ins.left[1], CMPS[ins.oper[1]](this.slots.get(ins.left[1]), this.resolve(ins.right)))
            } else if (ins instanceof JZ) {
                if (this.resolve(ins.cond)) { b = this.target(ins.target); i = 0 }
            } else if (ins instanceof JMP) {
                b = this.target(ins.target); i = 0
            } else if (ins instanceof CZ) {
                //块调用:压块帧(return(RE TN)会穿过它,break的ret弹到循环帧即到此)
                //帧类型:0=块(if),2=循环(while,编译器 while 的 cz 发 c=2);ret(break)弹到最近循环帧
                if (this.resolve(ins.cond)) {
                    this.calls.push({ b, i, func: ins.is_func_call[1] == 1, loop: ins.is_func_call[1] == 2 })
                    b = this.target(ins.target); i = 0
                }
            } else if (ins instanceof TZ) {
                //线程调用:压函数帧
                if (this.resolve(ins.cond)) {
                    this.calls.push({ b, i, func: true })
                    b = this.target(ins.target); i = 0
                }
            } else if (ins instanceof CALL || ins instanceof THREAD) {
                //函数/线程调用:压函数帧,return(RE TN)弹到这里即回到调用点
                this.calls.push({ b, i, func: true })
                b = this.target(ins.target); i = 0
            } else if (ins instanceof RET) {
                //break:弹帧到最近循环帧(含)退出循环;无循环帧(switch 内 break)弹一帧
                let f: { b: number, i: number } | null = null
                while (this.calls.length) {
                    const x = this.calls.pop()!
                    if (x.loop || x.func) { f = x; break }
                }
                if (f) { b = f.b; i = f.i }
                else return this.param[0]
            } else if (ins instanceof RETN) {
                //函数返回:弹出所有块帧直到函数帧;无函数帧(栈空,如main)则整体返回
                let f: { b: number, i: number } | null = null
                while (this.calls.length) {
                    const x = this.calls.pop()!
                    if (x.func) { f = x; break }
                }
                if (f) { b = f.b; i = f.i }
                else return this.param[0]
            } else if (ins instanceof PUSH) {
                this.stack.push(this.resolve(ins.target))
            } else if (ins instanceof POP) {
                this.slots.set(ins.target[1], this.stack.pop())
            } else if (ins instanceof OFFSET_SET) {
                //对象槽号=resolve(target)(reg原样/value经var读句柄),独立 offset 映射
                let om = this.offsets.get(this.resolve(ins.target))
                if (!om) { om = new Map(); this.offsets.set(this.resolve(ins.target), om) }
                om.set(this.resolve(ins.offset), this.resolve(ins.value))
            } else if (ins instanceof STR_GET) {
                //字符串索引:对象槽存字符串值,索引为数字 → 单字符;越界/非字符串返回 null("\0")
                //必须在 OFFSET_GET 之前:STR_GET 继承自 OFFSET_GET,后者会走 offset 映射
                const s = this.resolve(ins.data)
                const i = this.resolve(ins.offset)
                this.slots.set(this.resolve(ins.target),
                    typeof s == 'string' && typeof i == 'number' && i >= 0 && i < s.length ? s[i] : '\0')
            } else if (ins instanceof OFFSET_GET) {
                const om = this.offsets.get(this.resolve(ins.data))
                this.slots.set(this.resolve(ins.target), om ? om.get(this.resolve(ins.offset)) : undefined)
            } else if (ins instanceof OFFSET_ADDR) {
                const om = this.offsets.get(this.resolve(ins.data))
                const h = this.addr_id--
                this.addr.set(h, { obj: om || new Map(), key: this.resolve(ins.offset) })
                this.slots.set(this.resolve(ins.target), h)
            } else if (ins instanceof PARAM_SET) {
                this.param[ins.param[1]] = this.resolve(ins.value)
            } else if (ins instanceof PARAM_LOAD) {
                this.slots.set(ins.data[1], this.param[ins.param[1]])
            } else if (ins instanceof OUT) {
                //忽略输出(不参与等价断言)
            } else if (ins instanceof IN) {
                this.slots.set(ins.oper[1], 0)
            } else if (ins instanceof GC) {
                //ignore
            }
        }
    }
}

//复刻 optimize/index.ts 内部逻辑,返回优化后的 IR 指令(与 optimize 源码保持同步)
function opt_tool(data: { pool: Map<number | string, number>, code: Map<number, any[]>, id: number }, level: number): IRTool {
    const pool = new Map<number, number | string>()
    for (const [k, v] of data.pool) pool.set(v, k)
    const code = to(data.code)
    const tool = new IRTool(data.id, code, pool)
    const each = (c: Map<any, any>, bid: number, data: IR[]) => {
        for (let i = 0; i < data.length; i++) {
            const rule = c.get(data[i].constructor)
            if (rule) rule(data[i], tool, bid, i)
        }
    }
    if (level >= 1) {
        for (const [bid, data] of tool.command) {
            each(CONSTANT, bid, data)
            //跳过已被 CONSTANT 折叠的指令:state 被折叠结果污染,PEEPHOLE 会误判(如 sub l==r)
            for (let i = 0; i < data.length; i++) {
                const rule = PEEPHOLE.get(data[i].constructor)
                if (rule && !tool.replaced(bid, i)) rule(data[i], tool, bid, i)
            }
            tool.sweep()
            d_build(data, d_slots, tool)
            each(CP, bid, data)
            tool.sweep()
            d_build(data, d_slots, tool)
            tool.guse = global_use(tool)
            each(DCE, bid, data)
            tool.sweep()
        }
    }
    if (level >= 2) {
        build(tool.command, tool)
        kill(tool)
    }
    return tool
}
function compile(src: string) {
    const files = [ast_parse(cst_parse(lexer(src)) as ast_data) as File]
    check(files)
    const [count, h] = hir(<File[]>desugar(files))
    return ir(count, h)
}
//在三个级别下模拟执行,返回[结果]
function run_levels(src: string, entryParam: any[] = []): any[] {
    const data = compile(src)
    return [0, 1, 2].map(level => {
        const tool = opt_tool(data, level)
        //tool.pool 是优化后 id→值(含常量折叠新增常量);原始 data.pool 查不到折叠新常量
        return new Sim(tool.command, tool.pool, entryParam).run()
    })
}
const norm = (x: any) => JSON.stringify(x ?? null)

describe('o0/o1/o2 语义等价(模拟执行)', () => {
    const cases: [string, string, any][] = [
        ['算术', 'public static main:number(){return 1+2*3-4;}\n', 3],
        ['变量+if(常量条件折叠后控制流接续)', 'public static main:number(){var a:number=5;var b:number=2;if(a>b){return a-b;}else{return b-a;}}\n', 3],
        ['函数调用链(CP不误删参数读取)', 'public add:number(a:number,b:number){return a+b;}\npublic static main:number(){return add(2,3);}\n', 5],
        ['数组', 'public static main:number(){var a:number[]=[1,2,3];return a[1];}\n', 2],
        ['字符串', 'public static main:string(){return "hi";}\n', 'hi'],
        ['while循环(循环体跳回条件块)', 'public static main:number(){var i:number=0;while(i<3){i=i+1;}return i;}\n', 3],
    ]
    for (const [name, src, want] of cases) {
        it(`${name}: o0/o1/o2 一致且结果正确`, () => {
            const rs = run_levels(src)
            expect(norm(rs[0])).toBe(norm(rs[1]))
            expect(norm(rs[1])).toBe(norm(rs[2]))
            expect(norm(rs[0])).toBe(norm(want))
        })
    }
    it('带参数 main 的分支', () => {
        const src = 'public static main:number(x:number){if(x>0){return x;}else{return 0-x;}}\n'
        const a = run_levels(src, [0, 5])
        const b = run_levels(src, [0, -3])
        expect(norm(a[0])).toBe('5')
        expect(norm(b[0])).toBe('3')
    })
    it('递归调用:栈帧保存/恢复局部槽,fact(5)=120', () => {
        //函数调用点压入当前函数全部局部槽、返回后弹出恢复(槽0返回值除外),
        //callee不再覆盖caller的槽,递归结果正确(此前fact(5)返回256而非120)
        const src = 'public fact:number(n:number){if(n<=1){return 1;}return n*fact(n-1);}\npublic static main:number(){return fact(5);}\n'
        const rs = run_levels(src)
        expect(norm(rs[0])).toBe(norm(rs[1]))
        expect(norm(rs[1])).toBe(norm(rs[2]))
        expect(norm(rs[0])).toBe('120')
    })
    it('递归+局部变量:callee覆盖的变量槽被恢复', () => {
        //x在递归调用前写入,递归返回后仍要用;帧不保护则被callee覆盖导致结果错
        const src = 'public f:number(n:number){var x:number=n+1;if(n<=1){return 1;}return n*f(n-1)+x;}\npublic static main:number(){return f(3);}\n'
        const rs = run_levels(src)
        expect(norm(rs[0])).toBe(norm(rs[1]))
        expect(norm(rs[1])).toBe(norm(rs[2]))
        expect(norm(rs[0])).toBe('19')
    })
    it('斐波那契:两处递归调用互不干扰', () => {
        const src = 'public fib:number(n:number){if(n<=1){return n;}return fib(n-1)+fib(n-2);}\npublic static main:number(){return fib(10);}\n'
        const rs = run_levels(src)
        expect(norm(rs[0])).toBe(norm(rs[1]))
        expect(norm(rs[1])).toBe(norm(rs[2]))
        expect(norm(rs[0])).toBe('55')
    })
    it('if分支提前return不落入后续代码', () => {
        const src = 'public static main:number(x:number){if(x>0){return 1;}return 2;}\n'
        const a = run_levels(src, [0, 5])
        const b = run_levels(src, [0, -3])
        expect(norm(a[0])).toBe('1')
        expect(norm(b[0])).toBe('2')
    })
    it('while循环内return提前退出函数', () => {
        const src = 'public static main:number(){var i:number=0;while(true){i=i+1;if(i>=3){return i;}}}\n'
        const rs = run_levels(src)
        expect(norm(rs[0])).toBe(norm(rs[1]))
        expect(norm(rs[1])).toBe(norm(rs[2]))
        expect(norm(rs[0])).toBe('3')
    })
    it('字符串索引 s[i]:o0/o1/o2 一致且取到字符', () => {
        //str_get 独立操作码;越界返回 null 与 VM 对齐
        const src = 'public static main:string(){var s:string="hello";return s[1];}\n'
        const rs = run_levels(src)
        expect(norm(rs[0])).toBe(norm(rs[1]))
        expect(norm(rs[1])).toBe(norm(rs[2]))
        expect(norm(rs[0])).toBe('"e"')
    })
    it('foreach 遍历字符串:o0/o1/o2 一致且字符计数正确', () => {
        //回归:desugar 曾对 StringType 做 fix.pop 崩溃;字符串索引经 str_get
        const src = 'public static main:number(){var s:string="hello";var n:number=0;foreach(ch:s){n=n+1;}return n;}\n'
        const rs = run_levels(src)
        expect(norm(rs[0])).toBe(norm(rs[1]))
        expect(norm(rs[1])).toBe(norm(rs[2]))
        expect(norm(rs[0])).toBe('5')
    })
})
