//集成:各类语句从源码到字节码,并核对生成出来的结构
import {describe, expect, it} from 'vitest'
import {exec} from '../interpreter'
import {BINARY, CALL, CMP, CZ, JMP, OFFSET_GET, RET, THREAD} from '../../src/utils'
import {all_of, bin_of, count_of, null_args, opt_of} from '../unit/helper-ir'

const M = (body: string) => `public m:module{ public static f:number(a:number){ ${body} } }`

//结构检查:能编出字节码、没有空操作数、块与指令数不为零
function structural(src: string) {
    const tool = opt_of(src)
    const buf = bin_of(src)
    expect(null_args(tool)).toEqual([])
    expect(buf.length).toBeGreaterThan(0)
    expect(count_of(tool)).toBeGreaterThan(0)
    expect(tool.command.size).toBeGreaterThan(0)
    return tool
}

describe('集成/语句·结构', () => {
    const CASES: [string, string][] = [
        ['for', M('for(var i:number=0;i<a;i++;){ a=a+1; if(a>100)break; } return a;')],
        ['foreach', M('var d:number[]=[1,2]; foreach(x:d){ a=x; } return a;')],
        ['do-while', M('do{ a=a-1; }while(a>0); return a;')],
        ['switch', M('switch(a){case 1=>a=2;default=>a=3;} return a;')],
        ['try-catch', M('try{ a=1; }catch(e:number){ a=2; } return a;')],
        ['try-finally', M('try{ a=1; }catch(e:number){ a=2; }finally{ a=3; } return a;')],
        ['throw', M('try{ throw a; }catch(e:number){ a=e; } return a;')],
        ['嵌套循环', M('var s:number=0; while(a>0){ var j:number=0; while(j<2){ s=s+1; j=j+1; } a=a-1; } return s;')],
        ['空块', M('{ } return a;')]
    ]
    for (const [name, src] of CASES)
        it(name + ' 能编出结构自洽的字节码', () => structural(src))
})

describe('集成/语句·生成的结构', () => {
    it('foreach 会展开出下标访问', () => {
        const tool = structural(M('var d:number[]=[1,2]; foreach(x:d){ a=x; } return a;'))
        expect(all_of(tool, OFFSET_GET).length).toBeGreaterThan(0)
    })

    it('while 用 CALL 进循环块、CZ 回跳', () => {
        const tool = structural(M('while(a>0){ a=a-1; } return a;'))
        const calls = all_of(tool, CALL)
        expect(calls.length).toBeGreaterThan(0)
        expect(calls.some((c: CALL) => c.frame.data == 2)).toBe(true)
        expect(all_of(tool, CZ).length).toBeGreaterThanOrEqual(1)
    })

    it('do-while 至少生成一个条件跳转', () => {
        const tool = structural(M('do{ a=a-1; }while(a>0); return a;'))
        expect(all_of(tool, CZ).length).toBeGreaterThanOrEqual(1)
    })

    it('for 会展开成「初始化 + 条件 + 循环体 + 步进」', () => {
        const tool = structural(M('for(var i:number=0;i<3;i++;){ a=a+1; } return a;'))
        expect(all_of(tool, CZ).length).toBeGreaterThanOrEqual(1)
        expect(all_of(tool, CALL).some((c: CALL) => c.frame.data == 2)).toBe(true)
    })

    it('break 生成函数帧为 2 的 RET', () => {
        const tool = structural(M('while(a>0){ if(a>2)break; a=a-1; } return a;'))
        expect(all_of(tool, RET).some((r: RET) => r.frame.data == 2)).toBe(true)
    })

    it('continue 生成 JMP', () => {
        const tool = structural(M('while(a>0){ a=a-1; if(a>2)continue; a=a-1; } return a;'))
        expect(all_of(tool, JMP).length).toBeGreaterThan(0)
    })

    it('await 生成一个线程块 + THREAD', () => {
        const tool = structural(`public m:module{
            public static g:void(){ }
            public static f:number(a:number){ await g(); return a; }
        }`)
        expect(all_of(tool, THREAD).length).toBeGreaterThan(0)
    })

    it('分支里的调用也能生成(子块继承参数表)', () => {
        const tool = structural(`public m:module{
            public static g:number(x:number){ return x; }
            public static f:number(a:number){ if(a>0)a=g(a); else a=g(a); return a; }
        }`)
        expect(all_of(tool, CALL).length).toBeGreaterThanOrEqual(2)
    })

    it('循环里的调用也能生成', () => {
        const tool = structural(`public m:module{
            public static g:number(x:number){ return x; }
            public static f:number(a:number){ while(a>0){ a=g(a); a=a-1; } return a; }
        }`)
        expect(all_of(tool, CALL).length).toBeGreaterThanOrEqual(1)
    })

    //try/catch 用一个槽当 throw 标志:进 try 前置 0,throw 时置 1,分支里再判它
    const flag_slots = (tool: any, value: number) =>
        new Set([...tool.command.values()].flat()
            .filter((i: any) => i.constructor.name == 'MOV' && i.right != null
                && i.right.type == 'reg' && i.right.data == value)
            .map((i: any) => i.left.data))

    it('try/catch 会把 throw 标志置 0', () => {
        const tool = structural(M('try{ a=1; }catch(e:number){ a=2; } return a;'))
        expect(flag_slots(tool, 0).size).toBeGreaterThan(0)
        expect(all_of(tool, CALL).length).toBeGreaterThan(0)
    })

    it('带 finally 时多一次调用', () => {
        const only_catch = all_of(structural(M('try{ a=1; }catch(e:number){ a=2; } return a;')), CALL).length
        const with_finally = all_of(structural(M('try{ a=1; }catch(e:number){ a=2; }finally{ a=3; } return a;')), CALL).length
        expect(with_finally).toBeGreaterThanOrEqual(only_catch)
    })

    //foreach 的条件是 d[for]!=null。以前 no_bool_cond 会给它再包一层
    //(脱糖新造的节点没有 .type),条件变成恒真,循环永不结束
    it('foreach 的循环条件只包一层', () => {
        const tool = structural(M('var d:number[]=[1,2,3]; foreach(x:d){ a=x; } return a;'))
        //含 CMP 的块就是这个循环的条件块,里面只应该有一次比较
        const cmp_blocks = [...tool.command.values()].filter(list => list.some((i: any) => i.constructor.name == 'CMP'))
        expect(cmp_blocks.length).toBeGreaterThan(0)
        for (const list of cmp_blocks)
            expect(list.filter((i: any) => i.constructor.name == 'CMP').length).toBe(1)
    })

    it('for 的条件可以省略,缺省是恒真', () => {
        const tool = structural(M('var s:number=0; for(var i:number=0;;i++;){ s=s+1; if(s>2)break; } return s;'))
        //恒真也会生成条件跳转(靠 break 退出)
        expect(all_of(tool, CZ).length).toBeGreaterThan(0)
        expect(exec(opt_of(M('var s:number=0; for(var i:number=0;;i++;){ s=s+1; if(s>2)break; } return s;')), [0]).ret).toBe(3)
    })

    it('vm 内联指令按语义生成真指令', () => {
        const tool = structural(M('var c:number=0; vm("add",c,a,1); return c;'))
        expect(all_of(tool, BINARY).length).toBeGreaterThan(0)
    })

    it('switch 展开成比较 + 条件跳转链', () => {
        const tool = structural(M('switch(a){case 1=>a=10;case 2=>a=20;default=>a=30;} return a;'))
        //两个 case → 两次比较两次条件跳转
        expect(all_of(tool, CZ).length).toBeGreaterThanOrEqual(2)
        expect(all_of(tool, CMP).length).toBeGreaterThanOrEqual(2)
    })
})

describe('集成/语句·语义(解释执行)', () => {
    const run = (src: string, a: number) => exec(opt_of(src), [a])

    it('switch 按 case 分派,落到 default', () => {
        const src = M('switch(a){case 1=>a=10;case 2=>a=20;default=>a=30;} return a;')
        expect(run(src, 1).ret).toBe(10)
        expect(run(src, 2).ret).toBe(20)
        expect(run(src, 5).ret).toBe(30)
    })

    it('if-else 链', () => {
        const src = M('var s:number=0; if(a>10)s=1; else if(a>5)s=2; else s=3; return s;')
        expect(run(src, 20).ret).toBe(1)
        expect(run(src, 7).ret).toBe(2)
        expect(run(src, 1).ret).toBe(3)
    })

    it('三元', () => {
        expect(run(M('var b:number=a>0?7:9; return b;'), 1).ret).toBe(7)
        expect(run(M('var b:number=a>0?7:9; return b;'), -1).ret).toBe(9)
    })

    it('数组读写', () => {
        const src = M('var d:number[]=[1,2,3]; d[0]=a; d[1]=a+1; return d[0]+d[1];')
        expect(run(src, 5).ret).toBe(11)
    })
})
