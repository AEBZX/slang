import {describe, expect, it} from 'vitest'
import {parse_expr, render} from './helper'

//解析表达式并渲染成括号风格
const E = (src: string) => render(parse_expr(src))

describe('parser/表达式·字面量', () => {
    it('数字字面量', () => {
        expect(E('1')).toBe('1')
        expect(E('3.14')).toBe('3.14')
    })

    it('进制前缀按原样保留,由 HIR 负责换算', () => {
        expect(E('0x1F')).toBe('0x1F')
        expect(E('0b1010')).toBe('0b1010')
        expect(E('0o17')).toBe('0o17')
    })

    it('字符串字面量:三种引号,词法阶段去掉引号', () => {
        expect(E('"abc"')).toBe('"abc"')
        expect(E("'abc'")).toBe('"abc"')
        expect(E('`abc`')).toBe('"abc"')
    })

    it('字符串里可以出现别的引号', () => {
        expect(E(`"it's"`)).toBe(`"it's"`)
        expect(E(`'say "hi"'`)).toBe(`"say \\"hi\\""`)
    })

    it('布尔与 null', () => {
        expect(E('true')).toBe('true')
        expect(E('false')).toBe('false')
        expect(E('null')).toBe('null')
    })

    it('标识符', () => {
        expect(E('abc')).toBe('abc')
        expect(E('_a$1')).toBe('_a$1')
    })

    //已知缺陷:compiler/utils/lib/lexer.ts:90
    //转义处理是 ret+=JSON.parse(`"${esc}"`) —— 拼出来的是「只有转义字符本身」的字符串,
    //反斜杠丢了。于是 \n 变成字母 n;而 \" 与 \\ 会让 JSON.parse 收到非法字面量并抛错。
    it.fails('\\n 转义成换行符', () => {
        expect(E('"a\\nb"')).toBe('"a\\nb"')
    })

    it.fails('\\" 是合法转义', () => {
        expect(E('"a\\"b"')).toBe('"a\\"b"')
    })

    it.fails('\\\\ 是合法转义', () => {
        expect(E('"a\\\\b"')).toBe('"a\\\\b"')
    })
})

describe('parser/表达式·数组与 Map', () => {
    it('数组字面量', () => {
        expect(E('[1,2,3]')).toBe('[1,2,3]')
        expect(E('[]')).toBe('[]')
    })

    it('数组元素是任意表达式', () => {
        expect(E('[1+2,a.b]')).toBe('[(1+2),(a.b)]')
    })

    it('Map 字面量的键是标识符', () => {
        expect(E("[type:'print',data:data]")).toBe('[type:"print",data:data]')
        expect(E('[]')).toBe('[]')
    })
})

describe('parser/表达式·lambda', () => {
    it('无参数 lambda', () => {
        expect(E('()=>void{return;}')).toBe('()=>void{return ;}')
    })

    it('带参数的 lambda', () => {
        expect(E('(a:number,b:number)=>number{return a;}')).toBe('(a:number,b:number)=>number{return a;}')
    })

    it('带泛型的 lambda', () => {
        expect(E('<T>(a:@T)=>@T{return a;}')).toBe('<T>(a:@T)=>@T{return a;}')
    })
})

describe('parser/表达式·后缀', () => {
    it('成员访问,可链式', () => {
        expect(E('a.b')).toBe('(a.b)')
        expect(E('a.b.c')).toBe('((a.b).c)')
    })

    it('下标', () => {
        expect(E('a[0]')).toBe('(a[0])')
        expect(E('a[a[0]]')).toBe('(a[(a[0])])')
    })

    it('调用,实参可空', () => {
        expect(E('f()')).toBe('(f())')
        expect(E('f(1,2)')).toBe('(f(1,2))')
    })

    it('调用可显式给出泛型实参', () => {
        expect(E('f<number>(x)')).toBe('(f<number>(x))')
        expect(E('f<number,string>(x)')).toBe('(f<number,string>(x))')
    })

    it('后缀自增自减', () => {
        expect(E('a++')).toBe('(a++)')
        expect(E('a--')).toBe('(a--)')
    })

    it('后缀可以连续叠加', () => {
        expect(E('a.b[0]()')).toBe('(((a.b)[0])())')
        expect(E('a().b')).toBe('((a()).b)')
        expect(E('a[0]++')).toBe('((a[0])++)')
    })
})

describe('parser/表达式·前缀', () => {
    it('类型转换', () => {
        expect(E('(number)x')).toBe('((number)x)')
        expect(E('(std.math.Item)x')).toBe('((std.math.Item)x)')
        expect(E('(number[])x')).toBe('((number[])x)')
    })

    it('前缀自增自减', () => {
        expect(E('++a')).toBe('(++a)')
        expect(E('--a')).toBe('(--a)')
    })

    it('逻辑非 / 按位取反 / 负号', () => {
        expect(E('!a')).toBe('(!a)')
        expect(E('~a')).toBe('(~a)')
        expect(E('-a')).toBe('(-a)')
    })

    it('解引用 / 取地址 / new', () => {
        expect(E('*a')).toBe('(*a)')
        expect(E('&a')).toBe('(&a)')
        expect(E('new A()')).toBe('(new (A()))')
    })

    it('前缀可以叠加', () => {
        expect(E('!!a')).toBe('(!(!a))')
        expect(E('--a')).toBe('(--a)')
        expect(E('*&a')).toBe('(*(&a))')
    })

    //已知缺陷:compiler/parser/cst/expr.ts:36
    //TypePrefix 挂在 PrefixList 里,排在 PostfixExpression -> PrimaryExpression -> "(" Expression ")" 之前,
    //而 ClassType 接受任意标识符,于是 (x) 先被当成「转成类型 x」吃掉,
    //后面缺操作数就整条失败;若恰好后面能接住(*y),就静默变成转换而不是乘法。
    it.fails('括号表达式 (x)', () => {
        expect(E('(x)')).toBe('x')
    })

    it.fails('括号表达式 (a.b)', () => {
        expect(E('(a.b)')).toBe('(a.b)')
    })

    it('括号内不是单个标识符时正常', () => {
        expect(E('(x+1)')).toBe('(x+1)')
        expect(E('(1+2)')).toBe('(1+2)')
    })

    it.fails('(x)*y 应该是乘法而不是类型转换', () => {
        expect(E('(x)*y')).toBe('(x*y)')
    })
})

describe('parser/表达式·二元运算', () => {
    it('每个运算符都映射到对应的节点', () => {
        expect(E('a+b')).toBe('(a+b)')
        expect(E('a-b')).toBe('(a-b)')
        expect(E('a*b')).toBe('(a*b)')
        expect(E('a/b')).toBe('(a/b)')
        expect(E('a%b')).toBe('(a%b)')
        expect(E('a<<b')).toBe('(a<<b)')
        expect(E('a>>b')).toBe('(a>>b)')
        expect(E('a<b')).toBe('(a<b)')
        expect(E('a>b')).toBe('(a>b)')
        expect(E('a<=b')).toBe('(a<=b)')
        expect(E('a>=b')).toBe('(a>=b)')
        expect(E('a==b')).toBe('(a==b)')
        expect(E('a!=b')).toBe('(a!=b)')
        expect(E('a&b')).toBe('(a&b)')
        expect(E('a^b')).toBe('(a^b)')
        expect(E('a|b')).toBe('(a|b)')
        expect(E('a&&b')).toBe('(a&&b)')
        expect(E('a||b')).toBe('(a||b)')
    })

    it('同级左结合', () => {
        expect(E('1-2-3')).toBe('((1-2)-3)')
        expect(E('1+2+3')).toBe('((1+2)+3)')
        expect(E('1/2/3')).toBe('((1/2)/3)')
    })
})

describe('parser/表达式·优先级', () => {
    it('乘除模高于加减', () => {
        expect(E('1+2*3')).toBe('(1+(2*3))')
        expect(E('1*2+3')).toBe('((1*2)+3)')
        expect(E('1+2%3')).toBe('(1+(2%3))')
    })

    it('加减高于移位', () => {
        expect(E('a<<b+c')).toBe('(a<<(b+c))')
        expect(E('a+b>>c')).toBe('((a+b)>>c)')
    })

    it('移位高于关系', () => {
        expect(E('a<b<<c')).toBe('(a<(b<<c))')
    })

    it('关系高于相等', () => {
        expect(E('a<b==c')).toBe('((a<b)==c)')
        expect(E('a==b<c')).toBe('(a==(b<c))')
    })

    it('相等高于按位与/异或/或', () => {
        expect(E('a&b==c')).toBe('(a&(b==c))')
        expect(E('a^b&c')).toBe('(a^(b&c))')
        expect(E('a|b^c')).toBe('(a|(b^c))')
    })

    it('按位运算高于逻辑与/或', () => {
        expect(E('a&&b|c')).toBe('(a&&(b|c))')
        expect(E('a|b&&c')).toBe('((a|b)&&c)')
        expect(E('a||b&&c')).toBe('(a||(b&&c))')
        expect(E('a&&b||c')).toBe('((a&&b)||c)')
    })

    it('前缀运算高于二元运算', () => {
        expect(E('-a*b')).toBe('((-a)*b)')
        expect(E('!a&&b')).toBe('((!a)&&b)')
        expect(E('(number)a+b')).toBe('(((number)a)+b)')
    })

    it('后缀运算优先级最高', () => {
        expect(E('a.b+c')).toBe('((a.b)+c)')
        expect(E('a[0]*2')).toBe('((a[0])*2)')
        expect(E('f()+1')).toBe('((f())+1)')
    })
})

describe('parser/表达式·三目', () => {
    it('基本形式', () => {
        expect(E('a?b:c')).toBe('(a?b:c)')
    })

    it('优先级低于二元运算', () => {
        expect(E('a+b?c:d')).toBe('((a+b)?c:d)')
        expect(E('a?b+c:d')).toBe('(a?(b+c):d)')
    })

    it('右结合', () => {
        expect(E('a?b:c?d:e')).toBe('(a?b:(c?d:e))')
    })

    it('条件位置接受逻辑表达式', () => {
        expect(E('a&&b?c:d')).toBe('((a&&b)?c:d)')
    })
})
