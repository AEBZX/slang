//运算符 -> 编号/指令名 的两张表:顺序和取值都是编码约定,钉死它们
import {describe, expect, it} from 'vitest'
import {BinaryDict, CmpDict} from '../../src/ir/tool'

describe('ir/运算符表', () => {
    //CMP 的运算符以编号进指令,编号错了比较就全错
    it('比较运算符的编号', () => {
        expect([...CmpDict]).toEqual([
            ['==', 0], ['>', 1], ['>=', 2], ['!=', 3], ['<', 4], ['<=', 5]
        ])
    })

    it('比较运算符的键是完整的', () => {
        for (const op of ['==', '!=', '>', '>=', '<', '<='])
            expect(CmpDict.has(op), op).toBe(true)
        expect(CmpDict.size).toBe(6)
    })

    it('二元运算符对应的指令名', () => {
        expect([...BinaryDict]).toEqual([
            ['+', 'add'], ['-', 'sub'], ['*', 'mul'], ['/', 'div'], ['%', 'mod'],
            ['>>', 'shr'], ['<<', 'shl'], ['&', 'and'], ['|', 'or'], ['^', 'xor']
        ])
    })

    it('二元运算符没有把逻辑与/或混进来(它们走短路展开)', () => {
        expect(BinaryDict.has('&&')).toBe(false)
        expect(BinaryDict.has('||')).toBe(false)
    })
})
