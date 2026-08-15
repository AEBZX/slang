import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import * as path from 'path'
import { compiler } from '../../cli/command'
import { DefaultGlobalConfig, ProjectConfig } from '../../cli/config'

//.sbin 布局(command.ts):POOL_START [id(u32) type(u8) len(u32) data]* POOL_END CODE_START [opcode(u8) a b c(u32)]* CODE_END
function parse_sbin(buf: Buffer): { pool: Map<number, number | string>, code: number[][] } {
    const s = buf.toString('utf-8')
    const ps = s.indexOf('POOL_START') + 'POOL_START'.length
    const pe = s.indexOf('POOL_END')
    const cs = s.indexOf('CODE_START') + 'CODE_START'.length
    const ce = s.indexOf('CODE_END')
    expect(ps).toBeGreaterThan('POOL_START'.length - 1)
    //空池时 POOL_END 紧贴 POOL_START
    expect(pe).toBeGreaterThanOrEqual(ps)
    expect(cs).toBeGreaterThanOrEqual(pe + 'POOL_END'.length)
    expect(ce).toBeGreaterThanOrEqual(cs)

    const pool = new Map<number, number | string>()
    let i = ps
    while (i < pe) {
        const id = buf.readUInt32LE(i)
        const type = buf.readUInt8(i + 4)
        const len = buf.readUInt32LE(i + 5)
        i += 9
        if (type == 1) {
            pool.set(id, buf.readDoubleLE(i))
            i += 8
        } else {
            pool.set(id, buf.toString('utf-8', i, i + len))
            i += len
        }
    }
    expect(i).toBe(pe)

    const code: number[][] = []
    let j = cs
    while (j < ce) {
        const op = buf.readUInt8(j)
        const a = buf.readUInt32LE(j + 1)
        const b = buf.readUInt32LE(j + 5)
        const c = buf.readUInt32LE(j + 9)
        code.push([op, a, b, c])
        j += 13
    }
    expect(j).toBe(ce)
    return { pool, code }
}

function make_project(code: string): { dir: string, config: ProjectConfig } {
    const dir = mkdtempSync(path.join(tmpdir(), 'slang-cli-'))
    writeFileSync(path.join(dir, 'main.sl'), code)
    const config: ProjectConfig = {
        name: 'cli-test',
        version: '1.0.0',
        author: '',
        license: '',
        ignore: [],
        optimize: 0,
        output: 'out',
        vm: 'vm.exe',
        lib: { local: 'lib', data: [] }
    }
    return { dir, config }
}

describe('cli compiler 命令', () => {
    it('编译目录内 .sl 生成 .sbin,POOL/CODE 段可解析', () => {
        const { dir, config } = make_project('public static main:string(){return "hi";}\n')
        compiler(DefaultGlobalConfig, config, dir)
        const file = path.join(dir, 'out.sbin')
        expect(existsSync(file)).toBe(true)
        const { pool, code } = parse_sbin(readFileSync(file))
        expect([...pool.values()]).toContain('hi')
        expect(code.length).toBeGreaterThan(0)
        //入口块以 block_start(156) 开头,无 null 占位写入
        expect(code[0][0]).toBe(156)
        expect(code.some(c => c[0] == 121)).toBe(true) //retn
        rmSync(dir, { recursive: true, force: true })
    })
    it('数字常量按 double 写入 POOL 段', () => {
        const { dir, config } = make_project('public static main:number(){return 1+2;}\n')
        compiler(DefaultGlobalConfig, config, dir)
        const { pool } = parse_sbin(readFileSync(path.join(dir, 'out.sbin')))
        expect([...pool.values()].some(v => typeof v == 'number')).toBe(true)
        rmSync(dir, { recursive: true, force: true })
    })
    it('空目录(无 .sl)应产出空 CODE 段且不抛异常', () => {
        const dir = mkdtempSync(path.join(tmpdir(), 'slang-cli-'))
        const config: ProjectConfig = {
            name: 'empty', version: '1.0.0', author: '', license: '',
            ignore: [], optimize: 0, output: 'out', vm: 'vm.exe',
            lib: { local: 'lib', data: [] }
        }
        compiler(DefaultGlobalConfig, config, dir)
        expect(existsSync(path.join(dir, 'out.sbin'))).toBe(true)
        const { code } = parse_sbin(readFileSync(path.join(dir, 'out.sbin')))
        //空项目只有入口块:block_start(156) + block_end(158),无其他指令
        expect(code).toEqual([[156, 0, 0, 0], [158, 0, 0, 0]])
        rmSync(dir, { recursive: true, force: true })
    })
})
