import { describe, expect, it } from 'vitest'
import { lexer } from '../../utils/lexer'
import cst_parse from '../../parser/cst'
import ast_parse from '../../parser/ast'
import { ast_data, File } from '../../utils'
import check from '../../check'
import desugar from '../../desugar'
import hir from '../../hir'
import ir from '../../ir'

function ir_of(src: string): { count: number; code: Map<number, any[]>; h: any[] } {
    const files = [ast_parse(cst_parse(lexer(src)) as ast_data) as File]
    check(files)
    const [count, h] = hir(<File[]>desugar(files))
    return { count, code: ir(count, h).code, h }
}

function body_blocks(src: string): any[] {
    // 返回所有非根块(block 0 是根),值为指令数组
    const r = ir_of(src)
    return [...r.code.entries()].filter(([k]) => k !== 0)
}

describe('IR 字节码生成', () => {
    it('算术表达式生成 load/add/retn', () => {
        const blocks = body_blocks('public m:number(){return 1+2;}\n')
        // 只有一个函数块
        expect(blocks.length).toBe(1)
        const cmds = blocks[0][1]
        expect(cmds.some((c: any) => c[0] == 'load')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'add')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'param_set')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'retn')).toBe(true)
    })

    it('函数定义生成独立块并加载参数', () => {
        const blocks = body_blocks('public add:number(a:number,b:number){return a+b;}\n')
        expect(blocks.length).toBe(1)
        const cmds = blocks[0][1]
        expect(cmds.some((c: any) => c[0] == 'param_load')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'add')).toBe(true)
    })

    it('变量声明与读取生成 mov', () => {
        const blocks = body_blocks('public m:number(){var x:number=5;return x;}\n')
        expect(blocks.length).toBe(1)
        const cmds = blocks[0][1]
        expect(cmds.some((c: any) => c[0] == 'mov')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'load')).toBe(true)
    })

    it('生成结果含常量池和根块', () => {
        const r = ir_of('public m:number(){return 1+2;}\n')
        expect(r.code.has(0)).toBe(true)
        expect(r.count).toBeGreaterThan(0)
    })

    it('字符串字面量生成 load/ret', () => {
        const blocks = body_blocks('public m:string(){return "hi";}\n')
        const cmds = blocks[0][1]
        expect(cmds.some((c: any) => c[0] == 'load')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'param_set')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'retn')).toBe(true)
    })

    it('比较运算符生成 cmp', () => {
        const blocks = body_blocks('public m:boolean(a:number,b:number){return a>b;}\n')
        const cmds = blocks[0][1]
        expect(cmds.some((c: any) => c[0] == 'cmp')).toBe(true)
    })

    it('取反生成 not', () => {
        const blocks = body_blocks('public m:boolean(a:boolean){return !a;}\n')
        const cmds = blocks[0][1]
        expect(cmds.some((c: any) => c[0] == 'not')).toBe(true)
    })

    it('static main 标记入口且 lambda 块为 id 0', () => {
        const r = ir_of('public static main:void(){var x:number=1;}\n')
        // HIR 的 HVariable entry=true
        expect(r.h.some((e: any) => e.entry)).toBe(true)
        // main 的 lambda 块独占 id 0(含 main 的 body 指令)
        expect(r.code.has(0)).toBe(true)
        const cmds = r.code.get(0)!
        expect(cmds.length).toBeGreaterThan(0)
    })

    it('非 static main 不标记入口', () => {
        const r = ir_of('public main:void(){}\n')
        expect(r.h.some((e: any) => e.entry)).toBe(false)
    })

    it('map 字面量 [k:v] 生成 offset_set', () => {
        const blocks = body_blocks('public foo:void(){var m:number{}= [a:1];}\n')
        const cmds = blocks[0][1]
        expect(cmds.some((c: any) => c[0] == 'offset_set')).toBe(true)
    })

    it('类生成构造块,含成员初始化与返回 this', () => {
        const blocks = body_blocks('public A:class{public f:number(){return 1;}}\n')
        // 类块 + 成员方法块
        expect(blocks.length).toBe(2)
        // 构造块含 offset_set(成员初始化)和 ret
        const clsCmds = blocks.find(([, v]) => (v as any[]).some((c: any) => c[0] == 'offset_set'))?.[1]
        expect((clsCmds as any[])?.some((c: any) => c[0] == 'offset_set')).toBe(true)
        expect((clsCmds as any[])?.some((c: any) => c[0] == 'retn')).toBe(true)
    })

    it('变量赋值走取地址+解引用写,不生成 offset_addr', () => {
        const blocks = body_blocks('public m:void(){var a:number=1;a=2;}\n')
        const cmds = blocks[0][1]
        // &a 用 reg 取地址(id 数字),mov value 解引用写
        expect(cmds.some((c: any) => c[0] == 'mov' && c[1][0] == 'value')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'offset_addr')).toBe(false)
    })

    it('索引左值赋值生成 offset_addr', () => {
        const blocks = body_blocks('public m:void(){var a:number[]=[1,2];a[0]=5;}\n')
        const cmds = blocks[0][1]
        expect(cmds.some((c: any) => c[0] == 'offset_addr')).toBe(true)
        // 左值赋值不产生读值 offset_get
        expect(cmds.some((c: any) => c[0] == 'offset_get')).toBe(false)
    })

    it('索引右值读取仍生成 offset_get', () => {
        const blocks = body_blocks('public m:void(){var a:number[]=[1];var x:number=a[0];}\n')
        const cmds = blocks[0][1]
        expect(cmds.some((c: any) => c[0] == 'offset_get')).toBe(true)
        expect(cmds.some((c: any) => c[0] == 'offset_addr')).toBe(false)
    })

    it('成员左值赋值生成 offset_addr', () => {
        const blocks = body_blocks('public A:class{public f:var:number;}\npublic m:void(x:A){x.f=1;}\n')
        const cmds = blocks.flatMap(([, v]) => v as any[])
        expect(cmds.some((c: any) => c[0] == 'offset_addr')).toBe(true)
    })

    it('函数变量槽在根块初始化为块id常量', () => {
        const r = ir_of('public add:number(a:number,b:number){return a+b;}\n')
        const root = r.code.get(0)!
        //根块含load:函数变量槽=函数块id,供call/引用解引用(此前顶层初始化指令丢失,根块为空)
        expect(root.some((c: any) => c[0] == 'load')).toBe(true)
        //不再生成读未初始化槽的 mov reg{slot}=value{block_id}
        expect(root.some((c: any) => c[0] == 'mov' && c[1][0] == 'reg' && c[2][0] == 'value')).toBe(false)
    })

    it('函数引用读取函数变量槽后call间接跳转', () => {
        const blocks = body_blocks('public add:number(a:number,b:number){return a+b;}\npublic m:number(){return add(1,2);}\n')
        //m函数体含call,且前有mov(读函数变量槽)
        const m = blocks.find(([, v]) => (v as any[]).some((c: any) => c[0] == 'call'))?.[1]
        expect((m as any[])?.some((c: any) => c[0] == 'call')).toBe(true)
        expect((m as any[])?.some((c: any) => c[0] == 'mov' && c[2][0] == 'value')).toBe(true)
    })

    it('多函数+static main入口:根块不被覆盖,保留其他函数槽初始化', () => {
        const r = ir_of('public add:number(a:number,b:number){return a+b;}\npublic static main:number(){return add(1,2);}\n')
        const root = r.code.get(0)!
        //main entry块id为0,其lambda处理不得重置根块,否则add的函数槽初始化load丢失
        expect(root.some((c: any) => c[0] == 'load')).toBe(true)
        //add函数体(含param_load)仍在
        expect([...r.code.values()].some((cmds: any[]) => cmds.some((c: any) => c[0] == 'param_load'))).toBe(true)
    })

    it('while 生成循环体末尾跳回条件块(多次循环)', () => {
        const blocks = body_blocks('public static main:number(){var i:number=0;while(i<3){i=i+1;}return i;}\n')
        const cmds = blocks.flatMap(([, v]) => v as any[])
        //循环体块末尾有jmp回条件块(原缺陷缺失,循环体仅执行一次即退出)
        expect(cmds.some((c: any) => c[0] == 'jmp')).toBe(true)
        //while的块调用是cz(压块帧,区别于call函数帧);条件块+if分支各一次
        expect(cmds.filter((c: any) => c[0] == 'cz').length).toBeGreaterThanOrEqual(2)
    })
})
