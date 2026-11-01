//集成:整条后端 -> 字节码
import {describe, expect, it} from 'vitest'
import {BINARY, IRTree} from '../../src/utils'
import {all_of, bin_of, count_of, opt_of} from '../unit/helper-ir'

const M = (body: string) => `public m:module{ ${body} }`

//规格:每条指令 16 字节(opcode + 3 个 u32 操作数)
const CODE_SIZE = 16
//把代码段切回 [块号, 指令字节...] 的形式
function read_code(buf: Buffer) {
    const start = buf.indexOf('CODE_START') + 'CODE_START'.length
    const blocks: { id: number, words: number[][] }[] = []
    let offset = start
    while (offset + CODE_SIZE <= buf.length && buf.readUInt32BE(offset) == 0xFFFFFFFF) {
        const id = buf.readUInt32BE(offset + 4)
        offset += CODE_SIZE
        const words: number[][] = []
        while (offset + CODE_SIZE <= buf.length && buf.readUInt32BE(offset) != 0xFFFFFFFE) {
            words.push([0, 4, 8, 12].map(o => buf.readUInt32BE(offset + o)))
            offset += CODE_SIZE
        }
        expect(buf.readUInt32BE(offset)).toBe(0xFFFFFFFE)
        offset += CODE_SIZE
        blocks.push({id, words})
    }
    return {blocks, end: offset}
}

describe('generate/端到端', () => {
    const cases: [string, string][] = [
        ['变量与返回', `public static f:number(a:number){ var b:number=a+1; return b; }`],
        ['分支', `public static f:number(a:number){ if(a>0)return 1; else return 2; }`],
        ['循环', `public static f:number(a:number){ while(a>0)a=a-1; return a; }`],
        ['数组', `public static f:number(a:number){ var d:number[]=[a,2]; return d[0]; }`],
        ['调用', `public static g:number(x:number){return x;}
                  public static f:number(a:number){ return g(a); }`]
    ]
    for (const [name, body] of cases)
        it(name + ' 能产出字节码', () => {
            const src = M(body)
            const tool = opt_of(src)
            const buf = bin_of(src)
            const {blocks, end} = read_code(buf)
            expect(blocks.length).toBe(tool.command.size)
            expect(end).toBe(buf.length)
            const count = blocks.reduce((a, b) => a + b.words.length, 0)
            expect(count).toBe(count_of(tool))
        })

    it('块的顺序与指令数与优化后的指令流一致', () => {
        const src = M(`public static f:number(a:number){ var b:number=a+1; if(b>2)b=2; return b; }`)
        const tool = opt_of(src)
        const {blocks} = read_code(bin_of(src))
        const ids = [...tool.command.keys()]
        expect(blocks.map(b => b.id)).toEqual(ids)
        blocks.forEach((b, i) => expect(b.words.length).toBe(tool.command.get(ids[i]).length))
    })

    it('操作数为 value 的指令,形式位确实进了操作码', () => {
        const src = M(`public static f:number(a:number){ var b:number=a+1; return b; }`)
        const tool = opt_of(src)
        const {blocks} = read_code(bin_of(src))
        const ids = [...tool.command.keys()]
        //取第一条二元运算,按 (基址+类型)*8+形式 复算操作码
        const list = tool.command.get(ids[0])
        const binary = list.find((i: IRTree) => i instanceof BINARY) as BINARY
        if (binary == null) return
        const form = (binary.result.type == 'value' ? 4 : 0) + (binary.left.type == 'value' ? 2 : 0) +
            (binary.right.type == 'value' ? 1 : 0)
        const opcode = blocks[0].words[list.indexOf(binary)][0]
        expect(opcode % 8).toBe(form)
    })
})

describe('generate/已知缺陷:B15 字符串下标没被标记', () => {
    //known-issue:B15 —— HIndexExpr.is_string 有构造函数默认值 false,但全项目没有一处传 true,
    //于是字符串取下标走的是容器的 OFFSET_GET,而不是 OFFSET_STR_GET
    it('字符串下标用 OFFSET_STR_GET', () => {
        const tool = opt_of(M(`public static f:string(a:string){ return a[0]; }`))
        const names = [...tool.command.values()].flat().map((i: IRTree) => i.constructor.name)
        expect(names).toContain('OFFSET_STR_GET')
    })
})
