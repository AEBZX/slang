//CLI 包管理(publish/install/uninstall)与 SPM Server 端到端系统测试
//覆盖:发布→列表→安装→依赖递归安装→卸载→孤儿依赖清理→冲突与未配置报错→安装后项目可编译
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import * as path from 'path'
import * as process from 'process'
import type { Server } from 'http'
import { install, publish, uninstall, compiler } from '../../cli/command'
import { GlobalConfig, ProjectConfig } from '../../cli/config'

let server: Server
let global: GlobalConfig
const dir = mkdtempSync(path.join(tmpdir(), 'spm-cli-'))
const pubDir = mkdtempSync(path.join(tmpdir(), 'slang-pub-'))
const appDir = mkdtempSync(path.join(tmpdir(), 'slang-app-'))

function make_project(root: string, name: string, version: string, author: string, deps: { name: string, version: string }[] = []): ProjectConfig {
    const config: ProjectConfig = {
        name, version, author, license: 'MIT', slang: '1.0.0',
        ignore: [], optimize: 0, output: 'out', vm: 'vm.exe',
        lib: { local: 'lib', data: deps }, lock: []
    }
    mkdirSync(path.join(root, 'lib'), { recursive: true })
    writeFileSync(path.join(root, 'slang.json'), JSON.stringify(config, null, 4))
    return config
}

async function post(url: string, body: unknown): Promise<any> {
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    return r.json()
}
async function get(url: string): Promise<any> {
    const r = await fetch(url)
    return r.json()
}

beforeAll(async () => {
    process.env.SPM_CONFIG_DIR = dir
    writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
        host: '127.0.0.1', port: 2319, username: 'admin', password: 'p',
        email: 'admin@spm.dev', token: 'smtp-token', smtp: 'smtp.example.com'
    }))
    writeFileSync(path.join(dir, 'user.json'), JSON.stringify([
        { email: 'alice@spm.dev', token: 'tok-alice', username: 'alice' }
    ]))
    writeFileSync(path.join(dir, 'module.json'), '[]')
    writeFileSync(path.join(dir, 'vm.json'), '[]')
    const mod = await import('../../../package/server.ts')
    server = mod.app.listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', resolve))
    const addr = server.address() as { port: number }
    global = { server: `http://127.0.0.1:${addr.port}`, username: 'alice', password: 'tok-alice' }
})

afterAll(() => {
    server?.close()
    delete process.env.SPM_CONFIG_DIR
    for (const d of [dir, pubDir, appDir]) rmSync(d, { recursive: true, force: true })
})

describe('CLI publish/install 端到端', () => {
    it('publish 发布模块,服务器列表出现且数据为真实压缩包', async () => {
        const project = make_project(pubDir, 'math', '1.0.0', 'alice')
        const src = 'public add:number(a:number,b:number){return a+b;}\n'
        writeFileSync(path.join(pubDir, 'math.sl'), src)
        await publish(global, project, pubDir)
        const list = await get(global.server + '/api/list/module')
        const pkg = list.data.find((p: any) => p.name == 'math')
        expect(pkg).toBeTruthy()
        expect(pkg.author).toBe('alice')
        expect(pkg.version[0].version).toBe('1.0.0')
        //服务器存储的下载数据:非空且为 .tar.xz(修复前 compress 同步回调未触发,上传的是空数据)
        const dl = await post(global.server + '/api/download/module', { name: 'math', version: '1.0.0' })
        expect(dl.code).toBe(200)
        const buf = Buffer.from(dl.data, 'base64')
        expect(buf.length).toBeGreaterThan(0)
        expect(buf.subarray(0, 6)).toEqual(Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]))
    })

    it('install 下载模块到 lib/name 并写入 slang.json', async () => {
        const project = make_project(appDir, 'app', '1.0.0', 'alice')
        writeFileSync(path.join(appDir, 'main.sl'), 'public static main:string(){return "ok";}\n')
        await install(global, project, 'math', '1.0.0', appDir)
        //源码落地且内容与发布端一致
        const extracted = path.join(appDir, 'lib', 'math', 'math.sl')
        expect(existsSync(extracted)).toBe(true)
        expect(readFileSync(extracted, 'utf-8')).toBe('public add:number(a:number,b:number){return a+b;}\n')
        //slang.json 记录依赖
        const saved = JSON.parse(readFileSync(path.join(appDir, 'slang.json'), 'utf-8')) as ProjectConfig
        expect(saved.lib.data).toContainEqual({ name: 'math', version: '1.0.0' })
    })

    it('安装依赖模块时递归安装其依赖', async () => {
        //发布 math-plus,依赖 math
        const plusDir = mkdtempSync(path.join(tmpdir(), 'slang-plus-'))
        const plus = make_project(plusDir, 'math-plus', '1.0.0', 'alice', [{ name: 'math', version: '1.0.0' }])
        writeFileSync(path.join(plusDir, 'plus.sl'), 'public mul:number(a:number,b:number){return a*b;}\n')
        await publish(global, plus, plusDir)
        //消费者安装 math-plus → math 也应被安装
        const consumer = make_project(appDir, 'app', '1.0.0', 'alice')
        writeFileSync(path.join(appDir, 'main.sl'), 'public static main:string(){return "ok";}\n')
        await install(global, consumer, 'math-plus', '1.0.0', appDir)
        expect(existsSync(path.join(appDir, 'lib', 'math-plus', 'plus.sl'))).toBe(true)
        expect(existsSync(path.join(appDir, 'lib', 'math', 'math.sl'))).toBe(true)
        const saved = JSON.parse(readFileSync(path.join(appDir, 'slang.json'), 'utf-8')) as ProjectConfig
        expect(saved.lib.data).toContainEqual({ name: 'math-plus', version: '1.0.0' })
        expect(saved.lib.data).toContainEqual({ name: 'math', version: '1.0.0' })
        rmSync(plusDir, { recursive: true, force: true })
    })

    it('安装后项目可编译:lib 内模块源码一并参与编译', async () => {
        const project = JSON.parse(readFileSync(path.join(appDir, 'slang.json'), 'utf-8')) as ProjectConfig
        compiler(global, project, appDir)
        expect(existsSync(path.join(appDir, 'out.sbin'))).toBe(true)
    })

    it('uninstall 卸载模块并清理孤儿依赖', async () => {
        const project = JSON.parse(readFileSync(path.join(appDir, 'slang.json'), 'utf-8')) as ProjectConfig
        //uninstall math-plus 后 math 无其他依赖引用 → 一并清理
        uninstall(global, project, 'math-plus', appDir)
        expect(existsSync(path.join(appDir, 'lib', 'math-plus'))).toBe(false)
        expect(existsSync(path.join(appDir, 'lib', 'math'))).toBe(false)
        const saved = JSON.parse(readFileSync(path.join(appDir, 'slang.json'), 'utf-8')) as ProjectConfig
        expect(saved.lib.data.some(e => e.name == 'math-plus')).toBe(false)
        expect(saved.lib.data.some(e => e.name == 'math')).toBe(false)
    })

    it('同名不同版本 install 冲突抛错;同版本幂等', async () => {
        const project = make_project(appDir, 'app', '1.0.0', 'alice')
        await install(global, project, 'math', '1.0.0', appDir)
        //同版本:直接返回不重复下载
        await expect(install(global, project, 'math', '1.0.0', appDir)).resolves.toBeUndefined()
        //不同版本:抛错
        await expect(install(global, project, 'math', '2.0.0', appDir)).rejects.toThrow('different version')
    })

    it('未配置 server / token 时 publish、install 报错', async () => {
        const project = make_project(appDir, 'app', '1.0.0', 'alice')
        await expect(install({ server: '', username: 'alice', password: 'tok-alice' }, project, 'math', '1.0.0', appDir))
            .rejects.toThrow('server not configured')
        await expect(publish({ server: global.server, username: 'alice', password: '' }, project, appDir))
            .rejects.toThrow('token not configured')
    })

    it('install 不存在的模块抛错', async () => {
        const project = make_project(appDir, 'app', '1.0.0', 'alice')
        await expect(install(global, project, 'no-such-mod', '1.0.0', appDir)).rejects.toThrow(/404/)
    })

    it('错误 token publish 被服务器拒绝(401)', async () => {
        const project = make_project(appDir, 'evil', '1.0.0', 'alice')
        writeFileSync(path.join(appDir, 'evil.sl'), 'public f:number(){return 1;}\n')
        await expect(publish({ server: global.server, username: 'alice', password: 'wrong' }, project, appDir))
            .rejects.toThrow(/401/)
    })
})
