import { describe, expect, it } from 'vitest'
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import * as path from 'path'
import { spawnSync } from 'child_process'
import compile from '../../index'

//随机程序差分 fuzz:随机生成有界小程序(变量/赋值/算术/if/while/数组),
//要求 O0/O1/O2 输出完全一致且进程正常退出(exit 0)。
//任何一级优化改变语义 → 失败。参考 LLVM 的 -O0/-O3 差分理念。

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
    const dir = mkdtempSync(path.join(tmpdir(), 'slang-fuzz-'))
    const outFile = path.join(dir, 'vm-out.txt')
    try {
        writeFileSync(path.join(dir, 'main.sl'), code)
        let BIN: number[][], POOL: Map<number, number | string>
        try {
            ({ BIN, POOL } = compile([code], optimize))
        } catch (e: any) {
            return { stdout: 'COMPILE_ERR: ' + (e?.message || e), status: -1 }
        }
        writeFileSync(path.join(dir, 'out.sbin'), to_sbin(BIN, POOL))
        const outFd = openSync(outFile, 'w')
        let r: ReturnType<typeof spawnSync>
        try {
            r = spawnSync(find_vm(), ['run', path.join(dir, 'out.sbin')], {
                timeout: 15000, stdio: ['ignore', outFd, outFd]
            })
        } finally { closeSync(outFd) }
        return { stdout: existsSync(outFile) ? readFileSync(outFile, 'utf-8').replace(/\r\n/g, '\n') : '', status: r.status }
    } finally { rmSync(dir, { recursive: true, force: true }) }
}

let seed = 0x9E3779B9
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))

//变量池:编号 v0..vN-1,避免重名
function genStmt(vars: string[], depth: number, out: string[]): void {
    const pickVar = () => vars[ri(0, vars.length - 1)]
    const genExpr = (d: number): string => {
        if (d <= 0 || rnd() < 0.35) return rnd() < 0.5 ? String(ri(0, 10)) : pickVar()
        const ops = ['+', '-', '*', '/', '%']
        const op = ops[ri(0, ops.length - 1)]
        //除/模:右操作数强制非零,避免除零(VM 已保护,但聚焦语义而非崩溃)
        const r = op == '/' || op == '%' ? String(ri(1, 10)) : genExpr(d - 1)
        return `(${genExpr(d - 1)} ${op} ${r})`
    }
    const kind = ri(0, 8)
    const v = pickVar()
    if (kind <= 3) {
        //赋值
        out.push(`    ${v}=${genExpr(depth)};`)
    } else if (kind == 4) {
        //if/else
        const c = `${v} ${ri(0, 1) == 0 ? '>' : '<'} ${ri(0, 10)}`
        out.push(`    if(${c}){`)
        genStmt(vars, depth - 1, out)
        out.push(`    }else{`)
        genStmt(vars, depth - 1, out)
        out.push(`    }`)
    } else if (kind == 5) {
        //while:专用计数器(随机语句可能重置随机变量 v → 死循环);
        //计数器不在 vars 池里,体里不会碰它,保证终止
        const cv = 'c' + out.length
        const lim = ri(1, 8)
        out.push(`    var ${cv}:number=0;`)
        out.push(`    while(${cv} < ${lim}){`)
        out.push(`        ${cv}=${cv}+1;`)
        genStmt(vars, Math.max(0, depth - 1), out)
        out.push(`    }`)
    } else if (kind == 6) {
        //for(固定范围;循环变量唯一命名,避免嵌套重名触发 check 报错)
        const fv = 'f' + out.length
        const lim = ri(1, 5)
        out.push(`    for(var ${fv}:number=0;${fv}<${lim};${fv}=${fv}+1){`)
        out.push(`        ${v}=${v}+${fv};`)
        out.push(`    }`)
    } else if (kind == 7) {
        //数组写读
        out.push(`    arr[${ri(0, 3)}]=${genExpr(depth)};`)
    } else {
        //输出一个值(差分锚点:所有级别必须一致);idx 先固定,否则 out.length 在两次 push 间变化,
        //var 声明名与 vm 引用名差 1 → "vm 指令引用了未定义变量"
        const idx = out.length
        out.push(`    if(${v} > -999999){`)
        out.push(`        var o${idx}:string{} = [type:"print", data:"P"];`)
        out.push(`        vm 'out %port %o${idx}';`)
        out.push(`    }`)
    }
}
function genProgram(): string {
    const nv = ri(2, 4)
    const vars: string[] = []
    let decl = 'public static main:void(){\n    var port:string="shell";\n'
    for (let i = 0; i < nv; i++) {
        const name = 'v' + i
        vars.push(name)
        decl += `    var ${name}:number=${ri(0, 5)};\n`
    }
    decl += '    var arr:number[]=[1,2,3,4];\n'
    const out: string[] = []
    genStmt(vars, 3, out)
    return decl + out.join('\n') + '\n    p(0);\n}\npublic p:void(m:number){\n    var port:string="shell";\n    var o:string{} = [type:"print", data:"E"];\n    vm \'out %port %o\';\n}'
}

describe('随机程序差分 fuzz(O0/O1/O2 语义一致)', { timeout: 600000 }, () => {
    it('40 个随机程序 × 3 级优化:输出一致且正常退出', () => {
        for (let i = 0; i < 40; i++) {
            const code = genProgram()
            const rs = [0, 1, 2].map(l => run_vm(code, l))
            for (const r of rs)
                expect(r.status, `program #${i} level crashed: ${JSON.stringify(r)}\ncode:\n${code}`).toBe(0)
            const outs = rs.map(r => r.stdout)
            expect(new Set(outs).size, `program #${i} level outputs differ:\n${code}\n`).toBe(1)
        }
    })
})
