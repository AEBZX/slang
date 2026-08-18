import { describe, expect, it } from 'vitest'
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import * as path from 'path'
import { spawnSync } from 'child_process'
import compile from '../../index'

//compiler-vm 端到端系统测试:slang 源码 → compiler(lexer/parser/check/desugar/hir/ir/optimize)
//→ .sbin → vm.exe(runtime) 运行 → 断言 stdout,验证 VM 运行符合预期
//运行前提:vm/cmake-build-debug 下已构建 vm.exe(见 vm/CMakeLists.txt),可用 SLANG_VM 覆盖路径

//定位 vm.exe
function find_vm(): string {
    if (process.env.SLANG_VM && existsSync(process.env.SLANG_VM))
        return process.env.SLANG_VM
    const root = path.resolve(__dirname, '../../..')
    const candidates = [
        path.join(root, 'vm', 'cmake-build-debug', 'vm.exe'),
        path.join(root, 'vm', 'build', 'vm.exe'),
        path.join(root, 'vm', 'cmake-build-release', 'vm.exe')
    ]
    for (const c of candidates)
        if (existsSync(c)) return c
    throw new Error('未找到 vm.exe,请先构建 VM(见 vm/CMakeLists.txt)或设置环境变量 SLANG_VM')
}

//sbin 序列化(与 cli/command.ts 一致):POOL_START [id u32 type u8 len u32 data]* POOL_END CODE_START [op u8 a b c u32]* CODE_END
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

//编译 slang 源码为 sbin,再用 vm.exe 运行,返回 stdout/stderr/status
//输出经普通文件重定向(沙箱下 spawn 管道 EPERM,文件 fd 不受限)
function run_vm(code: string, optimize: number): { stdout: string, stderr: string, status: number | null } {
    const dir = mkdtempSync(path.join(tmpdir(), 'slang-vm-'))
    const outFile = path.join(dir, 'vm-out.txt')
    const errFile = path.join(dir, 'vm-err.txt')
    try {
        writeFileSync(path.join(dir, 'main.sl'), code)
        const { BIN, POOL } = compile([code], optimize)
        const sbin = path.join(dir, 'out.sbin')
        writeFileSync(sbin, to_sbin(BIN, POOL))
        const vm = find_vm()
        const outFd = openSync(outFile, 'w')
        const errFd = openSync(errFile, 'w')
        let r: ReturnType<typeof spawnSync>
        try {
            r = spawnSync(vm, ['run', sbin], {
                timeout: 30000,
                stdio: ['ignore', outFd, errFd]
            })
        } finally {
            closeSync(outFd)
            closeSync(errFd)
        }
        return {
            stdout: existsSync(outFile) ? readFileSync(outFile, 'utf-8') : '',
            stderr: existsSync(errFile) ? readFileSync(errFile, 'utf-8') : '',
            status: r.status
        }
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
}

//shell print 语句:o.type='print',o.data=字符串;每次生成唯一变量名避免重名
let print_seq = 0
const print_ = (data: string) => {
    const name = 'o' + (print_seq++)
    return `var ${name}:string{} = [type:"print", data:"${data}"];\n    vm 'out %port %${name}';`
}
//数值断言辅助:expr 求值后与 want 比较,相等 print OK 否则 BAD
const expect_num = (expr: string, want: number | string) =>
    `if(${expr} == ${want}){\n        ${print_('OK')}\n    }else{\n        ${print_('BAD')}\n    }`

//按优化级别运行并断言:各级别输出一致且等于期望值
function expect_levels(code: string, want: string) {
    const rs = [0, 1, 2].map(l => run_vm(code, l))
    for (const r of rs) {
        if (r.status !== 0)
            throw new Error('vm run failed(status=' + r.status + '): ' + JSON.stringify(r))
        expect(r.stdout).toBe(want)
    }
    //各级别输出一致
    expect(new Set(rs.map(r => r.stdout)).size).toBe(1)
}

describe('compiler-vm 端到端', { timeout: 120000 }, () => {
    it('字符串字面量 print 输出', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    ${print_('hello')}
}\n`
        expect_levels(code, 'hello')
    })

    it('连续 print 保持顺序输出', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    ${print_('a')}
    ${print_('b')}
    ${print_('c')}
}\n`
        expect_levels(code, 'abc')
    })

    it('算术优先级:1+2*3-4 = 3', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var x:number = 1+2*3-4;
    ${expect_num('x', 3)}
}\n`
        expect_levels(code, 'OK')
    })

    it('变量声明与赋值链', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var x:number = 5;
    x = x * 2 + 1;
    ${expect_num('x', 11)}
}\n`
        expect_levels(code, 'OK')
    })

    it('if/else 分支:正数输出 pos', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var x:number = 7;
    if(x > 0){
        ${print_('pos')}
    }else{
        ${print_('neg')}
    }
}\n`
        expect_levels(code, 'pos')
    })

    it('if/else 分支:负数输出 neg', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var x:number = 0-3;
    if(x > 0){
        ${print_('pos')}
    }else{
        ${print_('neg')}
    }
}\n`
        expect_levels(code, 'neg')
    })

    it('while 循环:1..10 累加 = 55', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var i:number = 1;
    var sum:number = 0;
    while(i <= 10){
        sum = sum + i;
        i = i + 1;
    }
    ${expect_num('sum', 55)}
}\n`
        expect_levels(code, 'OK')
    })

    it('while 循环内 break 提前退出', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var i:number = 0;
    while(true){
        i = i + 1;
        if(i >= 3){break;}
    }
    ${expect_num('i', 3)}
}\n`
        expect_levels(code, 'OK')
    })

    it('for 循环(desugar 为 while)', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var sum:number = 0;
    for(var i:number = 0; i < 5; i++){
        sum = sum + i;
    }
    ${expect_num('sum', 10)}
}\n`
        expect_levels(code, 'OK')
    })

    it('foreach 遍历数组求和', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var arr:number[] = [1,2,3,4];
    var sum:number = 0;
    foreach(v:arr){
        sum = sum + v;
    }
    ${expect_num('sum', 10)}
}\n`
        expect_levels(code, 'OK')
    })

    it('函数调用 add(2,3) = 5', () => {
        const code = `public add:number(a:number,b:number){
    return a + b;
}
public static main:void(){
    var port:string = "shell";
    ${expect_num('add(2,3)', 5)}
}\n`
        expect_levels(code, 'OK')
    })

    it('递归 fact(5) = 120', () => {
        const code = `public fact:number(n:number){
    if(n <= 1){return 1;}
    return n * fact(n-1);
}
public static main:void(){
    var port:string = "shell";
    ${expect_num('fact(5)', 120)}
}\n`
        expect_levels(code, 'OK')
    })

    it('递归 fib(10) = 55(两处递归互不干扰)', () => {
        const code = `public fib:number(n:number){
    if(n <= 1){return n;}
    return fib(n-1) + fib(n-2);
}
public static main:void(){
    var port:string = "shell";
    ${expect_num('fib(10)', 55)}
}\n`
        expect_levels(code, 'OK')
    })

    it('递归+局部变量:callee 槽恢复(f(3)=19)', () => {
        const code = `public f:number(n:number){
    var x:number = n + 1;
    if(n <= 1){return 1;}
    return n * f(n-1) + x;
}
public static main:void(){
    var port:string = "shell";
    ${expect_num('f(3)', 19)}
}\n`
        expect_levels(code, 'OK')
    })

    it('字符串数组索引读取', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var arr:string[] = ["a","b","c"];
    if(arr[1] == "b"){
        ${print_('OK')}
    }else{
        ${print_('BAD')}
    }
}\n`
        expect_levels(code, 'OK')
    })

    it('数字数组索引读取与写入', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var arr:number[] = [10,20,30];
    arr[1] = arr[1] + 5;
    ${expect_num('arr[1]', 25)}
}\n`
        expect_levels(code, 'OK')
    })

    it('字符串比较 == 与 !=', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var s:string = "abc";
    if(s == "abc" && s != "xyz"){
        ${print_('OK')}
    }else{
        ${print_('BAD')}
    }
}\n`
        expect_levels(code, 'OK')
    })

    it('取反 not 与布尔运算', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var b:boolean = false;
    if(!b){
        ${print_('OK')}
    }else{
        ${print_('BAD')}
    }
}\n`
        expect_levels(code, 'OK')
    })

    it('多函数+静态入口:根块保留其他函数槽初始化', () => {
        const code = `public add:number(a:number,b:number){return a + b;}
public double:number(x:number){return x * 2;}
public static main:void(){
    var port:string = "shell";
    ${expect_num('add(1,2) + double(3)', 9)}
}\n`
        expect_levels(code, 'OK')
    })

    it('map 字面量读取成员', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var m:string{} = [name:"slang", ver:"1.0"];
    if(m["name"] == "slang"){
        ${print_('OK')}
    }else{
        ${print_('BAD')}
    }
}\n`
        expect_levels(code, 'OK')
    })

    it('嵌套块作用域变量', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var x:number = 1;
    {
        var y:number = 2;
        x = x + y;
    }
    ${expect_num('x', 3)}
}\n`
        expect_levels(code, 'OK')
    })

    it('switch 多分支(desugar 为 if 链)', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var x:number = 7;
    switch(x){
        case 1=>{${print_('one')}}
        case 7=>{${print_('seven')}}
        default=>{${print_('other')}}
    }
}\n`
        expect_levels(code, 'seven')
    })

    it('类:new 构造与成员方法调用', () => {
        const code = `public Counter:class{
    public constructor:void(){
        var c:number = 0;
    }
    public inc:number(){
        return 1;
    }
}
public static main:void(){
    var port:string = "shell";
    var c:Counter = new Counter();
    ${expect_num('c.inc()', 1)}
}\n`
        expect_levels(code, 'OK')
    })

    it('显式赋值计数(自增语句 i++ 暂不用于源码,见 desugar 层实现)', () => {
        const code = `public static main:void(){
    var port:string = "shell";
    var i:number = 0;
    i = i + 1;
    i = i + 1;
    i = i - 1;
    ${expect_num('i', 1)}
}\n`
        expect_levels(code, 'OK')
    })
})
