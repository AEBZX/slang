//系统测试:真实源码编译成 .sbin,交给 vm.exe 跑,行为要对得上
import {describe, expect, it} from 'vitest'
import {execFileSync} from 'node:child_process'
import {writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {bin_of} from '../unit/helper-ir'

const vm_exe = resolve(__dirname, '../../..', 'vm/cmake-build-debug/vm.exe')

//vm.exe 跑完退出码 0;程序里的 vm("in","shell",[oper:"output",...]) 是唯一的可观察输出
const run_vm = (src: string): {out: string, status: number} => {
    const file = join(tmpdir(), `slang-vmrun-${process.pid}.sbin`)
    writeFileSync(file, bin_of(src, file))
    try {
        const out = execFileSync(vm_exe, [file], {timeout: 15000, encoding: 'utf8'})
        return {out: out.replace(/\r\n/g, '\n'), status: 0}
    } catch (e: any) {
        return {out: (e.stdout ?? '').toString().replace(/\r\n/g, '\n'), status: e.status ?? -1}
    }
}

const M = (body: string) => `public m:module{ public static main:number(){ ${body} } }`

describe('system/vm 联合', () => {
    it('纯循环算术跑到底', () => {
        const r = run_vm(M(`
            var s:number=0; var i:number=1;
            while(i<=10){ s=s+i; i=i+1; }
            vm("in","shell",[oper:"output",id:0,data:"done-loop"]);
            return s;`))
        expect(r.status).toBe(0)
        expect(r.out).toContain('done-loop')
    })

    it('函数调用跑到底', () => {
        const r = run_vm(`
            public m:module{
                public static g:number(x:number){ return x*2; }
                public static main:number(){ var v:number=g(4)+1; vm("in","shell",[oper:"output",id:0,data:"done-call"]); return v; }
            }`)
        expect(r.status).toBe(0)
        expect(r.out).toContain('done-call')
    })

    it('递归跑到底', () => {
        const r = run_vm(`
            public m:module{
                public static g:number(n:number){ if(n<=1)return 1; return n*g(n-1); }
                public static main:number(){ var v:number=g(5); vm("in","shell",[oper:"output",id:0,data:"done-recur"]); return v; }
            }`)
        expect(r.status).toBe(0)
        expect(r.out).toContain('done-recur')
    })

    it('数组跑到底', () => {
        const r = run_vm(M(`
            var d:number[]=[1,2,3]; d[0]=4; var v:number=d[1]+d[0];
            vm("in","shell",[oper:"output",id:0,data:"done-array"]);
            return v;`))
        expect(r.status).toBe(0)
        expect(r.out).toContain('done-array')
    })

    it('坏文件解码失败要非 0 退出', () => {
        const file = join(tmpdir(), `slang-vmrun-bad-${process.pid}.sbin`)
        writeFileSync(file, 'not-a-sbin')
        let status = 0
        try {
            execFileSync(vm_exe, [file], {timeout: 15000})
        } catch (e: any) {
            status = e.status ?? -1
        }
        expect(status).not.toBe(0)
    })
})
