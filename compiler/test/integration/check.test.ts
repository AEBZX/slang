import { describe, it, expect } from 'vitest'
import { lexer } from '../../utils/lexer'
import cst_parse from '../../parser/cst'
import ast_parse from '../../parser/ast'
import { ast_data, File } from '../../utils'
import check from '../../check'

function check_code(code: string): string[] {
    const file = ast_parse(cst_parse(lexer(code)) as ast_data) as File
    try {
        check([file])
        return []
    } catch (e) {
        return (e as Error).message.split('\n')
    }
}

describe('check 端到端', () => {
    it('正确代码无错误', () => {
        const errors = check_code('public add:number(a:number,b:number){return a+b;}\n')
        expect(errors).toEqual([])
    })

    it('未定义变量报错', () => {
        const errors = check_code('public main:void(){return x;}\n')
        expect(errors.join()).toContain('x is not defined')
    })

    it('类型错误: 字符串 + 数字', () => {
        const errors = check_code('public main:void(){var y:number=1+"a";}\n')
        expect(errors.join()).toContain('not number')
    })

    it('赋值类型不匹配报错', () => {
        const errors = check_code('public main:void(a:number){a="str";}\n')
        expect(errors.join()).toContain('not assignable')
    })

    it('赋值类型匹配无错误', () => {
        const errors = check_code('public main:void(a:number){a=1;}\n')
        expect(errors).toEqual([])
    })

    it('重名类报错', () => {
        const errors = check_code('public Foo:class{}\npublic Foo:class{}\n')
        expect(errors.join()).toContain('is defined')
    })

    it('void 函数 return 值报错', () => {
        const errors = check_code('public main:void(){return 1;}\n')
        expect(errors.join()).toContain('return type mismatch')
    })

    it('if 条件非 boolean 报错', () => {
        const errors = check_code('public main:void(){if(1){return;}}\n')
        expect(errors.join()).toContain('condition is not boolean')
    })

    it('break 在循环外报错,在循环内通过', () => {
        const errors = check_code('public main:void(){break;}\n')
        expect(errors.join()).toContain('break outside loop')
        const ok = check_code('public main:void(){while(true){break;}}\n')
        expect(ok).toEqual([])
    })

    it('返回类型不匹配报错', () => {
        const errors = check_code('public f:number(){return "str";}\n')
        expect(errors.join()).toContain('return type mismatch')
    })

    it('var 声明类型匹配(单元素数组)', () => {
        const errors = check_code('public main:void(){var a:number[]=[1];}\n')
        expect(errors).toEqual([])
    })

    it('throw 与 catch 类型匹配通过/不匹配报错', () => {
        expect(check_code('public main:void(){try{throw "e";}catch(e:string){return;}}\n')).toEqual([])
        const bad = check_code('public main:void(){try{throw 1;}catch(e:string){return;}}\n')
        expect(bad.join()).toContain('throw type mismatch')
    })

    it('foreach 遍历数组', () => {
        const errors = check_code('public main:void(){var a:number[]=[1];foreach(i:a){break;}}\n')
        expect(errors).toEqual([])
    })

    it('函数内 break 报错(阻断外层循环)', () => {
        const errors = check_code('public foo:void(){break;}\n')
        expect(errors.join()).toContain('break outside loop')
    })

    it('函数内 throw 无 catch 报错', () => {
        const errors = check_code('public foo:void(){throw 1;}\n')
        expect(errors.join()).toContain('throw without catch')
    })

    it('lambda body 命令检查', () => {
        // 正确 lambda
        expect(check_code(
            'public main:void(){var f:(x:number)=>number=(x:number)=>number{return x+1;};}\n'
        )).toEqual([])
        // lambda body return 类型不匹配
        expect(check_code(
            'public main:void(){var f:(x:number)=>number=(x:number)=>number{return "str";};}\n'
        ).join()).toContain('return type mismatch')
        // lambda body 未定义变量
        expect(check_code(
            'public main:void(){var f:(x:number)=>number=(x:number)=>number{return y;};}\n'
        ).join()).toContain('y is not defined')
    })
})
