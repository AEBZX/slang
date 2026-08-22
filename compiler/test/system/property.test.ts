import { describe, expect, it } from 'vitest'
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import * as path from 'path'
import { spawnSync } from 'child_process'
import compile from '../../index'

//属性测试(property-based):随机生成表达式/程序,用 JS 参考实现求期望值,
//与 slang 编译运行结果对比,并在 O0/O1/O2 三级差分。固定种子保证可复现。
//参考 Rust proptest / LLVM 差分思路:编译器无法证明正确,但大量随机样本能快速暴露错误。

function find_vm(): string {
    if (process.env.SLANG_VM && existsSync(process.env.SLANG_VM)) return process.env.SLANG_VM
    const root = path.resolve(__dirname, '../../..')
    for (const c of [path.join(root, 'vm', 'cmake-build-debug', 'vm.exe'), path.join(root, 'vm', 'build', 'vm.exe')])
        if (existsSync(c)) return c
    throw new Error('未找到 vm.exe')
}
function to_sbin(BIN: number[][], POOL: Map<number, number | string>): Buffer {
    const write: Buffer[] = []
    write.push(Buffer.from('POOL_START', 'utf-8'))
    for (const [id, v] of POOL) {
        const type = typeof v == 'number' ? 1 : 0
        const data = typeof v == 'number' ? Buffer.alloc(8) : Buffer.from(v as string, 'utf8')
        if (typeof v == 'number') data.writeDoubleLE(v as number, 0)
        const head = Buffer.alloc(9)
        head.writeUInt32LE(id, 0)
        head.writeUInt8(type, 4)
        head.writeUInt32LE(data.length, 5)
        write.push(head, data)
    }
    write.push(Buffer.from('POOL_END', 'utf-8'))
    write.push(Buffer.from('CODE_START', 'utf-8'))
    for (const i of BIN) {
        const data = Buffer.alloc(13)
        data.writeUInt8(i[0], 0)
        data.writeUInt32LE(i[1], 1)
        data.writeUInt32LE(i[2], 5)
        data.writeUInt32LE(i[3], 9)
        write.push(data)
    }
    write.push(Buffer.from('CODE_END', 'utf-8'))
    return Buffer.concat(write)
}
function run_vm(code: string, optimize: number): { stdout: string, status: number | null } {
    const dir = mkdtempSync(path.join(tmpdir(), 'slang-prop-'))
    const outFile = path.join(dir, 'vm-out.txt')
    try {
        writeFileSync(path.join(dir, 'main.sl'), code)
        let BIN: number[][], POOL: Map<number, number | string>
        try {
            ({ BIN, POOL } = compile([code], optimize))
        } catch (e: any) {
            //compile 抛错(如 check 失败):返回明确错误,不裸崩
            return { stdout: '', status: -1 }
        }
        writeFileSync(path.join(dir, 'out.sbin'), to_sbin(BIN, POOL))
        const outFd = openSync(outFile, 'w')
        let r: ReturnType<typeof spawnSync>
        try {
            r = spawnSync(find_vm(), ['run', path.join(dir, 'out.sbin')], {
                timeout: 20000, stdio: ['ignore', outFd, outFd]
            })
        } finally { closeSync(outFd) }
        return { stdout: existsSync(outFile) ? readFileSync(outFile, 'utf-8').replace(/\r\n/g, '\n') : '', status: r.status }
    } finally { rmSync(dir, { recursive: true, force: true }) }
}
//每轮只断言一条:生成 var r=<expr>; if(r==<want>){print OK}else{print BAD},want 由 JS 参考实现给出
//返回 main 函数体(不含头部),由调用方组装,避免字符串替换 hack
let seq = 0
const probeBody = (expr: string, want: number | boolean, isBool = false) => {
    const w = want === true ? 'true' : want === false ? 'false' : String(want)
    const n = seq
    seq += 3
    return `    var r:${isBool ? 'boolean' : 'number'}=${expr};
    if(r == ${w}){
        var o${n}:string{} = [type:"print", data:"OK"];
        vm 'out %port %o${n}';
    }else{
        var o${n + 1}:string{} = [type:"print", data:"BAD"];
        vm 'out %port %o${n + 1}';
    }`
}
const wrapMain = (body: string, extraDecl = '') =>
    `public static main:void(){
    var port:string="shell";
${extraDecl}${body}
}`

//===== 确定性 PRNG(可复现,不依赖 Math.random) =====
let seed = 0x2F6E2B1
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))

//整数算术表达式:操作数 1..12,运算符 + - *(整数精确);/ % 构造整除/固定余数(保证整数结果)
function genIntExpr(depth: number): { slang: string, js: () => number } {
    if (depth <= 0 || rnd() < 0.3) {
        const n = ri(1, 12)
        return { slang: String(n), js: () => n }
    }
    const kind = ri(0, 5)
    if (kind == 3) {
        //除法:整除 (a*b)/b = a
        const a = ri(1, 12), b = ri(1, 12)
        return { slang: `(${a * b}/${b})`, js: () => a }
    }
    if (kind == 4) {
        //取模:余数固定 (a*b+c)%b = c
        const a = ri(1, 12), b = ri(2, 12), c = ri(0, b - 1)
        return { slang: `((${a * b}+${c})%${b})`, js: () => c }
    }
    const ops: [string, (a: number, b: number) => number][] = [
        ['+', (a, b) => a + b], ['-', (a, b) => a - b], ['*', (a, b) => a * b]
    ]
    const [op, fn] = ops[ri(0, ops.length - 1)]
    const l = genIntExpr(depth - 1), r = genIntExpr(depth - 1)
    return { slang: `(${l.slang} ${op} ${r.slang})`, js: () => fn(l.js(), r.js()) }
}
//布尔表达式:a,b 为固定变量,生成比较与 && || ! 组合
function genBoolExpr(depth: number, a: number, b: number): { slang: string, js: () => boolean } {
    if (depth <= 0 || rnd() < 0.35) {
        const cmps: [string, (x: number, y: number) => boolean][] = [
            ['==', (x, y) => x == y], ['!=', (x, y) => x != y], ['<', (x, y) => x < y],
            ['>', (x, y) => x > y], ['<=', (x, y) => x <= y], ['>=', (x, y) => x >= y]
        ]
        const [op, fn] = cmps[ri(0, cmps.length - 1)]
        const pick = (v: number) => (v == 0 ? a : v == 1 ? b : ri(0, 20))
        const x = pick(ri(0, 2)), y = pick(ri(0, 2))
        return { slang: `(${x} ${op} ${y})`, js: () => fn(x, y) }
    }
    if (rnd() < 0.3) {
        const inner = genBoolExpr(depth - 1, a, b)
        return { slang: `(!${inner.slang})`, js: () => !inner.js() }
    }
    const isAnd = rnd() < 0.5
    const l = genBoolExpr(depth - 1, a, b), r = genBoolExpr(depth - 1, a, b)
    return {
        slang: `(${l.slang} ${isAnd ? '&&' : '||'} ${r.slang})`,
        js: () => isAnd ? (l.js() && r.js()) : (l.js() || r.js())
    }
}

describe('属性测试:随机表达式 × JS 参考实现 × O0/O1/O2', { timeout: 600000 }, () => {
    it('随机整数算术表达式(60 样本)', () => {
        for (let i = 0; i < 60; i++) {
            const e = genIntExpr(3)
            const want = e.js()
            const code = wrapMain(probeBody(e.slang, want))
            for (const level of [0, 1, 2]) {
                const r = run_vm(code, level)
                expect(r.status, `sample #${i} expr=${e.slang} want=${want}`).toBe(0)
                expect(r.stdout).toBe('OK')
            }
        }
    })
    it('随机布尔/比较/短路表达式(60 样本)', () => {
        for (let i = 0; i < 60; i++) {
            const a = ri(0, 20), b = ri(0, 20)
            const e = genBoolExpr(3, a, b)
            const want = e.js()
            const code = wrapMain(probeBody(e.slang, want, true), `    var a:number=${a};\n    var b:number=${b};\n`)
            for (const level of [0, 1, 2]) {
                const r = run_vm(code, level)
                if (r.status !== 0 || r.stdout !== 'OK')
                    console.log(`FAIL bool#${i} expr=${e.slang} a=${a} b=${b} want=${want} level=${level} status=${r.status} out=${JSON.stringify(r.stdout)}`)
                expect(r.status, `bool #${i} expr=${e.slang} a=${a} b=${b}`).toBe(0)
                expect(r.stdout).toBe('OK')
            }
        }
    })
})
