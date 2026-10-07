import {describe, expect, it} from 'vitest'
import {Round0} from '../../check/censor'
import {errors_of, parse, check_rounds} from './helper'

//只跑第 0 轮(纯静态检查,不需要符号表)
function c0(src: string): string[] {
    return errors_of(check_rounds([parse(src)], [[0, Round0]]))
}
//文件顶层只允许 module/value,大多数块级用例都得包一层模块
const M = (body: string) => `public m:module{ ${body} }`
//断言某条错误出现
const has = (errs: string[], sub: string) => errs.some(e => e.includes(sub))

describe('check/round0·File', () => {
    it('顶层只能是 link/module/value', () => {
        expect(c0('link std.io as io;')).toEqual([])
        expect(c0('public m:module{}')).toEqual([])
        expect(c0('value number{}')).toEqual([])
        expect(has(c0('f:void(){}'), '文件顶层只能是link/module/value')).toBe(true)
        expect(has(c0('v:number=1;'), '文件顶层只能是link/module/value')).toBe(true)
        expect(has(c0('public C:class{}'), '文件顶层只能是link/module/value')).toBe(true)
    })

    it('link 的别名不能重复', () => {
        expect(has(c0('link std.io as a;link std.math as a;'), 'link的别名不能重复')).toBe(true)
        expect(c0('link std.io as a;link std.math as b;')).toEqual([])
    })
})

describe('check/round0·Module', () => {
    it('模块自身必须静态且公有', () => {
        expect(c0('public std:module{}')).toEqual([])
        expect(has(c0('unstatic std:module{}'), '模块不能是非static的')).toBe(true)
        expect(has(c0('private std:module{}'), '模块不能是私有的')).toBe(true)
        expect(has(c0('async std:module{}'), '模块不能是异步的')).toBe(true)
    })

    it('模块成员必须静态且公有', () => {
        expect(c0(M('public static f:void(){}'))).toEqual([])
        expect(has(c0(M('public f:void(){}')), '模块内部不能是非static的')).toBe(true)
        expect(has(c0(M('public static private f:void(){}')), '模块内部不能是私有的')).toBe(true)
    })
})

describe('check/round0·Class 与 Interface', () => {
    it('不能是异步的', () => {
        expect(c0(M('public C:class{}'))).toEqual([])
        expect(has(c0(M('async C:class{}')), '类或接口不能是异步的')).toBe(true)
        expect(has(c0(M('async I:interface{}')), '类或接口不能是异步的')).toBe(true)
    })

    it('类内部的函数必须有实现', () => {
        expect(c0(M('public C:class{public static f:void(){}}'))).toEqual([])
        expect(has(c0(M('public C:class{public static f:void();}')), '类内部的function必须实现')).toBe(true)
    })

    it('接口内部的函数不能有实现', () => {
        expect(c0(M('public I:interface{public static f:void();}'))).toEqual([])
        expect(has(c0(M('public I:interface{public static f:void(){}}')), '接口内部的function不可以实现')).toBe(true)
    })

    it('类/接口内部的成员种类受限', () => {
        expect(has(c0(M('public C:class{public static n:module{}}')),
            '类/接口内部只能是operation/cast/variable/function')).toBe(true)
    })

    it('类/接口里的泛型不能重名', () => {
        expect(has(c0(M('public C:class<T,T>{}')), '类/接口中泛型重复定义')).toBe(true)
    })

    it('不同的泛型名不受影响', () => {
        expect(c0(M('public C:class<T,U>{}'))).toEqual([])
    })
})

describe('check/round0·Enum', () => {
    it('枚举成员不能重复', () => {
        expect(c0(M('public E:enum{A,B}'))).toEqual([])
        expect(has(c0(M('public E:enum{A,A}')), '枚举成员重复定义')).toBe(true)
    })

    it('不能是异步的', () => {
        expect(has(c0(M('async E:enum{A}')), '枚举不能是异步的')).toBe(true)
    })
})

describe('check/round0·Function 与 Variable', () => {
    it('参数与泛型正常时无报错', () => {
        expect(c0(M('public static f:void(a:number){}'))).toEqual([])
        expect(c0(M('public static f:<T>void(a:@T){}'))).toEqual([])
    })

    it('函数参数不能重名', () => {
        expect(has(c0(M('public static f:void(a:number,a:number){}')), '函数中参数定义重复定义')).toBe(true)
    })

    it('函数的泛型形参不能重名', () => {
        expect(has(c0(M('public static f:<T,T>void(){}')), '函数中泛型定义重复定义')).toBe(true)
    })

    it('变量不能是异步的', () => {
        expect(has(c0(M('public static async v:number=1;')), '变量不能是异步的')).toBe(true)
        expect(c0(M('public static sync v:number=1;'))).toEqual([])
    })
})

describe('check/round0·break/continue/throw 的作用域', () => {
    it('break/continue 只能在循环里', () => {
        expect(has(c0(M('public static f:void(){break;}')), 'break/continue只能在循环中使用')).toBe(true)
        expect(has(c0(M('public static f:void(){continue;}')), 'break/continue只能在循环中使用')).toBe(true)
        expect(c0(M('public static f:void(){while(true){break;}}'))).toEqual([])
        expect(c0(M('public static f:void(){while(true){continue;}}'))).toEqual([])
    })

    it('do-while 体内也算循环', () => {
        expect(c0(M('public static f:void(){do break;while(true);}'))).toEqual([])
    })

    it('for / foreach 体内也算循环', () => {
        expect(c0(M('public static f:void(){for(var i:number=0;i<1;i++;){break;}}'))).toEqual([])
        expect(c0(M('public static f:void(){foreach(c:s){continue;}}'))).toEqual([])
    })

    it('循环标志会随嵌套作用域向上查找', () => {
        expect(c0(M('public static f:void(){while(true){{break;}}}'))).toEqual([])
    })

    it('throw 只能在 try 里', () => {
        expect(has(c0(M('public static f:void(){throw e;}')), 'throw只能在try中使用')).toBe(true)
        expect(c0(M('public static f:void(){try{throw e;}catch(x:string){}}'))).toEqual([])
    })

    it('catch 里可以重新抛出', () => {
        expect(c0(M('public static f:void(){try{}catch(x:string){throw e;}}'))).toEqual([])
    })

    it('finally 里可以抛出', () => {
        expect(c0(M('public static f:void(){try{}catch(x:string){}finally{throw e;}}'))).toEqual([])
    })
})

describe('check/round0·var 声明', () => {
    it('var 的类型不能是 void', () => {
        expect(has(c0(M('public static f:void(){var a:void;}')), 'var的类型不能是void')).toBe(true)
        expect(has(c0(M('public static f:void(){var a:void*;}')), 'var的类型不能是void')).toBe(true)
        expect(c0(M('public static f:void(){var a:number;}'))).toEqual([])
    })
})

describe('check/round0·value 重载块', () => {
    it('value 必须声明字面量类型', () => {
        expect(c0('value number{}')).toEqual([])
        expect(c0('value string{}')).toEqual([])
        expect(c0('value boolean{}')).toEqual([])
        expect(has(c0('value A{}'), '值定义必须是number/string/boolean')).toBe(true)
    })

    it('value 内部只能写 operation/cast', () => {
        expect(c0('value number{operation + (a:number,b:number)=>number{return a;}}')).toEqual([])
        expect(c0('value number{cast number(s:string)=>number{return 0;}}')).toEqual([])
        //写别的成员直接解析失败,不需要 check 兜底
        expect(() => c0('value number{public static v:number=1;}')).toThrow()
    })

    it('value 块不接受修饰符', () => {
        //CST 里 Value 规则没有 Modifiers,所以「值类型重载必须静态」这条检查实际不可达
        expect(() => c0('unstatic value number{}')).toThrow()
        expect(() => c0('public value number{}')).toThrow()
    })

    it('运算符重载不能返回 void', () => {
        expect(has(c0('value number{operation + (a:number,b:number)=>void{return;}}'), '运算符重载不能返回void')).toBe(true)
    })

    it('运算符重载不能有泛型', () => {
        expect(has(c0('value number{operation + <T>(a:number,b:number)=>number{return a;}}'), '运算符重载不能有泛型')).toBe(true)
    })

    it('类型转换不能有泛型', () => {
        expect(has(c0('value number{cast number<T>(s:string)=>number{return 0;}}'), '类型转换不能有泛型')).toBe(true)
    })
})

describe('check/round0·表达式', () => {
    it('枚举成员这类数组形式的重复能被发现', () => {
        expect(has(c0(M('public E:enum{A,A}')), '枚举成员重复定义')).toBe(true)
    })

    it('map 的 key 不能重复', () => {
        expect(has(c0(M("public static f:void(){var a:number{}=[k:1,k:2];}")), 'map中key定义重复定义')).toBe(true)
    })

    it('lambda 的参数不能重复', () => {
        expect(has(c0(M('public static f:void(){var a:number=(x:number,x:number)=>number{return x;};}')),
            'lambda中参数定义重复定义')).toBe(true)
    })

    it('lambda 的泛型不能重复', () => {
        expect(has(c0(M('public static f:void(){var a:number=<T,T>(x:@T)=>number{return x;};}')),
            'lambda中泛型定义重复定义')).toBe(true)
    })

    it('不重复时没有报错', () => {
        expect(c0(M("public static f:void(){var a:number{}=[k:1,j:2];}"))).toEqual([])
    })
})
