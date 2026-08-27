import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'fs'
import { tmpdir } from 'os'
import * as path from 'path'
import command from '@cli/command.ts'

//.sbin 布局:POOL_START [id(u32) type(u8) len(u32) data]* POOL_END CODE_START [opcode(u8) a b c(u32)]* CODE_END
function parse_sbin(buf: Buffer): { pool: Map<number, number | string>, code: number[][] } {
    const s = buf.toString('utf-8')
    const ps = s.indexOf('POOL_START') + 'POOL_START'.length
    const pe = s.indexOf('POOL_END')
    const cs = s.indexOf('CODE_START') + 'CODE_START'.length
    const ce = s.indexOf('CODE_END')
    expect(ps).toBeGreaterThan('POOL_START'.length - 1)
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

//创建临时项目目录,含 slang.json + main.sl + venv/compiler.js
function make_project(code: string, optimize = 0): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'slang-cli-'))
    writeFileSync(path.join(dir, 'main.sl'), code, 'utf-8')
    //slang.json
    const config = {
        name: 'cli-test',
        version: '1.0.0',
        author: '',
        license: 'MIT',
        ignore: [],
        dependency: [],
        optimize,
        output: 'out',
        venv: { dir: 'venv', compiler: '1', compiler_version: '1.2', vm: '1.0.0-win', vm_version: '1.0.0-win' },
        lib: { local: 'lib', data: [] }
    }
    writeFileSync(path.join(dir, 'slang.json'), JSON.stringify(config, null, 2), 'utf-8')
    //venv/compiler.js — 从本地复制
    const venvDir = path.join(dir, 'venv')
    mkdirSync(venvDir, { recursive: true })
    const compilerLocal = path.resolve(__dirname, '../../dist/cli.js')
    if (existsSync(compilerLocal))
        copyFileSync(compilerLocal, path.join(venvDir, 'compiler.js'))
    return dir
}

describe('cli compiler 命令', { timeout: 30000 }, () => {
    it('编译目录内 .sl 生成 .sbin,POOL/CODE 段可解析', () => {
        const dir = make_project('public static main:string(){return "hi";}\n')
        try {
            command.compiler(dir)
            const file = path.join(dir, 'out.sbin')
            expect(existsSync(file)).toBe(true)
            const { pool, code } = parse_sbin(readFileSync(file))
            expect([...pool.values()]).toContain('hi')
            expect(code.length).toBeGreaterThan(0)
            expect(code[0][0]).toBe(156) //block_start
            expect(code.some(c => c[0] == 169)).toBe(true) //retn
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })
    it('数字常量按 double 写入 POOL 段', () => {
        const dir = make_project('public static main:number(){return 1+2;}\n')
        try {
            command.compiler(dir)
            const { pool } = parse_sbin(readFileSync(path.join(dir, 'out.sbin')))
            expect([...pool.values()].some(v => typeof v == 'number')).toBe(true)
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })
    it('空目录(无 .sl)应产出空 CODE 段且不抛异常', () => {
        const dir = mkdtempSync(path.join(tmpdir(), 'slang-cli-'))
        const config = {
            name: 'empty', version: '1.0.0', author: '', license: 'MIT',
            ignore: [], dependency: [], optimize: 0, output: 'out',
            venv: { dir: 'venv', compiler: '1', compiler_version: '1.2', vm: '1.0.0-win', vm_version: '1.0.0-win' },
            lib: { local: 'lib', data: [] }
        }
        writeFileSync(path.join(dir, 'slang.json'), JSON.stringify(config, null, 2), 'utf-8')
        const venvDir = path.join(dir, 'venv')
        mkdirSync(venvDir, { recursive: true })
        const compilerLocal = path.resolve(__dirname, '../../dist/cli.js')
        if (existsSync(compilerLocal))
            copyFileSync(compilerLocal, path.join(venvDir, 'compiler.js'))
        try {
            command.compiler(dir)
            expect(existsSync(path.join(dir, 'out.sbin'))).toBe(true)
            const { code } = parse_sbin(readFileSync(path.join(dir, 'out.sbin')))
            //空项目只有入口块:block_start(156) + block_end(158)
            expect(code).toEqual([[156, 0, 0, 0], [158, 0, 0, 0]])
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })
})