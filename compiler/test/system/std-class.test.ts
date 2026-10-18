//系统测试:类 / 接口 / 枚举这条路。必须靠 test/std.ts 的 fixture 才能跑通
import {describe, expect, it} from 'vitest'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {readFileSync} from 'node:fs'
import compile from '../../src'
import {decode} from '../sbin'
import {STD_IFACE, STD_SOURCE} from '../std'
import {errors_of, parse, run_check} from '../unit/helper'

const local_of = (name: string) => join(tmpdir(), `slang-class-${name}-${process.pid}.sbin`)
//诊断收集与断言助手(模块级,各 describe 共用)
const errs = (sources: string[]) => errors_of(run_check(sources.map(s => parse(s))))
const has = (list: string[], s: string) => list.some(e => e.includes(s))
const build = (name: string, sources: string[]) => {
    const local = local_of(name)
    const ret: any = compile(sources, local)
    const buf = readFileSync(local)
    return {buf, bin: decode(buf), ret}
}

//类 + 字段 + 实例方法 + this + new
const CLASS = `public m:module{
    public C:class{
        public v:number;
        public toString:string(){ return "x"; }
        public get:number(){ return this.v; }
        public set:void(x:number){ this.v=x; }
        public twice:number(){ return this.v*2; }
    }
    public static f:number(a:number){
        var c:C=new C();
        c.set(a);
        return c.get()+c.twice();
    }
}`

//静态成员
const STATIC = `public m:module{
    public C:class{
        public static sv:number;
        public toString:string(){ return "x"; }
        public static get:number(){ return C.sv; }
    }
    public static f:number(a:number){
        C.sv=a;
        return C.get();
    }
}`

//接口 + 显式 implements
const IFACE = `public m:module{
    public D:class implements std.Countable{
        public n:number;
        public toString:string(){ return "x"; }
        public count:number(){ return this.n; }
    }
    public static f:number(a:number){
        var d:D=new D();
        d.n=a;
        return d.count();
    }
}`

//枚举
const ENUM = `public m:module{
    public E:enum{ A, B, C }
    public static f:number(a:number){
        var e:E=E.A;
        if(a>0)e=E.B;
        return 1;
    }
}`

describe('system/std+类·能编译并解码', () => {
    it('类 + 字段 + 实例方法 + this + new', () => {
        const {bin, buf} = build('class', [STD_SOURCE, CLASS])
        expect(buf.length).toBeGreaterThan(0)
        expect(bin.blocks.size).toBeGreaterThan(0)
        expect(bin.pool.size).toBeGreaterThan(0)
    }, 30000)

    it('静态成员', () => {
        const {bin} = build('static', [STD_SOURCE, STATIC])
        expect(bin.blocks.size).toBeGreaterThan(0)
    }, 30000)

    it('接口 + implements', () => {
        const {bin} = build('iface', [STD_IFACE, IFACE])
        expect(bin.blocks.size).toBeGreaterThan(0)
    }, 30000)

    it('枚举', () => {
        const {bin} = build('enum', [STD_SOURCE, ENUM])
        expect(bin.blocks.size).toBeGreaterThan(0)
    }, 30000)

    it('泛型类实例化:显式实参与推断都行', () => {
        const cls = `public C:class<T>{
            public v:@T;
            public toString:string(){ return "x"; }
            public get:@T(){ return this.v; }
        }`
        expect(errs([STD_SOURCE, `public m:module{ ${cls}
            public static f:number(a:number){ var c:C<number>=new C<number>(); c.v=a; return 1; } }`])).toEqual([])
        expect(errs([STD_SOURCE, `public m:module{ ${cls}
            public static f:number(a:number){ var c:C<number>=new C(); c.v=a; return 1; } }`])).toEqual([])
    }, 30000)

    it('泛型类不带泛型实参会报错', () => {
        const cls = `public C:class<T>{
            public v:@T;
            public toString:string(){ return "x"; }
        }`
        expect(has(errs([STD_SOURCE, `public m:module{ ${cls}
            public static f:number(a:number){ var c:C=new C(); return 1; } }`]), '泛型')).toBe(true)
    }, 30000)

    it('多个类程序两次编译一致', () => {
        for (const [name, src] of [['class', CLASS], ['static', STATIC], ['enum', ENUM]] as [string, string][])
            expect(build(name + '1', [STD_SOURCE, src]).buf.equals(build(name + '2', [STD_SOURCE, src]).buf), name).toBe(true)
    }, 30000)
})

//注意:公开 API 目前不会因为诊断而抛错(诊断只留在 check 阶段),所以负例走 check
//两条已确认的检查缺口(不是本套测试引入的,是当前实现的边界)
describe('system/std+类·已知缺口', () => {
    it('类方法调用的实参个数会被检查', () => {
        const src = `public m:module{ public C:class{
                public toString:string(){ return "x"; }
                public work:number(x:number){ return x; } }
            public static f:number(a:number){ var c:C=new C(); return c.work(); } }`
        expect(has(errs([STD_SOURCE, src]), 'work')).toBe(true)
    })

    it('类方法调用参数类型错也会报', () => {
        const src = `public m:module{ public C:class{
                public toString:string(){ return "x"; }
                public work:number(x:number){ return x; } }
            public static f:number(a:number){ var c:C=new C(); return c.work("s"); } }`
        expect(has(errs([STD_SOURCE, src]), 'work')).toBe(true)
    })

    it('访问不存在的实例成员', () => {
        const src = `public m:module{ public C:class{ public toString:string(){ return "x"; } public v:number; }
            public static f:number(a:number){ var c:C=new C(); return c.zzz; } }`
        expect(has(errs([STD_SOURCE, src]), 'zzz')).toBe(true)
    })

    it('implements 会检查成员是否都实现了', () => {
        const src = `public m:module{ public D:class implements std.Countable{ public n:number; }
            public static f:number(a:number){ return a; } }`
        expect(has(errs([STD_IFACE, src]), 'count')).toBe(true)
    })
})

describe('system/std+类·不该通过的情形', () => {
    const errs = (sources: string[]) => errors_of(run_check(sources.map(s => parse(s))))
    const has = (list: string[], s: string) => list.some(e => e.includes(s))

    it('访问不存在的成员', () => {
        expect(has(errs([STD_SOURCE, `public m:module{ public C:class{ public v:number; }
            public static f:number(a:number){ var c:C=new C(); return c.zzz; } }`]), 'zzz')).toBe(true)
    }, 30000)

    it('implements 不存在的接口', () => {
        expect(has(errs([STD_SOURCE, `public m:module{ public D:class implements std.Nope{ }
            public static f:number(a:number){ return a; } }`]), 'std.Nope')).toBe(true)
    }, 30000)

    it('没有 std 时类一定会报错(说明 fixture 是必要的)', () => {
        expect(has(errs([CLASS]), 'std.ObjectInterface')).toBe(true)
    }, 30000)
})
