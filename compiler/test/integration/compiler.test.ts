import { describe, expect, it } from 'vitest'
import compile from '../../index'

//字节码数组=常量池段+命令段:
//[pool_size, 池条目...(id,type,数据), 命令...(每条4个int)]
const parse_pool = (bytes: number[]): [Map<number, number | string>, number] => {
    let i = 0
    const size = bytes[i++]
    const pool = new Map<number, number | string>()
    for (let k = 0; k < size; k++) {
        const id = bytes[i++]
        const type = bytes[i++]
        if (type == 0) pool.set(id, bytes[i++])
        else {
            const len = bytes[i++]
            let s = ''
            for (let j = 0; j < len; j++) s += String.fromCharCode(bytes[i++])
            pool.set(id, s)
        }
    }
    return [pool, i]
}

describe('compiler 字节码导出', () => {
    it('字节码数组含常量池段+命令段,可解析还原', () => {
        const bytes = compile(['public static main:string(){return "hi";}\n'], 0)
        //解析常量池段,剩余为命令段
        const [pool, cmd_start] = parse_pool(bytes)
        expect(pool.size).toBeGreaterThan(0)
        expect([...pool.values()]).toContain('hi')
        //命令段每条4个int,首指令block_start(opcode=156)
        const rest = bytes.length - cmd_start
        expect(rest).toBeGreaterThan(0)
        expect(rest % 4).toBe(0)
        expect(bytes[cmd_start]).toBe(156)
    })
    it('数字常量以type0编码', () => {
        const bytes = compile(['public static main:number(){return 1+2;}\n'], 0)
        const [pool] = parse_pool(bytes)
        expect([...pool.values()].some(v => typeof v == 'number')).toBe(true)
    })
})
