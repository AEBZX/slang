//cli utils 单元测试:压缩/解压/哈希/项目配置
//注意:global_config 会读写真实 ~/.slang/config.json,此处不测,避免污染用户环境
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import {createHash} from 'node:crypto'
import {compress, decompress, hash_verify, project_config} from '../utils/utils.ts'

let dir = ''
beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'cli-utils-'))
})
afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
})

describe('hash_verify', () => {
    it('正确哈希通过', () => {
        const data = Buffer.from('hello slang')
        const hex = createHash('sha256').update(data).digest('hex')
        expect(hash_verify(data, hex)).toBe(true)
    })
    it('错误哈希不通过', () => {
        expect(hash_verify(Buffer.from('hello'), 'deadbeef')).toBe(false)
    })
    it('字符串数据也能校验', () => {
        const hex = createHash('sha256').update('abc').digest('hex')
        expect(hash_verify('abc', hex)).toBe(true)
    })
})

describe('compress/decompress 往返', () => {
    it('压缩排除 ignore 目录后可还原', async () => {
        //项目结构:main.sl 与 lib/ 目录,ignore 排除 lib
        mkdirSync(path.join(dir, 'lib'), { recursive: true })
        writeFileSync(path.join(dir, 'main.sl'), 'print("hi")\n')
        writeFileSync(path.join(dir, 'lib', 'foo.sl'), 'should be ignored')
        const buf = await compress(['lib'], dir)
        expect(Buffer.isBuffer(buf)).toBe(true)
        expect(buf.length).toBeGreaterThan(0)

        //解压到 output,校验哈希,再解出文件
        const hex = createHash('sha256').update(buf).digest('hex')
        await decompress('mypkg', buf, path.join(dir, 'out'), hex)
        expect(readFileSync(path.join(dir, 'out', 'mypkg', 'main.sl'), 'utf-8')).toBe('print("hi")\n')
        //ignore 的目录不应被打包
        expect(readdirSync(path.join(dir, 'out', 'mypkg'))).not.toContain('lib')
    })

    it('哈希不匹配时抛文件校验失败', async () => {
        writeFileSync(path.join(dir, 'a.sl'), 'a')
        const buf = await compress([], dir)
        await expect(decompress('bad', buf, path.join(dir, 'out2'), 'deadbeef'))
            .rejects.toThrow('文件校验失败')
        //不应留下任何解压产物
        expect(existsSync(path.join(dir, 'out2', 'bad'))).toBe(false)
    })
})

describe('project_config', () => {
    it('读取 slang.json', () => {
        const cfg = {
            name: 'demo', version: '1.0.0', author: 'tester', license: 'MIT',
            ignore: ['lib'], optimize: 0, output: 'a.sbin',
            venv: { dir: 'venv', compiler: '1.0', vm: '2.0', compiler_version: '1.0.0', vm_version: '2.0' },
            dependency: [], lib: { local: 'lib', data: [] }
        }
        writeFileSync(path.join(dir, 'slang.json'), JSON.stringify(cfg))
        expect(project_config(dir)).toEqual(cfg)
    })
})
