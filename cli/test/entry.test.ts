//cli 命令注册测试:验证每个子命令、选项、位置参数都已正确配置
//commander 15 不支持空格命令名,多词命令拆为父命令+子命令(如 publish module)
import { describe, expect, it } from 'vitest'
import type { Command } from 'commander'
import { build_command } from '../entry.ts'

const c = build_command()

//按路径递归查找命令:find('publish vm') 匹配 publish 下的 vm
function find(name: string): Command {
    const parts = name.split(' ')
    let cur: Command = c
    for (const p of parts) {
        const next = cur.commands.find(i => i.name() == p)
        expect(next, `命令 ${name} 应已注册`).toBeTruthy()
        cur = next!
    }
    return cur
}

describe('命令注册', () => {
    it('注册了所有顶层命令', () => {
        const names = c.commands.map(i => i.name())
        for (const n of ['init', 'compiler', 'run', 'go', 'install', 'uninstall',
            'publish', 'create', 'config', 'register'])
            expect(names).toContain(n)
    })
    it('publish 下有 module/vm/compiler 子命令', () => {
        const names = find('publish').commands.map(i => i.name())
        expect(names).toEqual(expect.arrayContaining(['module', 'vm', 'compiler']))
    })
    it('create 下有 compiler 子命令', () => {
        expect(find('create').commands.map(i => i.name())).toContain('compiler')
    })
    it('config 下有 set/verify 子命令', () => {
        expect(find('config').commands.map(i => i.name())).toEqual(expect.arrayContaining(['set', 'verify']))
    })
})

describe('install 命令', () => {
    it('有 --name 和 --version 选项', () => {
        const opts = find('install').options.map(o => o.attributeName())
        expect(opts).toContain('name')
        expect(opts).toContain('version')
    })
})

describe('uninstall 命令', () => {
    it('有位置参数 <name>', () => {
        const args = find('uninstall').registeredArguments.map(a => a.name())
        expect(args).toContain('name')
    })
})

describe('publish vm 命令', () => {
    it('有 path/license/isa/version 四个选项', () => {
        const opts = find('publish vm').options.map(o => o.attributeName())
        for (const o of ['path', 'license', 'isa', 'version'])
            expect(opts).toContain(o)
    })
})

describe('create compiler 命令', () => {
    it('有 license 和 version 选项', () => {
        const opts = find('create compiler').options.map(o => o.attributeName())
        expect(opts).toContain('license')
        expect(opts).toContain('version')
    })
})

describe('publish compiler 命令', () => {
    it('有 path/large/small 三个选项', () => {
        const opts = find('publish compiler').options.map(o => o.attributeName())
        for (const o of ['path', 'large', 'small'])
            expect(opts).toContain(o)
    })
})

describe('config set 命令', () => {
    it('有 key 和 value 位置参数', () => {
        const args = find('config set').registeredArguments.map(a => a.name())
        expect(args).toContain('key')
        expect(args).toContain('value')
    })
})

describe('register 命令', () => {
    it('有 username 和 email 选项(不再有 password)', () => {
        const opts = find('register').options.map(o => o.attributeName())
        expect(opts).toContain('username')
        expect(opts).toContain('email')
        expect(opts).not.toContain('password')
    })
})

describe('无参命令', () => {
    it('init/compiler/run/go/config verify/publish module 无位置参数', () => {
        for (const n of ['init', 'compiler', 'run', 'go', 'config verify', 'publish module']) {
            expect(find(n).registeredArguments.length, `${n} 不应有位置参数`).toBe(0)
        }
    })
})
