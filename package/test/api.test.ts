//包管理器 HTTP API 系统测试:启动真实 express 服务器,通过 HTTP 调用全部 API 端点
//覆盖:list/publish/download 的模块与 VM、鉴权(401)、哈希校验(400)、版本冲突(400)
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import * as path from 'path'
import * as process from 'process'
import type { Server } from 'http'
import {Result} from "../model.ts";

let server: Server
let base = ''
const dir = mkdtempSync(path.join(tmpdir(), 'spm-api-'))
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex')

async function post(url: string, body: unknown): Promise<any> {
    const r = await fetch(base + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    return r.json()
}
async function get(url: string): Promise<any> {
    const r = await fetch(base + url)
    return r.json()
}

beforeAll(async () => {
    //进程 worker 不支持 chdir,用 SPM_CONFIG_DIR 隔离数据目录
    //数据文件统一在 data/ 子目录(impl/config.ts 读 dir()+'/data/*.json')
    process.env.SPM_CONFIG_DIR = dir
    mkdirSync(path.join(dir, 'data'), { recursive: true })
    writeFileSync(path.join(dir, 'data/config.json'), JSON.stringify({
        host: '127.0.0.1', port: 2319, username: 'admin', password: 'p',
        email: 'admin@spm.dev', token: 'smtp-token', smtp: 'smtp.example.com'
    }))
    writeFileSync(path.join(dir, 'data/user.json'), JSON.stringify([
        { email: 'alice@spm.dev', token: 'tok-alice', username: 'alice' },
        { email: 'bob@spm.dev', token: 'tok-bob', username: 'bob' }
    ]))
    writeFileSync(path.join(dir, 'data/module.json'), '[]')
    writeFileSync(path.join(dir, 'data/vm.json'), '[]')
    writeFileSync(path.join(dir, 'data/compiler.json'), '[]')
    const mod = await import('../server.ts')
    server = mod.app.listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', resolve))
    const addr = server.address() as { port: number }
    base = `http://127.0.0.1:${addr.port}`
})

afterAll(() => {
    server?.close()
    delete process.env.SPM_CONFIG_DIR
    rmSync(dir, { recursive: true, force: true })
})

describe('package HTTP API', () => {
    it('初始列表为空', async () => {
        const m = await get('/api/list/module')
        expect(m.code).toBe(200)
        expect(m.data).toEqual([])
        const v = await get('/api/list/vm')
        expect(v.code).toBe(200)
        expect(v.data).toEqual([])
    })

    it('发布模块成功并出现在列表', async () => {
        const data = Buffer.from('slang module source v1.0.0')
        const res = await post('/api/publish/module', {
            author: 'alice', token: 'tok-alice', name: 'demo-mod',
            module: { version: '1.0.0', slang: '1.0.0', dependencies: [], source: '', hex: sha256(data) },
            data: data.toString('base64')
        })
        expect(res.code).toBe(200)
        const list = await get('/api/list/module')
        const pkg = list.data.find((p: any) => p.name == 'demo-mod')
        expect(pkg).toBeTruthy()
        expect(pkg.author).toBe('alice')
        expect(pkg.version[0].version).toBe('1.0.0')
    })

    it('下载模块还原原始数据', async () => {
        const data = Buffer.from('slang module source v1.0.0')
        const res = await post('/api/download/module', { name: 'demo-mod', version: '1.0.0' })
        expect(res.code).toBe(200)
        expect(Buffer.from(res.data, 'base64').equals(data)).toBe(true)
    })

    it('错误 token 发布被拒(401)', async () => {
        const data = Buffer.from('hacked')
        const res = await post('/api/publish/module', {
            author: 'alice', token: 'wrong-token', name: 'evil-mod',
            module: { version: '1.0.0', slang: '1.0.0', dependencies: [], source: '', hex: sha256(data) },
            data: data.toString('base64')
        })
        expect(res.code).toBe(401)
    })

    it('哈希不匹配被拒(400)', async () => {
        const data = Buffer.from('tampered')
        const res = await post('/api/publish/module', {
            author: 'alice', token: 'tok-alice', name: 'badhash-mod',
            module: { version: '1.0.0', slang: '1.0.0', dependencies: [], source: '', hex: 'deadbeef' },
            data: data.toString('base64')
        })
        expect(res.code).toBe(400)
    })

    it('发布 VM 成功并下载', async () => {
        const data = Buffer.from('vm-binary-bytes')
        const res = await post('/api/publish/vm', {
            author: 'alice', token: 'tok-alice',
            module: { version: '2.0.0', isa: 'x64', author: 'alice', license: 'MIT', source: '', hex: sha256(data) },
            data: data.toString('base64')
        })
        expect(res.code).toBe(200)
        const dl = await post('/api/download/vm', { version: '2.0.0' })
        expect(dl.code).toBe(200)
        expect(Buffer.from(dl.data, 'base64').equals(data)).toBe(true)
        const list = await get('/api/list/vm')
        expect(list.data.some((v: any) => v.version == '2.0.0')).toBe(true)
    })

    it('重复 VM 版本被拒(400)', async () => {
        const data = Buffer.from('vm-binary-bytes')
        const res = await post('/api/publish/vm', {
            author: 'alice', token: 'tok-alice',
            module: { version: '2.0.0', isa: 'x64', author: 'alice', license: 'MIT', source: '', hex: sha256(data) },
            data: data.toString('base64')
        })
        expect(res.code).toBe(400)
    })

    it('同一模块发布第二版本:列表仅一个 pkg,版本数 2', async () => {
        const data = Buffer.from('demo-mod v1.1.0')
        const res = await post('/api/publish/module', {
            author: 'alice', token: 'tok-alice', name: 'demo-mod',
            module: { version: '1.1.0', slang: '1.0.0', dependencies: [], source: '', hex: sha256(data) },
            data: data.toString('base64')
        })
        expect(res.code).toBe(200)
        const list = await get('/api/list/module')
        const pkgs = list.data.filter((p: any) => p.name == 'demo-mod')
        //修复前:pkg.version.push 后又 config.push(pkg),同名 pkg 重复出现
        expect(pkgs.length).toBe(1)
        expect(pkgs[0].version.length).toBe(2)
        //两个版本都可下载
        const dl1 = await post('/api/download/module', { name: 'demo-mod', version: '1.0.0' })
        const dl2 = await post('/api/download/module', { name: 'demo-mod', version: '1.1.0' })
        expect(dl1.code).toBe(200)
        expect(dl2.code).toBe(200)
        expect(Buffer.from(dl2.data, 'base64').equals(data)).toBe(true)
    })

    it('下载不存在的模块返回 404 而非崩溃', async () => {
        const res = await post('/api/download/module', { name: 'no-such-mod', version: '1.0.0' })
        expect(res.code).toBe(404)
        const vm = await post('/api/download/vm', { version: '99.0.0' })
        expect(vm.code).toBe(404)
    })

    it('模块重复版本发布被拒(400)', async () => {
        const data = Buffer.from('demo-mod v1.0.0 again')
        const res = await post('/api/publish/module', {
            author: 'alice', token: 'tok-alice', name: 'demo-mod',
            module: { version: '1.0.0', slang: '1.0.0', dependencies: [], source: '', hex: sha256(data) },
            data: data.toString('base64')
        })
        expect(res.code).toBe(400)
    })

    it('非作者给已有模块加版本被拒(400)', async () => {
        const data = Buffer.from('bob hijack')
        const res = await post('/api/publish/module', {
            author: 'bob', token: 'tok-bob', name: 'demo-mod',
            module: { version: '9.9.9', slang: '1.0.0', dependencies: [], source: '', hex: sha256(data) },
            data: data.toString('base64')
        })
        expect(res.code).toBe(400)
    })

    it('verify 端点', async () => {
        const vok = await post('/api/verify', { username: 'alice', token: 'tok-alice' })
        expect(vok.code).toBe(200)
        expect(vok.data).toBe(true)
        const vno = await post('/api/verify', { username: 'alice', token: 'x' })
        expect(vno.code).toBe(400)
        expect(vno.data).toBe(false)
    })

    it('register 创建用户、token 入库、重复注册被拒', async () => {
        const r = await post('/api/register', { username: 'carol', email: 'carol@spm.dev' })
        expect(r.code).toBe(200)
        const users = JSON.parse(readFileSync(path.join(dir, 'data/user.json'), 'utf-8'))
        const carol = users.find((u: any) => u.username == 'carol')
        expect(carol).toBeTruthy()
        expect(carol.token).toBeTruthy()
        const again = await post('/api/register', { username: 'carol', email: 'carol@spm.dev' })
        expect(again.code).toBe(400)
        const empty = await post('/api/register', { username: '', email: '' })
        expect(empty.code).toBe(400)
    })

    it('发布大模块(>100kb)成功并可下载', async () => {
        const data = Buffer.alloc(200 * 1024, 0xAB)
        const res = await post('/api/publish/module', {
            author: 'alice', token: 'tok-alice', name: 'big-mod',
            module: { version: '1.0.0', slang: '1.0.0', dependencies: [], source: '', hex: sha256(data) },
            data: data.toString('base64')
        })
        expect(res.code).toBe(200)
        const dl = await post('/api/download/module', { name: 'big-mod', version: '1.0.0' })
        expect(dl.code).toBe(200)
        expect(Buffer.from(dl.data, 'base64').equals(data)).toBe(true)
    })

    it('非法 JSON 请求返回 JSON 错误而非 HTML', async () => {
        const r = await fetch(base + '/api/publish/module', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{bad json'
        })
        const j = await r.json() as Result<any>
        expect(j.code).toBe(400)
        expect(j.message).toBeTruthy()
    })

    it('compiler:创建大版本、发布小版本、列表、下载', async () => {
        const source = 'compiler source v1.0.0'
        const create = await post('/api/publish/compiler/create', {
            author: 'alice', token: 'tok-alice', license: 'MIT', version: '1.0'
        })
        expect(create.code).toBe(200)
        const add = await post('/api/publish/compiler/add', {
            author: 'alice', token: 'tok-alice', version: '1.0',
            type: { version: '1.0.0', hex: sha256(Buffer.from(source)), source: '' },
            data: source
        })
        expect(add.code).toBe(200)
        const list = await get('/api/list/compiler')
        expect(list.code).toBe(200)
        const ver = list.data.find((c: any) => c.version == '1.0')
        expect(ver).toBeTruthy()
        expect(ver.child[0].version).toBe('1.0.0')
        const dl = await post('/api/download/compiler', { large_version: '1.0', small_version: '1.0.0' })
        expect(dl.code).toBe(200)
        expect(dl.data).toBe(source)
    })

    it('compiler:重复大版本/小版本、非作者、错误 token 被拒', async () => {
        const dup_create = await post('/api/publish/compiler/create', {
            author: 'alice', token: 'tok-alice', license: 'MIT', version: '1.0'
        })
        expect(dup_create.code).toBe(400)
        const source = 'compiler source v1.0.1'
        const dup_add = await post('/api/publish/compiler/add', {
            author: 'alice', token: 'tok-alice', version: '1.0',
            type: { version: '1.0.0', hex: sha256(Buffer.from(source)), source: '' },
            data: source
        })
        expect(dup_add.code).toBe(400)
        const hijack = await post('/api/publish/compiler/add', {
            author: 'bob', token: 'tok-bob', version: '1.0',
            type: { version: '1.0.2', hex: sha256(Buffer.from(source)), source: '' },
            data: source
        })
        expect(hijack.code).toBe(400)
        const unauth = await post('/api/publish/compiler/create', {
            author: 'alice', token: 'wrong-token', license: 'MIT', version: '2.0'
        })
        expect(unauth.code).toBe(401)
    })

    it('compiler:下载不存在的大/小版本返回 404 而非崩溃', async () => {
        const big = await post('/api/download/compiler', { large_version: '99.0', small_version: '1.0.0' })
        expect(big.code).toBe(404)
        const small = await post('/api/download/compiler', { large_version: '1.0', small_version: '99.0' })
        expect(small.code).toBe(404)
    })

    it('compiler:哈希不匹配被拒(400)', async () => {
        const res = await post('/api/publish/compiler/add', {
            author: 'alice', token: 'tok-alice', version: '1.0',
            type: { version: '1.0.3', hex: 'deadbeef', source: '' },
            data: 'tampered compiler'
        })
        expect(res.code).toBe(400)
    })
})
