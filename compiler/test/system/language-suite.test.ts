import { describe, expect, it } from 'vitest'
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import * as path from 'path'
import { spawnSync } from 'child_process'
import compile from '../../index'

//语言一致性套件:黄金程序(golden programs)在 O0/O1/O2 三级差分验证。
//方法论参考 C/LLVM 的 -O0 vs -O3 差分测试:同一源码各级别输出必须一致且等于期望,
//同时作为已修复 bug 的回归测试(常量折叠跨调用、continue 目标栈、str_get 字符串索引等)。
//运行前提:vm/cmake-build-debug 下已构建 vm.exe(可用 SLANG_VM 覆盖)

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
    throw new Error('未找到 vm.exe,请先构建 VM(见 vm/CMakeLists.txt)或设置 SLANG_VM')
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

//多文件支持:files=[{name,code}...],main 在最后;与 cli 的 walk 行为一致(按文件名顺序)
function run_vm(files: { name: string, code: string }[], optimize: number): { stdout: string, stderr: string, status: number | null } {
    const dir = mkdtempSync(path.join(tmpdir(), 'slang-suite-'))
    const outFile = path.join(dir, 'vm-out.txt')
    const errFile = path.join(dir, 'vm-err.txt')
    try {
        for (const f of files)
            writeFileSync(path.join(dir, f.name), f.code)
        const { BIN, POOL } = compile(files.map(f => f.code), optimize, false, files.map(f => f.name))
        const sbin = path.join(dir, 'out.sbin')
        writeFileSync(sbin, to_sbin(BIN, POOL))
        const vm = find_vm()
        const outFd = openSync(outFile, 'w')
        const errFd = openSync(errFile, 'w')
        let r: ReturnType<typeof spawnSync>
        try {
            r = spawnSync(vm, ['run', sbin], { timeout: 60000, stdio: ['ignore', outFd, errFd] })
        } finally {
            closeSync(outFd)
            closeSync(errFd)
        }
        return {
            stdout: existsSync(outFile) ? readFileSync(outFile, 'utf-8').replace(/\r\n/g, '\n') : '',
            stderr: existsSync(errFile) ? readFileSync(errFile, 'utf-8') : '',
            status: r.status
        }
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
}

let print_seq = 0
const print_ = (data: string) => {
    const name = 'o' + (print_seq++)
    return `var ${name}:string{} = [type:"print", data:"${data}"];\n    vm 'out %port %${name}';`
}
const expect_num = (expr: string, want: number | string) =>
    `if(${expr} == ${want}){\n        ${print_('OK')}\n    }else{\n        ${print_('BAD')}\n    }`

const CHECK = (name: string) => `public chk_${name}:void(v:boolean){if(v){${print_('OK')}}else{${print_('BAD')}}}`

function expect_levels(files: { name: string, code: string }[], want: string) {
    const rs = [0, 1, 2].map(l => run_vm(files, l))
    for (const r of rs) {
        if (r.status !== 0)
            throw new Error('vm run failed(status=' + r.status + '): stdout=' + JSON.stringify(r.stdout) + ' stderr=' + JSON.stringify(r.stderr))
        expect(r.stdout).toBe(want)
    }
    expect(new Set(rs.map(r => r.stdout)).size).toBe(1)
}

describe('语言一致性套件(黄金程序 × O0/O1/O2 差分)', { timeout: 600000 }, () => {
    //===== 已修复 bug 回归 =====
    it('回归:数组被函数原地修改后,字面量折叠不得跨调用(常量折叠 mem_state)', () => {
        //此前 O2 把 arr[0]==99 按字面量 [1,2,3] 折叠成恒假 → BAD;必须各级一致 OK
        const code = `public static main:void(){
    var port:string="shell";
    var arr:number[]=[1,2,3];
    set0(arr,99);
    ${expect_num('arr[0]', 99)}
    ${expect_num('arr[2]', 3)}
    ${print_('done')}
}
public set0:void(a:number[],v:number){a[0]=v;}
`
        expect_levels([{ name: 'main.sl', code }], 'OKOKdone')
    })

    it('回归:冒泡排序跨文件调用后数组读取正确(O2 不按初始字面量折叠)', () => {
        const lib = `public bubble:void(a:number[],n:number){
    var i:number=0;
    while(i<n){
        var j:number=0;
        while(j<n-1-i){
            if(a[j]>a[j+1]){
                var t:number=a[j];
                a[j]=a[j+1];
                a[j+1]=t;
            }
            j=j+1;
        }
        i=i+1;
    }
}`
        const main = `public static main:void(){
    var port:string="shell";
    var arr:number[]=[3,1,4,1,5,9,2,6];
    bubble(arr,8);
    ${expect_num('arr[0]', 1)}
    ${expect_num('arr[1]', 1)}
    ${expect_num('arr[7]', 9)}
    ${print_('done')}
}`
        expect_levels([{ name: 'lib.sl', code: lib }, { name: 'main.sl', code: main }], 'OKOKOKdone')
    })

    it('回归:foreach 循环体内调用函数,continue 目标不被表达式 cache 吞掉', () => {
        //此前 continue 的目标块 id 放共享 cache,循环体内语句级调用 pop 走 → jmp undefined 死循环
        const code = `public static main:void(){
    var port:string="shell";
    var arr:number[]=[1,2,3];
    var n:number=0;
    foreach(v:arr){
        n=n+1;
        if(v==2){${print_('two')}}
    }
    ${expect_num('n', 3)}
    ${print_('done')}
}`
        expect_levels([{ name: 'main.sl', code }], 'twoOKdone')
    })

    it('回归:字符串索引 s[i] 返回字符(str_get 独立操作码)', () => {
        const code = `public static main:void(){
    var port:string="shell";
    var s:string="hello";
    ${expect_num('s[0]', '"h"')}
    ${expect_num('s[1]', '"e"')}
    ${expect_num('s[4]', '"o"')}
    ${print_('done')}
}`
        expect_levels([{ name: 'main.sl', code }], 'OKOKOKdone')
    })

    it('回归:foreach 遍历字符串,元素为字符', () => {
        const code = `public static main:void(){
    var port:string="shell";
    var s:string="hello";
    var n:number=0;
    var has_l:boolean=false;
    foreach(ch:s){
        n=n+1;
        if(ch=="l"){has_l=true;}
    }
    ${expect_num('n', 5)}
    if(has_l){${print_('OK')}}else{${print_('BAD')}}
    ${print_('done')}
}`
        expect_levels([{ name: 'main.sl', code }], 'OKOKdone')
    })

    it('回归:while 循环内 return 提前退出函数(RETN 只弹函数帧)', () => {
        const code = `public static main:void(){
    var port:string="shell";
    ${expect_num('is_prime(15)', 'false')}
    ${expect_num('is_prime(17)', 'true')}
    ${print_('done')}
}
public is_prime:boolean(n:number){
    if(n<2){return false;}
    var i:number=2;
    while(i*i<=n){
        if(n%i==0){return false;}
        i=i+1;
    }
    return true;
}`
        expect_levels([{ name: 'main.sl', code }], 'OKOKdone')
    })

    //===== 控制流组合 =====
    it('嵌套循环 + break/continue 组合', () => {
        const code = `public static main:void(){
    var port:string="shell";
    var s:number=0;
    for(var i:number=0;i<5;i=i+1){
        if(i==2){continue;}
        for(var j:number=0;j<5;j=j+1){
            if(j==3){break;}
            s=s+i*10+j;
        }
    }
    ${expect_num('s', 252)}
    ${print_('done')}
}`
        //i=0: 0+1+2=3; i=1: 10+11+12=33; i=2 continue(step 使 i=3); i=3: 30+31+32=93; i=4: 40+41+42=123
        //3+33+93+123=252;回归:for 的 continue 曾跳过 step 死循环
        expect_levels([{ name: 'main.sl', code }], 'OKdone')
    })

    it('短路 && / || 与取反', () => {
        const code = `public static main:void(){
    var port:string="shell";
    var a:number=3;
    if(a>1 && a<5){${print_('OK')}}else{${print_('BAD')}}
    if(a>5 || a==3){${print_('OK')}}else{${print_('BAD')}}
    if(!(a==4)){${print_('OK')}}else{${print_('BAD')}}
    if((a>1 && a>5) || a==3){${print_('OK')}}else{${print_('BAD')}}
    ${print_('done')}
}`
        expect_levels([{ name: 'main.sl', code }], 'OKOKOKOKdone')
    })

    it('switch 多分支 + default', () => {
        const code = `public static main:void(){
    var port:string="shell";
    var r:number=0;
    switch(7){
        case 1=>{r=100;}
        case 7=>{r=200;}
        default=>{r=300;}
    }
    switch(9){
        case 1=>{r=400;}
        default=>{r=500;}
    }
    ${expect_num('r', 500)}
    ${print_('done')}
}`
        expect_levels([{ name: 'main.sl', code }], 'OKdone')
    })

    //===== 数据结构 =====
    it('类:构造/成员变量/实例方法/多个实例互不干扰', () => {
        const code = `public static main:void(){
    var port:string="shell";
    var a:Item=new Item("apple",5);
    var b:Item=new Item("banana",3);
    ${expect_num('a.get_name()', '"apple"')}
    ${expect_num('a.get_price()', '5')}
    ${expect_num('b.get_price()', '3')}
    ${expect_num('a.discount(2)', '10')}
    ${expect_num('b.discount(3)', '9')}
    ${print_('done')}
}
public Item:class{
    public name:var:string;
    public price:var:number;
    public constructor:void(n:string,p:number){
        this.name=n;
        this.price=p;
    }
    public get_name:string(){return this.name;}
    public get_price:number(){return this.price;}
    public discount:number(rate:number){return this.price*rate;}
}`
        expect_levels([{ name: 'main.sl', code }], 'OKOKOKOKOKdone')
    })

    it('map 读写 + 键值更新', () => {
        const code = `public static main:void(){
    var port:string="shell";
    var m:number{} = [a:1,b:2,c:3];
    ${expect_num('m["a"]', '1')}
    m["b"]=20;
    ${expect_num('m["b"]', '20')}
    ${expect_num('m["c"]', '3')}
    ${print_('done')}
}`
        expect_levels([{ name: 'main.sl', code }], 'OKOKOKdone')
    })

    it('深嵌套表达式(运算栈压力 + 除法)', () => {
        const code = `public static main:void(){
    var port:string="shell";
    ${expect_num('1+2*3-4/2+(5*(6-1))-3+((2+2)*2)-1', '34')}
    ${expect_num('100/5/2', '10')}
    ${print_('done')}
}`
        //1+6-2+25-3+8-1 = 34;100/5/2=10(除法回归:lexer 曾吞 '/' 导致除法不可解析)
        expect_levels([{ name: 'main.sl', code }], 'OKOKdone')
    })

    //===== 递归 + 多文件 =====
    it('递归 fib/fact 多文件 + 前向引用', () => {
        const lib = `public fib:number(n:number){
    if(n<=1){return n;}
    return fib(n-1)+fib(n-2);
}
public fact:number(n:number){
    if(n<=1){return 1;}
    return n*fact(n-1);
}`
        const main = `public static main:void(){
    var port:string="shell";
    ${expect_num('fib(10)', '55')}
    ${expect_num('fact(5)', '120')}
    ${print_('done')}
}`
        expect_levels([{ name: 'lib.sl', code: lib }, { name: 'main.sl', code: main }], 'OKOKdone')
    })

    it('map 作为参数传递 + 函数内修改(map 按引用)', () => {
        const code = `public static main:void(){
    var port:string="shell";
    var m:number{} = [x:1];
    bump(m);
    ${expect_num('m["x"]', '2')}
    ${print_('done')}
}
public bump:void(mm:number{}){mm["x"]=2;}`
        expect_levels([{ name: 'main.sl', code }], 'OKdone')
    })

    it('字符串与数字混合变量 + 字符串比较链', () => {
        const code = `public static main:void(){
    var port:string="shell";
    var s:string="abc";
    var t:string="abd";
    ${expect_num('s=="abc"', 'true')}
    ${expect_num('s!=t', 'true')}
    ${expect_num('s[2]', '"c"')}
    ${print_('done')}
}`
        expect_levels([{ name: 'main.sl', code }], 'OKOKOKdone')
    })

    //===== 特性矩阵补全(现代语言测试:特性 × 优化级别) =====
    it('三元表达式 ?:', () => {
        const code = `public static main:void(){
    var port:string="shell";
    var a:number=3;
    var b:number=a>2?a*2:a*3;
    var c:number=1>2?100:200;
    ${expect_num('b', 6)}
    ${expect_num('c', 200)}
    ${print_('done')}
}`
        expect_levels([{ name: 'main.sl', code }], 'OKOKdone')
    })

    it('位运算 & | ^ ~ << >>', () => {
        const code = `public static main:void(){
    var port:string="shell";
    ${expect_num('(6&3)', '2')}
    ${expect_num('(6|3)', '7')}
    ${expect_num('(6^3)', '5')}
    ${expect_num('(1<<4)', '16')}
    ${expect_num('(16>>2)', '4')}
    ${expect_num('(~0)', '-1')}
    ${print_('done')}
}`
        expect_levels([{ name: 'main.sl', code }], 'OKOKOKOKOKOKdone')
    })

    it('do-while 循环', () => {
        const code = `public static main:void(){
    var port:string="shell";
    var i:number=0;
    do{i=i+1;}while(i<3);
    ${expect_num('i', 3)}
    var j:number=5;
    do{j=j+1;}while(j<3);
    ${expect_num('j', 6)}
    ${print_('done')}
}`
        expect_levels([{ name: 'main.sl', code }], 'OKOKdone')
    })

    it('字符串边界:空字符串与转义', () => {
        const code = `public static main:void(){
    var port:string="shell";
    var e:string="";
    if(e==""){${print_('OK')}}else{${print_('BAD')}}
    ${expect_num('length_probe("")', '0')}
    ${expect_num('length_probe("ab")', '2')}
    ${print_('done')}
}
public length_probe:number(s:string){var n:number=0;foreach(c:s){n=n+1;}return n;}`
        expect_levels([{ name: 'main.sl', code }], 'OKOKOKdone')
    })

    it('浮点与负数取模(除法回归)', () => {
        const code = `public static main:void(){
    var port:string="shell";
    ${expect_num('(1/4)', '0.25')}
    ${expect_num('(10/4)', '2.5')}
    ${expect_num('(-7%3)', '-1')}
    ${expect_num('(7%-3)', '1')}
    ${print_('done')}
}`
        expect_levels([{ name: 'main.sl', code }], 'OKOKOKOKdone')
    })

    it('嵌套块:块内声明与使用', () => {
        const code = `public static main:void(){
    var port:string="shell";
    var x:number=1;
    if(true){
        var y:number=2;
        x=x+y;
    }
    ${expect_num('x', 3)}
    ${print_('done')}
}`
        expect_levels([{ name: 'main.sl', code }], 'OKdone')
    })
})
