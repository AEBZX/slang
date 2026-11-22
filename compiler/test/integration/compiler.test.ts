import {describe, expect, it} from 'vitest'
import compile from '../../src/index'

describe('compiler 全管线集成', () => {
    it('多文件编译', () => {
        const buf = compile([
            'app: module { main: void() { var x: number = 1; } }',
            'lib: module { helper: void() { } }'
        ])
        expect(buf.subarray(0, 5).toString()).toBe('SLANG')
    })

    it('解析错误抛出', () => {
        expect(() => compile(['app: module { main: void() { var; } }'])).toThrow()
    })

    it('check 错误抛出', () => {
        expect(() => compile(['app: module { main: void() { y = 1; } }'])).toThrow(/check 报错/)
    })

    it('check 错误聚合多文件', () => {
        expect(() => compile([
            'app: module { main: void() { y = 1; } }',
            'lib: module { main: void() { z = 1; } }'
        ])).toThrow(/y = 1/)
    })
})
