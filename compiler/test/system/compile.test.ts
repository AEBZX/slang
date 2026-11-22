import {describe, expect, it} from 'vitest'
import compile from '../../src/index'

describe('compile 集成: 管线端到端', () => {
    it('空函数 main 出码并带 SLANG 魔数', () => {
        const buffer = compile(['app: module { main: void() { } }'])
        expect(buffer.subarray(0, 5).toString()).toBe('SLANG')
        expect(buffer.subarray(5, 13).toString()).toBe('bzx-ins1')
    })

    it('前向 goto 出码', () => {
        const buffer = compile([`app: module {
    main: ()=>void = ()=>void {
        goto skip;
        skip: var x: number = 1;
    };
}`])
        expect(buffer.subarray(0, 5).toString()).toBe('SLANG')
    })

    it('解析失败抛出异常', () => {
        expect(() => compile(['app: module { main: void() { var; } }'])).toThrow()
    })

    it('未定义变量在 check 阶段抛出', () => {
        expect(() => compile(['app: module { main: void() { y = 1; } }'])).toThrow(/check 报错/)
    })

    it('多文件编译', () => {
        const buffer = compile([
            'app: module { main: void() { } }',
            'lib: module { helper: void() { } }'
        ])
        expect(buffer.subarray(0, 5).toString()).toBe('SLANG')
    })
})
