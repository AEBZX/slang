import {describe, expect, it} from 'vitest'
import {Round0} from '../../check/censor'
import {Round1, Round2} from '../../check/symbol'
import {Round3} from '../../check/type'
import {Scope, param_is, pick_best, type_is, type_merge, type_same} from '../../check/tool'
import {check_rounds, errors_of, parse} from './helper'
import {
    ArrayType,
    BooleanType,
    ClassType,
    EnumType,
    Function,
    MapType,
    Module,
    NumberType,
    PointType,
    StringType,
    VoidType
} from '../../utils'

const ALL: [number, Map<any, any>][] = [[0, Round0], [1, Round1], [2, Round2], [3, Round3]]
const M = (body: string) => `public m:module{ ${body} }`
const STD = 'public std:module{ public ObjectInterface:interface{} }\n'
const has = (errs: string[], sub: string) => errs.some(e => e.includes(sub))

//跑完整四轮,返回诊断
function c3(src: string): string[] {
    return errors_of(check_rounds([parse(src)], ALL))
}
//跑完整四轮并返回文件,用来读标注出来的类型
function labeled(src: string): any {
    const f = parse(src)
    check_rounds([f], ALL)
    return f
}
//取模块里第一个函数的命令列表
function cmds_of(f: any): any[] {
    return ((f.children[0] as Module).children[0] as Function).commands.commands
}
//取第 n 条 var 声明推断出来的类型名
function var_type(src: string, n = 0): string {
    return cmds_of(labeled(M(`public static f:void(){${src}}`)))[n].value.type.constructor.name
}

describe('check/round3·字面量与表达式', () => {
    it('字面量类型', () => {
        expect(var_type('var a:number=1;')).toBe('NumberType')
        expect(var_type("var a:string='s';")).toBe('StringType')
        expect(var_type('var a:boolean=true;')).toBe('BooleanType')
        expect(var_type('var a:number=null;')).toBe('VoidType')
    })

    it('数组与 Map 字面量的元素类型', () => {
        expect(var_type('var a:number[]=[1,2];')).toBe('ArrayType')
        expect(var_type('var a:number{}=[k:1];')).toBe('MapType')
        expect(cmds_of(labeled(M('public static f:void(){var a:number[]=[1,2];}')))[0].value.type.t.constructor.name)
            .toBe('NumberType')
    })

    it('算术运算结果是 number,比较是 boolean', () => {
        expect(var_type('var a:number=1+2;')).toBe('NumberType')
        expect(var_type('var a:number=1*2-3;')).toBe('NumberType')
        expect(var_type('var a:boolean=1>2;')).toBe('BooleanType')
        expect(var_type('var a:boolean=1==2;')).toBe('BooleanType')
    })

    it('三目把两个分支合并成同一类型', () => {
        expect(var_type('var a:number=true?1:2;')).toBe('NumberType')
    })

    it('字符串索引得到 string,数组索引得到元素类型', () => {
        expect(var_type("var s:string='abc'; var a:string=s[0];", 1)).toBe('StringType')
        expect(var_type('var s:number[]=[1]; var a:number=s[0];', 1)).toBe('NumberType')
    })
})

describe('check/round3·赋值与返回', () => {
    it('类型一致时通过', () => {
        expect(c3(M("public static f:void(){ var a:number=1; var b:string='s'; var c:boolean=true; }")))
            .toEqual([])
    })

    it('var 声明初值类型不符要报错', () => {
        expect(has(c3(M("public static f:void(){ var a:number='s'; }")), '赋值类型错误')).toBe(true)
    })

    it('赋值语句类型不符要报错', () => {
        expect(has(c3(M("public static f:void(){ var a:number=1; a='s'; }")), '赋值类型错误')).toBe(true)
    })

    it('成员变量的初值类型不符要报错', () => {
        expect(has(c3(M("public static v:number='s';")), '赋值类型错误')).toBe(true)
    })

    it('返回类型不符要报错', () => {
        expect(has(c3(M("public static f:number(){ return 's'; }")), '返回类型错误')).toBe(true)
        expect(has(c3(M('public static f:number(){ return; }')), '返回类型错误')).toBe(true)
    })

    it('返回类型相符时通过', () => {
        expect(c3(M('public static f:number(){ return 1; }'))).toEqual([])
        expect(c3(M('public static f:void(){ return; }'))).toEqual([])
    })

    it('赋值的左侧必须是左值', () => {
        expect(has(c3(M('public static f:void(){ 1+2=3; }')), '赋值的左侧不是可赋值的左值')).toBe(true)
    })

    it('未定义的变量要报错', () => {
        expect(has(c3(M('public static f:void(){ nope; }')), '未定义的变量nope')).toBe(true)
    })
})

describe('check/round3·一元运算的操作数类型', () => {
    it('++/-- 只能用于 number', () => {
        expect(c3(M('public static f:void(){ var a:number=1; a++; ++a; }'))).toEqual([])
        expect(has(c3(M("public static f:void(){ var a:string='s'; a++; }")), '++/--只能用于number类型')).toBe(true)
        expect(has(c3(M("public static f:void(){ var a:string='s'; ++a; }")), '++/--只能用于number类型')).toBe(true)
    })

    it('! 只能用于 boolean', () => {
        expect(c3(M('public static f:void(){ var a:boolean=true; !a; }'))).toEqual([])
        expect(has(c3(M('public static f:void(){ var a:number=1; !a; }')), '非操作符只能用于boolean类型')).toBe(true)
    })

    it('~ 只能用于 number', () => {
        expect(c3(M('public static f:void(){ var a:number=1; ~a; }'))).toEqual([])
        expect(has(c3(M("public static f:void(){ var a:string='s'; ~a; }")), '位非操作符只能用于number类型')).toBe(true)
    })

    it('负号只能用于 number', () => {
        expect(c3(M('public static f:void(){ var a:number=1; var b:number=-a; }'))).toEqual([])
        expect(has(c3(M("public static f:void(){ var a:string='s'; var b:number=-a; }")), '负号只能用于number类型')).toBe(true)
    })

    it('解引用只能用于指针', () => {
        //注意 number* 与 = 之间必须有空格:词法器的 * = 会先被吃成复合赋值 *=
        expect(c3(M('public static f:void(){ var a:number=1; var p:number* = &a; var b:number=*p; }'))).toEqual([])
        expect(has(c3(M('public static f:void(){ var a:number=1; var b:number=*a; }')), '引用操作符只能用于指针类型')).toBe(true)
    })

    it('取地址只能用于左值', () => {
        expect(has(c3(M('public static f:void(){ var p:number* = &(1+2); }')), '取地址操作符只能用于左值')).toBe(true)
    })

    it('类型转换需要存在对应的 cast', () => {
        expect(has(c3(M('public static f:void(){ var a:number=(number)1; }')), '类型转换失败')).toBe(true)
    })
})

describe('check/round3·索引', () => {
    it('string 只能用 number 索引', () => {
        expect(c3(M("public static f:void(){ var s:string='a'; var c:string=s[0]; }"))).toEqual([])
        expect(has(c3(M("public static f:void(){ var s:string='a'; var c:string=s['x']; }")), 'string的索引只能是number')).toBe(true)
    })

    it('array 只能用 number 索引', () => {
        expect(c3(M('public static f:void(){ var s:number[]=[1]; var a:number=s[0]; }'))).toEqual([])
        expect(has(c3(M("public static f:void(){ var s:number[]=[1]; var a:number=s['x']; }")), 'array的索引只能是number')).toBe(true)
    })

    it('map 只能用 string 索引', () => {
        expect(c3(M("public static f:void(){ var s:number{}=[k:1]; var a:number=s['k']; }"))).toEqual([])
        expect(has(c3(M('public static f:void(){ var s:number{}=[k:1]; var a:number=s[0]; }')), 'map的索引只能是string')).toBe(true)
    })

    it('完全不支持的类型组合要报错', () => {
        expect(has(c3(M('public static f:void(){ var s:boolean=true; var a:boolean=s[0]; }')), '不支持的索引类型组合')).toBe(true)
    })
})

describe('check/round3·成员访问', () => {
    it('能读到模块的静态变量与函数', () => {
        expect(c3(M(`public static v:number=1;
                     public static g:number(){return 1;}
                     public static f:void(){ var a:number=m.v; var b:number=m.g(); }`))).toEqual([])
    })

    it('模块成员不存在要报错', () => {
        expect(has(c3(M('public static f:void(){ var a:number=m.zzz; }')), 'zzz不存在')).toBe(true)
    })

    it('能读到类的静态成员', () => {
        expect(c3(STD + M(`public C:class{ public static v:number=1; }
                           public static f:void(){ var a:number=m.C.v; }`))).toEqual([])
    })

    it('能读到枚举成员', () => {
        expect(c3(M(`public E:enum{A,B}
                     public static f:void(){ var a:m.E=m.E.A; }`))).toEqual([])
    })

    it('枚举里没有的成员要报错', () => {
        expect(has(c3(M('public E:enum{A} public static f:void(){ var a:m.E=m.E.Z; }')), 'Z不存在')).toBe(true)
    })
})

describe('check/round3·流程控制', () => {
    it('条件不需要是 boolean(脱糖阶段才补 != null)', () => {
        expect(c3(M('public static f:void(){ var a:number=1; if(a){} }'))).toEqual([])
        expect(c3(M('public static f:void(){ var a:number=1; while(a){break;} }'))).toEqual([])
    })

    it('switch 的 case 类型必须和 switch 一致', () => {
        expect(c3(M('public static f:void(){ var a:number=1; switch(a){ case 1=>{} } }'))).toEqual([])
        expect(has(c3(M("public static f:void(){ var a:number=1; switch(a){ case 'x'=>{} } }")),
            'switch case的类型和switch的类型不一致')).toBe(true)
    })

    it('foreach 会把元素类型绑定给循环变量', () => {
        const f = labeled(M('public static f:void(){ var s:number[]=[1]; foreach(c:s){ var a:number=c; } }'))
        const fe: any = cmds_of(f)[1]
        expect(fe.iden_type.constructor.name).toBe('NumberType')
    })

    it('for 的初始化与步进都会做类型检查', () => {
        expect(c3(M('public static f:void(){ for(var i:number=0;i<10;i++;){ } }'))).toEqual([])
        expect(has(c3(M("public static f:void(){ for(var i:number='s';i<10;i++;){ } }")), '赋值类型错误')).toBe(true)
    })

    it('try 的 catch 里能用声明的异常变量', () => {
        expect(c3(M("public static f:void(){ try{}catch(e:string){ var a:string=e; } }"))).toEqual([])
    })
})

describe('check/round3·new', () => {
    it('new 只能用于类', () => {
        expect(has(c3(M('public static f:void(){ var a:number=new 1; }')), 'new只能用于类')).toBe(true)
    })

    it('new 一个类应该能通过', () => {
        expect(c3(STD + M('public C:class{} public static f:void(){ var a:m.C=new m.C(); }'))).toEqual([])
    })
})

describe('check/round3·诊断不会因为缺行号而崩掉', () => {
    it('链式成员访问里的错误应该被正常诊断', () => {
        expect(has(c3(M('public static f:void(){ var a:number=1; a.b(); }')), 'b不存在')).toBe(true)
    })

    it('同样的错误在非链式访问上能正常诊断', () => {
        expect(has(c3(M('public static f:void(){ var a:number=1; a.b; }')), 'b不存在')).toBe(true)
    })

    it('类型转换的目标类型应该被解析', () => {
        expect(has(c3(M('public static f:void(){ var a:number=(NoSuchType)1; }')),
            '类/接口NoSuchType不是Class或Interface')).toBe(true)
    })
})

describe('check/tool·类型工具', () => {
    const scope = () => new Scope(null, new Scope(null, null)) as Scope

    it('type_same:同构才算同类型', () => {
        expect(type_same(new NumberType(), new NumberType())).toBe(true)
        expect(type_same(new NumberType(), new StringType())).toBe(false)
        expect(type_same(new ArrayType(new NumberType()), new ArrayType(new NumberType()))).toBe(true)
        expect(type_same(new ArrayType(new NumberType()), new ArrayType(new StringType()))).toBe(false)
        expect(type_same(new ClassType(['A']), new ClassType(['A']))).toBe(true)
        expect(type_same(new ClassType(['m', 'A']), new ClassType(['A']))).toBe(true)
        expect(type_same(new ClassType(['A']), new ClassType(['B']))).toBe(false)
    })

    it('type_same:PointType 单侧盒子会先解包', () => {
        expect(type_same(new PointType(new NumberType()), new NumberType())).toBe(true)
        expect(type_same(new NumberType(), new PointType(new NumberType()))).toBe(true)
    })

    it('type_same:null 只与 null 相同', () => {
        expect(type_same(null, null)).toBe(true)
        expect(type_same(new NumberType(), null)).toBe(false)
    })

    it('type_merge:Void 与任何类型合并都得到另一边', () => {
        const s = scope()
        expect(type_merge(new VoidType(), new NumberType(), s).constructor.name).toBe('NumberType')
        expect(type_merge(new NumberType(), new VoidType(), s).constructor.name).toBe('NumberType')
    })

    it('type_merge:不同基本类型合不出结果', () => {
        const s = scope()
        expect(type_merge(new NumberType(), new StringType(), s).constructor.name).toBe('VoidType')
    })

    it('type_merge:同构的 FixType 合出同构结果', () => {
        const s = scope()
        const m = type_merge(new ArrayType(new NumberType()), new ArrayType(new NumberType()), s)
        expect(m.constructor.name).toBe('ArrayType')
        expect((m as any).t.constructor.name).toBe('NumberType')
    })

    it('type_merge:构造器不同的 FixType 合不出结果', () => {
        const s = scope()
        expect(type_merge(new ArrayType(new NumberType()), new MapType(new NumberType()), s).constructor.name)
            .toBe('VoidType')
    })

    it('type_is / type_:Void 只与 Void 兼容', () => {
        const s = scope()
        expect(type_is(new NumberType(), new NumberType(), s)).toBe(true)
        expect(type_is(new NumberType(), new StringType(), s)).toBe(false)
        expect(type_is(new VoidType(), new VoidType(), s)).toBe(true)
        expect(type_is(new VoidType(), new NumberType(), s)).toBe(false)
    })

    it('param_is:形参个数与逐个可赋值', () => {
        const s = scope()
        expect(param_is([new NumberType()], new Map([['a', new NumberType()]]), s)).toBe(true)
        expect(param_is([new StringType()], new Map([['a', new NumberType()]]), s)).toBe(false)
        expect(param_is([], new Map([['a', new NumberType()]]), s)).toBe(false)
    })

    it('pick_best:数量不符返回 null,唯一可匹配返回 0', () => {
        const s = scope()
        const sets = [[new NumberType()], [new StringType()]]
        expect(pick_best(s, sets, [new NumberType()])).toBe(0)
        expect(pick_best(s, sets, [new BooleanType()])).toBe(null)
    })

    it('pick_best:多个可匹配时报歧义(-1)', () => {
        const s = scope()
        //两个完全一样的候选,谁都不比谁更具体
        const sets = [[new NumberType()], [new NumberType()]]
        expect(pick_best(s, sets, [new NumberType()])).toBe(-1)
    })

    it('type_same 能区分枚举与同名的 ClassType(点分后缀一致即同一)', () => {
        expect(type_same(new EnumType(['m', 'E']), new ClassType(['m', 'E']))).toBe(true)
        expect(type_same(new EnumType(['E']), new ClassType(['m', 'E']))).toBe(true)
    })
})
