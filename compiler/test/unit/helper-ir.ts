//IR / 优化 / 生成三层的测试辅助
import ir from '../../src/ir'
import optimize from '../../src/optimize'
import generate from '../../src/generate'
import {OPTTool} from '../../src/optimize/tool'
import {IRArgs, IRTree} from '../../src/utils'
import {join} from 'path'
import {tmpdir} from 'os'
import {pipeline} from './helper'

//完整前端 + IR
export function ir_of(src: string): any {
    const {hscope, nodes} = pipeline(src)
    return ir.run([hscope, nodes])
}

//IR + 优化
export function opt_of(src: string): OPTTool {
    return optimize.run(ir_of(src)) as OPTTool
}

//到底:字节码(写到临时目录,别污染仓库)
export function bin_of(src: string, local = join(tmpdir(), 'slang-test.sbin')): Buffer {
    const tool = opt_of(src)
    ;(generate as any).local = local
    return generate.run(tool) as Buffer
}

//手搭一个优化器:block 0 装满给的指令
export function new_opt(...comm: IRTree[]): OPTTool {
    return new OPTTool(1, new Map<number, IRTree[]>([[0, comm]]), new Map())
}

//取指令的全部 IRArgs 操作数(按字段声明顺序)
export function args_of(ir: IRTree): IRArgs[] {
    return Object.keys(ir).map(k => (ir as any)[k]).filter(v => v instanceof IRArgs)
}

const form = (a: IRArgs) => a == null ? 'null' : (a.type == 'reg' ? 'r' : 'v') + a.data

//把一条指令写成 'BINARY add result=r3 left=v4 right=v5'
export function dump_ir(ir: IRTree): string {
    const name = ir.constructor.name
    const id = (ir as any).id
    const fields = Object.keys(ir)
        .filter(k => (ir as any)[k] instanceof IRArgs)
        .map(k => `${k}=${form((ir as any)[k])}`)
    return [name, id == null ? '' : String(id), ...fields].filter(Boolean).join(' ')
}

//整条指令流:块号 -> 指令摘要
export function dump_flow(tool: any): Map<number, string[]> {
    const out = new Map<number, string[]>()
    for (const [bid, list] of tool.command ?? tool.ir)
        out.set(bid, list.map(dump_ir))
    return out
}

//只保留指令名,便于看结构
export function names_of(list: IRTree[]): string[] {
    return list.map(i => i.constructor.name)
}

//所有指令条数
export function count_of(tool: any): number {
    return [...(tool.command ?? tool.ir).values()].reduce((a: number, b: IRTree[]) => a + b.length, 0)
}

//找第一条某类指令
export function find_of<T>(tool: any, cls: any): T {
    for (const list of (tool.command ?? tool.ir).values())
        for (const ir of list)
            if (ir instanceof cls) return ir as T
    return null
}

//找全部某类指令
export function all_of(tool: any, cls: any): any[] {
    const out: any[] = []
    for (const list of (tool.command ?? tool.ir).values())
        for (const ir of list)
            if (ir instanceof cls) out.push(ir)
    return out
}

//操作数里有空值的指令(非法指令流)
export function null_args(tool: any): string[] {
    const out: string[] = []
    for (const [bid, list] of (tool.command ?? tool.ir))
        list.forEach((ir: IRTree, index: number) => {
            const bad = Object.keys(ir).filter(k => (ir as any)[k] == null)
            if (bad.length) out.push(`b${bid}[${index}] ${ir.constructor.name}: ${bad.join(',')}`)
        })
    return out
}
