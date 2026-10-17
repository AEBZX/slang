//只读的 .sbin 解码器:把产物整体读一遍,任何不自洽都直接报出来
//(测试用,不进 src)

export type sbin_ins = {opcode: number, operands: number[]}
export type sbin_pool_entry = {id: number, type: number, value: any}
export type sbin = {
    pool: Map<number, sbin_pool_entry>,
    blocks: Map<number, sbin_ins[]>,
    //文件里的块顺序
    order: number[]
}

//合法操作码:(指令基址 + 类型偏移) * 8 + 形式位(0~7)
const BASE = [0, 1, 2, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35]
const BINARY_TYPES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
export const OPCODES = (() => {
    const set = new Set<number>()
    for (const base of BASE)
        for (let form = 0; form < 8; form++)
            set.add(base * 8 + form)
    for (const t of BINARY_TYPES)
        for (let form = 0; form < 8; form++)
            set.add((2 + t) * 8 + form)
    return set
})()

const HEADER = 'SLANG1.0.0'

export function decode(buf: Buffer): sbin {
    const text = (from: number, len: number) => buf.slice(from, from + len).toString('latin1')
    if (text(0, HEADER.length) != HEADER)
        throw new Error('文件头不对: ' + JSON.stringify(text(0, 12)))
    let offset = HEADER.length
    if (text(offset, 'POOL_START'.length) != 'POOL_START')
        throw new Error('缺少 POOL_START 在 ' + offset)
    offset += 'POOL_START'.length
    const pool = new Map<number, sbin_pool_entry>()
    while (true) {
        if (text(offset, 'POOL_END'.length) == 'POOL_END') {
            offset += 'POOL_END'.length
            break
        }
        if (offset + 9 > buf.length) throw new Error('池条目越界在 ' + offset)
        const id = buf.readUInt32BE(offset)
        const type = buf.readUInt8(offset + 4)
        const len = buf.readUInt32BE(offset + 5)
        if (type != 0 && type != 1) throw new Error(`池条目 ${id} 的类型非法: ${type}`)
        if (type == 1 && len != 8) throw new Error(`数字池条目 ${id} 的长度应为 8,实际 ${len}`)
        if (offset + 9 + len > buf.length) throw new Error(`池条目 ${id} 数据越界`)
        if (pool.has(id)) throw new Error(`池 id 重复: ${id}`)
        const data = buf.slice(offset + 9, offset + 9 + len)
        pool.set(id, {id, type, value: type == 1 ? data.readDoubleBE(0) : data.toString('utf-8')})
        offset += 9 + len
    }
    if (text(offset, 'CODE_START'.length) != 'CODE_START')
        throw new Error('缺少 CODE_START 在 ' + offset)
    offset += 'CODE_START'.length
    const blocks = new Map<number, sbin_ins[]>()
    const order: number[] = []
    while (offset + 16 <= buf.length && buf.readUInt32BE(offset) == 0xFFFFFFFF) {
        const id = buf.readUInt32BE(offset + 4)
        if (buf.readUInt32BE(offset + 8) != 0 || buf.readUInt32BE(offset + 12) != 0)
            throw new Error(`块头 ${id} 的保留字不是 0`)
        if (blocks.has(id)) throw new Error(`块号重复: ${id}`)
        offset += 16
        const list: sbin_ins[] = []
        while (true) {
            if (offset + 16 > buf.length) throw new Error(`块 ${id} 没有结束标记`)
            if (buf.readUInt32BE(offset) == 0xFFFFFFFE) {
                if (buf.readUInt32BE(offset + 4) != 0 || buf.readUInt32BE(offset + 8) != 0 || buf.readUInt32BE(offset + 12) != 0)
                    throw new Error(`块 ${id} 的结束标记保留字不是 0`)
                offset += 16
                break
            }
            const opcode = buf.readUInt32BE(offset)
            if (!OPCODES.has(opcode)) throw new Error(`块 ${id} 有未知操作码 ${opcode}`)
            list.push({
                opcode,
                operands: [buf.readUInt32BE(offset + 4), buf.readUInt32BE(offset + 8), buf.readUInt32BE(offset + 12)]
            })
            offset += 16
        }
        blocks.set(id, list)
        order.push(id)
    }
    if (offset != buf.length) throw new Error(`文件尾部还有 ${buf.length - offset} 字节没被解析`)
    return {pool, blocks, order}
}

//操作码 -> 指令基址(用来反查是不是二元运算)
export const binary_base = (opcode: number) => Math.floor(opcode / 8)
