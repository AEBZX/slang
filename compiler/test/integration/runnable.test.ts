//可运行性校验:优化后的字节码指令流必须能被 VM 真正执行
import {describe, expect, it} from 'vitest'
import {
    BINARY, BIT_NOT, CALL, CMP, CZ, DELETE, GC, IN, IRArgs, IRTree, JMP, JZ, LOAD, MOV, NOT,
    OFFSET_GET, OFFSET_SET, OUT, PARAM_LOAD, PARAM_SET, POP, PUSH, RET, THREAD, TZ, ControlStream
} from '../../src/utils'
import {bin_of, ir_of, opt_of} from '../unit/helper-ir'

const M = (body: string) => `public m:module{ ${body} }`
const F = (body: string, ret = 'number', arg = 'a:number') => M(`public static f:${ret}(${arg}){ ${body} }`)

const PROGRAMS: [string, string][] = [
    ['算术', F('var b:number=a+1*2-3/4%5; return b;')],
    ['比较', F('var h:boolean=a>0; var i:boolean=a==0; var j:boolean=a<=0; return a;')],
    ['位运算', F('var b:number=a<<1; var c:number=a&1; return a;')],
    ['一元', F('var h:boolean=!(a>0); var b:number=~a; return a;')],
    ['if/else', F('if(a>0)a=1;else a=2; return a;')],
    ['嵌套 if', F('if(a>0){if(a>1)a=2;else a=3;}else a=4; return a;')],
    ['while+break+continue', F('while(a>0){ if(a>5)break; if(a>3){a=a-1;continue;} a=a-1; } return a;')],
    ['三元', F('var b:number=a>0?1:2; return b;')],
    ['前后缀自增', F('++a; var b:number=a++; return b;')],
    ['数组', F('var d:number[]=[1,2,3]; d[0]=a; return d[1];')],
    ['字符串下标', M('public static f:string(a:string){ return a[0]; }')],
    ['调用', M('public static g:number(x:number){ return x; } public static f:number(a:number){ return g(a); }')],
    ['递归', M('public static g:number(n:number){ if(n<=1)return 1; return n*g(n-1); }')],
    ['vm 指令', F('var c:number=0; vm("add",c,a,1); return c;')],
    ['多模块', M('public static f:number(a:number){ return a; }') + `public n:module{ public static g:number(x:number){ return x; } }`],
    ['常量表达式', F('var b:number=1+2*3; return b;')]
]

//一条指令的 写槽/读槽/常量 分类
type Access = {write: number[], read: number[], const: IRArgs[]}
function access(ir: IRTree): Access {
    const w: number[] = [], r: number[] = [], c: IRArgs[] = []
    const write = (a: IRArgs) => a == null ? null : (a.type == 'reg' ? w.push(a.data) : r.push(a.data))
    const read = (a: IRArgs) => a == null ? null : (a.type == 'value' ? r.push(a.data) : c.push(a))
    const konst = (a: IRArgs) => a == null ? null : c.push(a)
    if (ir instanceof MOV) {
        write(ir.left)
        read(ir.right)
    } else if (ir instanceof LOAD) {
        write(ir.reg)
        konst(ir.data)          // 源是池 id
    } else if (ir instanceof BINARY) {
        write(ir.result)
        read(ir.left)
        read(ir.right)
    } else if (ir instanceof NOT || ir instanceof BIT_NOT) {
        write(ir.left)
        read(ir.right)
    } else if (ir instanceof CMP) {
        read(ir.left)
        w.push(ir.left.data)
        read(ir.right)
        konst(ir.oper)
    } else if (ir instanceof ControlStream) {
        konst(ir.target)
        konst(ir.frame)
        if ('cond' in ir) read((ir as any).cond)
    } else if (ir instanceof RET) {
        konst(ir.frame)
    } else if (ir instanceof PUSH) {
        r.push(ir.target.data)
    } else if (ir instanceof POP) {
        w.push(0)
    } else if (ir instanceof OFFSET_GET) {
        write(ir.target)
        read(ir.data)
        read(ir.offset)
    } else if (ir instanceof OFFSET_SET) {
        read(ir.target)
        read(ir.offset)
        read(ir.value)
    } else if (ir instanceof IN) {
        read(ir.oper)
        w.push(ir.target.data)
    } else if (ir instanceof OUT) {
        read(ir.oper)
        read(ir.target)
    } else if (ir instanceof DELETE) {
        r.push(ir.data.data)
    } else if (ir instanceof PARAM_SET) {
        konst(ir.param)
        read(ir.value)
    } else if (ir instanceof PARAM_LOAD) {
        write(ir.data)
        konst(ir.param)
    } else if (ir instanceof GC) {
        // 无操作数
    }
    return {write: w, read: r, const: c}
}

//返回这个问题清单,空数组表示看着能跑
function validate(src: string): {struct: string[], defuse: string[]} {
    return validate_tool(opt_of(src))
}
//同一套校验也能用在未优化的 IR 上:生成阶段就该满足这些约束
function validate_tool(tool: any): {struct: string[], defuse: string[]} {
    const bad: string[] = []
    const defuse: string[] = []
    //IRTool 用 .ir 且池是 值->id;OPTTool 用 .command 且池是 id->值
    const flow: Map<number, IRTree[]> = tool.command ?? tool.ir
    const ids = new Set(flow.keys())
    const pool_ids = tool.cprop_table == null
        ? new Set([...(tool.pool as Map<any, number>).values()])
        : new Set((tool.pool as Map<number, any>).keys())
    const pushes = [...flow.values()].flat().filter(i => i instanceof PUSH).length
    const pops = [...flow.values()].flat().filter(i => i instanceof POP).length
    if (pushes != pops) bad.push(`push(${pushes})/pop(${pops}) 不平衡`)
    //静态跳转目标必须存在;池 id 必须存在
    for (const [bid, list] of flow) {
        list.forEach((ir, index) => {
            const at = `b${bid}[${index}] ${ir.constructor.name}`
            if (ir instanceof ControlStream && ir.target.type == 'reg' && !ids.has(ir.target.data))
                bad.push(at + ` 跳到不存在的块 ${ir.target.data}`)
            if (ir instanceof LOAD && !pool_ids.has(ir.data.data))
                bad.push(at + ` 引用了不存在的池 id ${ir.data.data}`)
            for (const key of Object.keys(ir))
                if (ir[key] instanceof IRArgs && !(Number.isInteger(ir[key].data) && ir[key].data >= 0))
                    bad.push(at + ` 操作数 ${key} 不是非负整数: ${ir[key].data}`)
        })
    }
    //隐式创建的容器:OFFSET_SET 第一次写入时 VM 才按槽号建容器,
    //所以这个槽从来没被写过是合法的 —— 读它得到 null('\0'),不是垃圾
    const containers = new Set<number>()
    for (const list of flow.values())
        for (const ir of list)
            if (ir instanceof OFFSET_SET && ir.target.type == 'reg') containers.add(ir.target.data)
    //整条流里读过的槽必须至少被写过一次(块之间没有 CFG 前驱关系,这里只做全程序的弱检查)
    const written = new Set<number>()
    for (const list of flow.values())
        for (const ir of list)
            for (const slot of access(ir).write) written.add(slot)
    for (const [bid, list] of flow)
        list.forEach((ir, index) => {
            for (const slot of access(ir).read)
                if (!written.has(slot) && !containers.has(slot))
                    defuse.push(`b${bid}[${index}] ${ir.constructor.name} 读了从未写过的槽 ${slot}`)
        })
    return {struct: bad, defuse}
}

const results: {name: string, bad: string[], defuse: string[]}[] = []

describe('compiler/输出可运行性', () => {
    for (const [name, src] of PROGRAMS)
        it(name + ' 的字节码能跑', () => {
            const r = validate(src)
            results.push({name, bad: r.struct, defuse: r.defuse})
            expect(r.struct, name + ' 结构性错误:\n  ' + r.struct.join('\n  ')).toEqual([])
        })

    it('汇总', () => {
        const lines = results.map(r => `${r.bad.length ? 'BAD ' : 'OK  '} ${r.name}` +
            (r.bad.length ? ` 结构 ${r.bad.length} 处` : '') +
            (r.defuse.length ? ` 疑似未初始化读取 ${r.defuse.length} 处` : ''))
        console.log('RUNNABLE\n' + lines.join('\n'))
        const detail = results.flatMap(r => r.defuse.map(d => r.name + ' ' + d))
        if (detail.length) console.log('DEFUSE\n' + detail.join('\n'))
        expect(results.filter(r => r.bad.length).length).toBe(0)
    })

    it('能落到磁盘并且每块都有编号', () => {
        const src = F('var b:number=a+1; return b;')
        expect(bin_of(src).length).toBeGreaterThan(0)
        expect(opt_of(src).command.size).toBeGreaterThan(0)
    })
})

//生成阶段的 IR(没经过优化)也要满足同样约束
describe('可运行性·未优化的 IR 也合法', () => {
    for (const [name, src] of PROGRAMS)
        it(name, () => {
            const {struct, defuse} = validate_tool(ir_of(src))
            expect(struct, name + ' 结构问题').toEqual([])
            expect(defuse, name + ' 定值使用问题').toEqual([])
        })
})
