import {describe, expect, it} from 'vitest'
import {parse, parse_first_block, render} from './helper'

//解析整个文件并渲染
const F = (src: string) => render(parse(src))
//解析第一个顶层块并渲染
const B = (src: string) => render(parse_first_block(src))

describe('parser/块·File 与 link', () => {
    it('空文件', () => {
        expect(F('')).toBe('|')
    })

    it('link 导入', () => {
        expect(F('link std.io as io;')).toBe('link std.io as io|')
    })

    it('多条 link 按顺序保留', () => {
        expect(F('link std.io as io;link std.math as math;'))
            .toBe('link std.io as iolink std.math as math|')
    })

    it('link 在块之前', () => {
        expect(F('link std.io as io;\npublic std:module{}'))
            .toBe('link std.io as io|[?,?,public]std:module{}')
    })

    it('顶层可以同时有 module 和 value', () => {
        expect(F('public m:module{}value number{}'))
            .toBe('|[?,?,public]m:module{}value number{}')
    })

    it('link 的模块名是类型,可以点分', () => {
        expect(F('link std.io.print as print;')).toBe('link std.io.print as print|')
    })

    it('link 缺少 as 别名时报错', () => {
        expect(() => parse('link std.io;')).toThrow()
    })
})

describe('parser/块·Module', () => {
    it('模块', () => {
        expect(B('public std:module{}')).toBe('[?,?,public]std:module{}')
    })

    it('嵌套模块', () => {
        expect(B('public std:module{public math:module{}}'))
            .toBe('[?,?,public]std:module{[?,?,public]math:module{}}')
    })

    it('模块名是标识符,不含点', () => {
        expect(() => parse('public a.b:module{}')).toThrow()
    })

    it('模块名不能是关键字', () => {
        expect(() => parse('public class:module{}')).toThrow()
    })
})

describe('parser/块·Class 与 Interface', () => {
    //注意:没有写 implements 的类/接口会被默认补成 std.ObjectInterface
    const DEFAULT = ' implements std.ObjectInterface'

    it('类', () => {
        expect(B('public Box:class{}')).toBe('[?,?,public]Box:class' + DEFAULT + '{}')
    })

    it('类带泛型形参', () => {
        expect(B('public Box:class<T>{}')).toBe('[?,?,public]Box:class<T>' + DEFAULT + '{}')
    })

    it('类带多个泛型形参', () => {
        expect(B('public Box:class<T,U>{}')).toBe('[?,?,public]Box:class<T,U>' + DEFAULT + '{}')
    })

    it('类的成员', () => {
        expect(B('public Box:class{public v:number;public f:void(){}}'))
            .toBe('[?,?,public]Box:class' + DEFAULT + '{[?,?,public]v:number;[?,?,public]f:void(){}}')
    })

    it('接口', () => {
        expect(B('public I:interface{}')).toBe('[?,?,public]I:interface' + DEFAULT + '{}')
    })

    it('接口里的函数以分号结尾表示无实现', () => {
        expect(B('public I:interface{public f:void();}'))
            .toBe('[?,?,public]I:interface' + DEFAULT + '{[?,?,public]f:void();}')
    })

    it('接口带泛型', () => {
        expect(B('public I:interface<T>{}')).toBe('[?,?,public]I:interface<T>' + DEFAULT + '{}')
    })

    it('名字是 ObjectInterface 的接口不给自己补默认实现', () => {
        expect(B('public ObjectInterface:interface{}')).toBe('[?,?,public]ObjectInterface:interface{}')
    })

    //已知缺陷:compiler/parser/ast/tool.ts:65
    //parseImplement 已经把 first=data.children.get(key) 取出来了,却把 tree(to_ast_data(data,0)) 传下去。
    //无泛型时 child0 是 ImplementsName 包装节点,有泛型时 child0 是 GenericList,
    //两者都没注册 AST 生成器,于是 implements 一律抛「AST 生成器缺失」。
    it.fails('类 implements 接口(无泛型)', () => {
        expect(B('public Box:class implements Container{}'))
            .toBe('[?,?,public]Box:class implements Container{}')
    })

    it.fails('类 implements 接口(带泛型)', () => {
        expect(B('public Box:class<T> implements Container<T>{}'))
            .toBe('[?,?,public]Box:class<T> implements Container<T>{}')
    })

    it.fails('接口 implements 接口', () => {
        expect(B('public I:interface implements J{}'))
            .toBe('[?,?,public]I:interface implements J{}')
    })

    //已知缺陷:compiler/parser/ast/tool.ts:67
    //同一个分支里 Type 走的是 tree(to_ast_data(data,0)),而 child0 是泛型名字符串 'T',
    //tree('T') 去查名字为 undefined 的生成器,直接抛「AST 生成器缺失:undefined」。
    it.fails('泛型形参带 implements 约束', () => {
        expect(B('public Box:class<T implements std.ObjectInterface>{}'))
            .toBe('[?,?,public]Box:class<T>{}')
    })
})

describe('parser/块·Enum', () => {
    it('枚举成员', () => {
        expect(B('public Color:enum{Red,Green,Blue}')).toBe('[?,?,public]Color:enum{Red,Green,Blue}')
    })

    it('空枚举', () => {
        expect(B('public Color:enum{}')).toBe('[?,?,public]Color:enum{}')
    })

    it('成员只能是标识符,不能带值', () => {
        expect(() => parse('public Color:enum{Red=1}')).toThrow()
    })
})

describe('parser/块·Function', () => {
    it('带实现的函数', () => {
        expect(B('pow:number(a:number,b:number){return a;}'))
            .toBe('[?,?,?]pow:number(a:number,b:number){return a;}')
    })

    it('以分号结尾表示无实现', () => {
        expect(B('pow:number(a:number,b:number);')).toBe('[?,?,?]pow:number(a:number,b:number);')
    })

    it('无参数函数', () => {
        expect(B('f:void(){}')).toBe('[?,?,?]f:void(){}')
    })

    it('函数可以带泛型形参', () => {
        expect(B('f:<T>@T(a:@T){}')).toBe('[?,?,?]f:<T>@T(a:@T){}')
        expect(B('f:<T,U>@T(a:@T,b:@U){}')).toBe('[?,?,?]f:<T,U>@T(a:@T,b:@U){}')
    })

    it('返回类型可以是复合类型', () => {
        expect(B('f:string{}(){}')).toBe('[?,?,?]f:string{}(){}')
    })

    it('函数体只接受一条命令,多条要写成块', () => {
        expect(B('f:void(){a;b;}')).toBe('[?,?,?]f:void(){a; b;}')
    })

    it('函数体可以为空', () => {
        expect(B('f:void(){}')).toBe('[?,?,?]f:void(){}')
    })
})

describe('parser/块·Variable', () => {
    it('带初值', () => {
        expect(B('pi:number=3.14;')).toBe('[?,?,?]pi:number=3.14;')
    })

    it('不带初值', () => {
        expect(B('pi:number;')).toBe('[?,?,?]pi:number;')
    })

    it('初值是任意表达式', () => {
        expect(B('pi:number=1+2*3;')).toBe('[?,?,?]pi:number=(1+(2*3));')
    })

    it('块级变量不再接受旧的 name:var:Type 写法', () => {
        expect(() => parse('pi:var:number=3.14;')).toThrow()
    })
})

describe('parser/块·Modifiers', () => {
    it('缺省时三个字段都是 null,交由 check 层 fill_modifier 补齐', () => {
        expect(B('m:module{}')).toBe('[?,?,?]m:module{}')
    })

    it('public / private', () => {
        expect(B('public m:module{}')).toBe('[?,?,public]m:module{}')
        expect(B('private m:module{}')).toBe('[?,?,private]m:module{}')
    })

    it('static / unstatic', () => {
        expect(B('static m:module{}')).toBe('[static,?,?]m:module{}')
        expect(B('unstatic m:module{}')).toBe('[unstatic,?,?]m:module{}')
    })

    it('async / sync', () => {
        expect(B('async m:module{}')).toBe('[?,async,?]m:module{}')
        expect(B('sync m:module{}')).toBe('[?,sync,?]m:module{}')
    })

    it('修饰符可以任意组合、顺序不限', () => {
        expect(B('public static m:module{}')).toBe('[static,?,public]m:module{}')
        expect(B('static public m:module{}')).toBe('[static,?,public]m:module{}')
        expect(B('async private unstatic f:void(){}')).toBe('[unstatic,async,private]f:void(){}')
    })

    it('修饰符也适用于变量和枚举等', () => {
        expect(B('public static pi:number=3.14;')).toBe('[static,?,public]pi:number=3.14;')
        expect(B('private c:enum{A}')).toBe('[?,?,private]c:enum{A}')
    })

    it('未知的修饰符会被拒绝', () => {
        expect(() => parse('protected m:module{}')).toThrow()
    })
})

describe('parser/块·value 重载', () => {
    it('operation:二元运算符', () => {
        expect(B('value number{operation + (a:number,b:number)=>number{return a;}}'))
            .toBe('value number{operation + (a:number,b:number)=>number{return a;}}')
    })

    it('operation:下标运算符 []', () => {
        expect(B('value number{operation [] (a:number)=>number{return a;}}'))
            .toBe('value number{operation [] (a:number)=>number{return a;}}')
    })

    it('operation:调用运算符 ()', () => {
        expect(B('value number{operation () (a:number)=>number{return a;}}'))
            .toBe('value number{operation () (a:number)=>number{return a;}}')
    })

    it('operation:前缀自增', () => {
        expect(B('value number{operation ++ (a:number)=>number{return a;}}'))
            .toBe('value number{operation ++ (a:number)=>number{return a;}}')
    })

    it('operation:后缀自增靠末尾多一个 number 参数区分', () => {
        expect(B('value number{operation ++ (a:number,post:number)=>number{return a;}}'))
            .toBe('value number{operation ++ (a:number,post:number)=>number{return a;}}')
    })

    it('cast:目标类型写在 cast 之后', () => {
        expect(B('value number{cast number(s:string)=>number{return 0;}}'))
            .toBe('value number{cast number (s:string)=>number{return 0;}}')
    })

    it('value 支持的类型是 number/string/boolean', () => {
        expect(B('value string{}')).toBe('value string{}')
        expect(B('value boolean{}')).toBe('value boolean{}')
    })

    it('value 内部的运算符是 lambda,必须写全参数与返回类型', () => {
        expect(() => parse('value number{operation + {return;}}')).toThrow()
    })
})
