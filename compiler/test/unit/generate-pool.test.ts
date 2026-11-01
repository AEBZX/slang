import {describe, expect, it} from 'vitest'
import {bin_of, opt_of} from '../unit/helper-ir'

const M = (body: string) => `public m:module{ public static f:number(a:number){ ${body} } }`

//按 (id,类型,长度,数据) 读常量池
function read_pool(buf: Buffer): Map<number, {type: number, len: number, value: any}> {
    const out = new Map<number, {type: number, len: number, value: any}>()
    let offset = buf.indexOf('POOL_START') + 'POOL_START'.length
    while (offset + 9 <= buf.length) {
        if (buf.slice(offset, offset + 8).toString('latin1') == 'POOL_END') break
        const id = buf.readUInt32BE(offset)
        const type = buf.readUInt8(offset + 4)
        const len = buf.readUInt32BE(offset + 5)
        const data = buf.slice(offset + 9, offset + 9 + len)
        out.set(id, {type, len, value: type == 1 ? data.readDoubleBE(0) : data.toString('utf-8')})
        offset += 9 + len
    }
    return out
}

describe('generate/常量池编码', () => {
    it('数字项:type=1,长度 8,double 大端', () => {
        const src = M('return 42;')
        const pool = read_pool(bin_of(src))
        const found = [...pool.values()].filter(e => e.type == 1 && e.value == 42)
        expect(found.length).toBe(1)
        expect(found[0].len).toBe(8)
    })

    it('字符串项:type=0,长度是字节数', () => {
        const src = M('var s:string="abc"; return 1;')
        const pool = read_pool(bin_of(src))
        const found = [...pool.values()].filter(e => e.type == 0 && e.value == 'abc')
        expect(found.length).toBe(1)
        expect(found[0].len).toBe(3)
    })

    it('重复常量只入池一次', () => {
        const src = M('var b:number=7; var c:number=7; var d:number=7; return b+c+d;')
        const pool = read_pool(bin_of(src))
        expect([...pool.values()].filter(e => e.value == 7).length).toBe(1)
    })

    it('池和 OPTTool 的池完全一致', () => {
        const src = M('var s:string="k"; var b:number=3; return b;')
        const tool = opt_of(src)
        const pool = read_pool(bin_of(src))
        expect(pool.size).toBe(tool.pool.size)
        for (const [id, v] of tool.pool) expect(pool.get(id)!.value).toEqual(v)
    })
})

describe('generate/代码段', () => {
    it('块数等于指令流块数,每块 16 字节头 + 每条指令 16 字节', () => {
        const src = M('var b:number=a+1; if(b>0)b=2; return b;')
        const tool = opt_of(src)
        const buf = bin_of(src)
        const start = buf.indexOf('CODE_START') + 'CODE_START'.length
        let offset = start
        let blocks = 0
        let total = 0
        while (offset + 16 <= buf.length && buf.readUInt32BE(offset) == 0xFFFFFFFF) {
            blocks++
            offset += 16
            while (offset + 16 <= buf.length && buf.readUInt32BE(offset) != 0xFFFFFFFE) {
                total++
                offset += 16
            }
            offset += 16
        }
        expect(blocks).toBe(tool.command.size)
        expect(total).toBe([...tool.command.values()].reduce((a, b) => a + b.length, 0))
        expect(offset).toBe(buf.length)
    })

    it('块头里带着块号', () => {
        const src = M('var b:number=a+1; return b;')
        const tool = opt_of(src)
        const buf = bin_of(src)
        const start = buf.indexOf('CODE_START') + 'CODE_START'.length
        const ids: number[] = []
        let offset = start
        while (offset + 16 <= buf.length && buf.readUInt32BE(offset) == 0xFFFFFFFF) {
            ids.push(buf.readUInt32BE(offset + 4))
            offset += 16
            while (offset + 16 <= buf.length && buf.readUInt32BE(offset) != 0xFFFFFFFE) offset += 16
            offset += 16
        }
        expect(ids).toEqual([...tool.command.keys()])
    })
})
