import {describe, expect, it} from 'vitest'
import {Round0} from '../../check/censor'
import {Round1, Round2} from '../../check/symbol'
import {Round3} from '../../check/type'
import {check_rounds, errors_of, parse, run_check} from './helper'
import {
    Class,
    ClassType,
    File,
    Function,
    Interface,
    Modifier,
    Module,
    NumberType,
    Variable
} from '../../utils'

const ROUNDS: [number, Map<any, any>][] = [[0, Round0], [1, Round1], [2, Round2]]
//跑到符号表两轮为止
function up_to2(src: string): string[] {
    return errors_of(check_rounds([parse(src)], ROUNDS))
}
const M = (body: string) => `public m:module{ ${body} }`
//类/接口默认 implement std.ObjectInterface,不声明它就会报错
const STD = 'public std:module{ public ObjectInterface:interface{} }\n'
const has = (errs: string[], sub: string) => errs.some(e => e.includes(sub))

describe('check/作用域与引擎', () => {
    it('scope.get 会先查本地,再沿 parent,最后查 global', () => {
        const scope = check_rounds([parse(M('public static v:number=1;'))], ROUNDS)
        expect(scope.get('m.v')).toBeTruthy()
        const inner = (scope as any).enter()
        inner.set('local', 'x')
        expect(inner.get('local')).toBe('x')
        expect(inner.get('m.v')).toBeTruthy()
        expect(inner.leave()).toBe(scope)
    })

    it('get 支持 up. 前缀向上一层找', () => {
        const scope = check_rounds([parse(M('public static v:number=1;'))], ROUNDS)
        scope.set('x', 'outer')
        const inner = (scope as any).enter()
        expect(inner.get('up.x')).toBe('outer')
    })

    it('root() 一路走到最外层', () => {
        const scope = check_rounds([parse(M(''))], ROUNDS)
        const inner = (scope as any).enter().enter()
        expect(inner.root()).toBe(scope)
    })

    //已知缺陷:compiler/utils/lib/check.ts:40 与 check/tool.ts:184
    //Scope.thr 把消息推进 this.global.error,而 Check.run 返回的是最外层 scope,
    //它自己的 error 数组始终是空的。compiler/index.ts 正是读 scope.error.length 来决定要不要中止编译,
    //所以所有 check 诊断目前都被静默吞掉,非法程序会继续走到脱糖和后端。
    it.fails('Check.run 返回的 scope.error 应该带上收集到的诊断', () => {
        const scope: any = run_check([parse(M('public static f:void(){ undefined_name; }'))])
        expect(scope.error.length).toBeGreaterThan(0)
    })

    it('诊断实际落在 global.error 上', () => {
        const scope: any = run_check([parse(M('public static f:void(){ undefined_name; }'))])
        expect(scope.error).toEqual([])
        expect(scope.global.error.join('')).toContain('未定义的变量')
    })
})

describe('check/round2·模块与同名合并', () => {
    it('模块可以嵌套', () => {
        expect(up_to2('public a:module{ public b:module{ public static v:number=1; } }')).toEqual([])
    })

    it('同名模块合并,不报重复', () => {
        expect(up_to2('public a:module{ public static v:number=1; }\npublic a:module{ public static w:number=2; }'))
            .toEqual([])
    })

    it('合并后两个成员都能解析到', () => {
        const scope = check_rounds([parse(
            'public a:module{ public static v:number=1; }\npublic a:module{ public static w:number=2; }')], ROUNDS)
        expect(scope.get('a.v')).toBeTruthy()
        expect(scope.get('a.w')).toBeTruthy()
    })
})

describe('check/round2·重名', () => {
    it('变量不能重名', () => {
        expect(has(up_to2(M('public static a:number=1; public static a:number=2;')), '变量a不能重名')).toBe(true)
    })

    it('函数允许同名重载', () => {
        expect(up_to2(M('public static f:void(){} public static f:number(){return 1;}'))).toEqual([])
    })

    //已知缺陷:compiler/check/tool.ts:188 的 name()
    //m_name 在 exist==ast 时直接返回 false,而 round1 建表时同名后声明会覆盖先声明,
    //于是「最后一个声明」永远被当成自身、不报重名;变量那侧因为 Verify_Variable 会顺手改写 global 才侥幸能报。
    it.fails('枚举不能重名', () => {
        expect(has(up_to2(M('public E:enum{A} public E:enum{B}')), '枚举E不能重名')).toBe(true)
    })

    it.fails('类不能重名', () => {
        expect(has(up_to2(STD + M('public C:class{} public C:class{}')), '类/接口C不能重名')).toBe(true)
    })

    it.fails('类与接口同名也不能重名', () => {
        expect(has(up_to2(STD + M('public C:class{} public C:interface{}')), '类/接口C不能重名')).toBe(true)
    })
})

describe('check/round2·link', () => {
    it('link 的目标模块必须存在', () => {
        expect(has(up_to2('link std.io as io;'), 'link的模块std.io不存在')).toBe(true)
    })

    it('link 到已声明的模块没问题', () => {
        const a = parse('public std:module{ public io:module{} }')
        const b = parse('link std.io as io;\npublic m:module{}')
        expect(errors_of(check_rounds([a, b], ROUNDS))).toEqual([])
    })

    it('点分路径的 link 也能解析', () => {
        const a = parse('public std:module{ public io:module{ public static print:void(){} } }')
        const b = parse('link std.io.print as print;\npublic m:module{ public static f:void(){ print(); } }')
        expect(errors_of(check_rounds([a, b], ROUNDS))).toEqual([])
    })
})

describe('check/round2·类型名解析', () => {
    it('写全路径的类型名可以解析', () => {
        expect(up_to2(STD + M('public C:class{} public static f:void(a:m.C){}'))).toEqual([])
        expect(up_to2(STD + M('public C:class{} public D:class{public static f:void(a:m.C){}}'))).toEqual([])
    })

    it('模块级的变量类型可以用裸名', () => {
        expect(up_to2(STD + M('public C:class{} public static v:C=null;'))).toEqual([])
    })

    //已知缺陷:compiler/check/tool.ts:519 的 resolve_named
    //按路径补全时用的是「当前作用域」的 path,而函数体/类体里的 path 已经带上函数名/类名,
    //于是拼成 m.f.C / m.D.C,永远查不到同模块的兄弟声明。
    it.fails('函数参数里的裸类型名应该能解析到同模块的类', () => {
        expect(up_to2(STD + M('public C:class{} public static f:void(a:C){}'))).toEqual([])
    })

    it.fails('类体里的裸类型名应该能解析到同模块的类', () => {
        expect(up_to2(STD + M('public C:class{} public D:class{public static f:void(a:C){}}'))).toEqual([])
    })

    it('不存在的类型名会报错', () => {
        expect(has(up_to2(M('public static f:void(a:Nope){}')), '类/接口Nope不是Class或Interface')).toBe(true)
    })

    it('变量名不能当类型用', () => {
        expect(has(up_to2(M('public static v:number=1; public static f:void(a:v){}')),
            '类/接口v不是Class或Interface')).toBe(true)
    })

    it('泛型实参个数必须与声明一致', () => {
        expect(has(up_to2(STD + M('public B:class<T>{} public static f:void(a:m.B<number,string>){}')),
            '泛型声明不匹配')).toBe(true)
        expect(up_to2(STD + M('public B:class<T>{} public static f:void(a:m.B<number>){}'))).toEqual([])
    })

    it('枚举没有泛型,不检查实参个数', () => {
        expect(up_to2(M('public E:enum{A} public static v:E=null;'))).toEqual([])
    })

    it('未声明的泛型形参要报错', () => {
        expect(has(up_to2(M('public static f:void(a:@T){}')), '泛型T不存在')).toBe(true)
    })

    it('声明过的泛型形参没问题', () => {
        expect(up_to2(STD + M('public static f:<T>void(a:@T){}'))).toEqual([])
    })
})

describe('check/round2·类的默认 implement', () => {
    it('类不写 implements 时默认实现 std.ObjectInterface', () => {
        expect(up_to2(STD + M('public C:class{}'))).toEqual([])
    })

    it('没有 std.ObjectInterface 时默认实现会报错', () => {
        const errs = up_to2(M('public C:class{}'))
        expect(has(errs, '类/接口std.ObjectInterface不是Class或Interface')).toBe(true)
        expect(has(errs, 'implement的类型std.ObjectInterface不是Interface')).toBe(true)
    })

    it('名为 ObjectInterface 的接口不给自己补默认实现', () => {
        expect(up_to2('public std:module{ public ObjectInterface:interface{} }')).toEqual([])
    })
})

describe('check/round2·implement(手搭 AST,因为 implements 目前解析不出来)', () => {
    //implements 的解析会抛「AST 生成器缺失」,所以直接搭 AST 覆盖 symbol/type 层的检查。
    //手搭的节点没有行号,而 check 报错时会读 ast.line,所以必须自己补上。
    const block = (n: any) => {
        n.line = []
        return n
    }
    const build = (target: any) => {
        const impl = new ClassType(['m', 'X'])
        impl.line = []
        const cls = block(new Class(new Modifier(false, false, false), 'C', new Map(), impl, []))
        const mod = block(new Module(new Modifier(false, false, false), 'm', [block(target), cls]))
        return new File([], [mod])
    }

    it('implement 一个接口没问题', () => {
        const target = block(new Interface(new Modifier(false, false, false), 'X', new Map(), null, []))
        expect(errors_of(check_rounds([build(target)], ROUNDS))).toEqual([])
    })

    it('implement 一个类会报「不是Interface」', () => {
        const target = block(new Class(new Modifier(false, false, false), 'X', new Map(), null, []))
        expect(has(errors_of(check_rounds([build(target)], ROUNDS)),
            'implement的类型m.X不是Interface')).toBe(true)
    })

    it('implement 一个变量会报「不是Interface」', () => {
        const target = block(new Variable(new Modifier(false, false, false), 'X', new NumberType(), null))
        expect(has(errors_of(check_rounds([build(target)], ROUNDS)),
            'implement的类型m.X不是Interface')).toBe(true)
    })

    it('implement 的目标不存在会报「不是Interface」', () => {
        const target = block(new Interface(new Modifier(false, false, false), 'Y', new Map(), null, []))
        expect(has(errors_of(check_rounds([build(target)], ROUNDS)),
            'implement的类型m.X不是Interface')).toBe(true)
    })
})

describe('check·轮次职责划分', () => {
    it('只跑第 1 轮时没有诊断', () => {
        expect(errors_of(check_rounds([parse(M('public static f:void(){ nope; }'))], [[0, Round0], [1, Round1]])))
            .toEqual([])
    })

    it('round1 之后全局表里已经有静态成员', () => {
        const scope = check_rounds([parse(M('public static v:number=1;'))], [[0, Round0], [1, Round1]])
        expect(scope.global.get('m.v')).toBeTruthy()
        expect(scope.global.get('m')).toBeTruthy()
    })

    it('只跑前两轮时表达式还没有被标注类型', () => {
        const f = parse(M('public static f:void(){ var a:number=1; }'))
        check_rounds([f], ROUNDS)
        const fn = (f.children[0] as Module).children[0] as Function
        const decl: any = (fn.commands as any).commands[0]
        expect(decl.value.type).toBeUndefined()
    })

    it('round3 会把表达式标注上类型', () => {
        const f = parse(M(`public static f:void(){
            var a:number=1;
            var b:string='s';
            var c:boolean=true;
            var d:number=null;
            var e:number{}=[k:1];
            var g:number[]=[1,2];
        }`))
        check_rounds([f], [...ROUNDS, [3, Round3]])
        const fn = (f.children[0] as Module).children[0] as Function
        const cs: any[] = (fn.commands as any).commands
        expect(cs[0].value.type.constructor.name).toBe('NumberType')
        expect(cs[1].value.type.constructor.name).toBe('StringType')
        expect(cs[2].value.type.constructor.name).toBe('BooleanType')
        expect(cs[3].value.type.constructor.name).toBe('VoidType')
        expect(cs[4].value.type.constructor.name).toBe('MapType')
        expect(cs[4].value.type.t.constructor.name).toBe('NumberType')
        expect(cs[5].value.type.constructor.name).toBe('ArrayType')
    })

    it('二元运算的结果类型:算术是 number,比较是 boolean', () => {
        const f = parse(M(`public static f:void(){
            var a:number=1+2;
            var b:boolean=1>2;
        }`))
        check_rounds([f], [...ROUNDS, [3, Round3]])
        const fn = (f.children[0] as Module).children[0] as Function
        const cs: any[] = (fn.commands as any).commands
        expect(cs[0].value.type.constructor.name).toBe('NumberType')
        expect(cs[1].value.type.constructor.name).toBe('BooleanType')
    })
})
