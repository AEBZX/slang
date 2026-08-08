import { describe, it, expect } from 'vitest'
import { lexer } from '../../utils/lexer'
import cst_parse from '../../parser/cst'
import ast_parse from '../../parser/ast'
import { ast_data, BlockType, File, NumberType, PostfixExpression } from '../../utils'
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

    it('AST 节点通过符号表获得 Type', () => {
        const file = ast_parse(cst_parse(lexer('public add:number(a:number,b:number){return a+b;}\n')) as ast_data) as File
        check([file])
        const fn = file.children[0] as any
        expect(fn.type).toBeInstanceOf(BlockType)
        const ret = (fn.commands as any).commands[0] as any
        expect(ret.data.type).toBeInstanceOf(NumberType)
        expect(ret.data.left.type).toBeInstanceOf(NumberType)
    })

    it('赋值左值检查', () => {
        // 可操作的左值:变量/成员/索引
        expect(check_code('public m:void(x:number){x=1;}\n')).toEqual([])
        expect(check_code('public A:class{public f:var:number;}\npublic m:void(x:A){x.f=1;}\n')).toEqual([])
        expect(check_code('public m:void(a:number[],i:number){a[i]=1;}\n')).toEqual([])
        // 不可操作的左值:函数返回值/字面量/算术结果
        expect(check_code('public A:class{public f:number(){return 1;}}\npublic m:void(x:A){x.f()=1;}\n').join()).toContain('not assignable')
        expect(check_code('public m:void(){1=2;}\n').join()).toContain('not assignable')
        expect(check_code('public m:void(x:number,y:number){x+y=1;}\n').join()).toContain('not assignable')
        // 解引用链可赋值,取地址不可
        expect(check_code('public m:void(p:number*){*p=1;}\n')).toEqual([])
        expect(check_code('public m:void(p:number**){**p=1;}\n')).toEqual([])
        expect(check_code('public m:void(x:number){&x=1;}\n').join()).toContain('not assignable')
    })

    it('PostfixExpression 记录逐步类型', () => {
        const file = ast_parse(cst_parse(lexer(
            'public A:class{public b:var:number[];}\npublic m:void(x:A){var y:number=x.b[0];}\n'
        )) as ast_data) as File
        check([file])
        const m = file.children[1] as any
        const vd = (m.commands as any).commands[0] as any
        const postfix = vd.value as PostfixExpression
        // types 记录 primary 应用每个 postfix 后的类型:x.b → FixType, x.b[0] → NumberType
        expect(postfix.types.map(t => t.constructor.name)).toEqual(['FixType', 'NumberType'])
    })

    it('implements 链:接口的函数与变量必须实现', () => {
        // 缺方法
        expect(check_code(
            'public I:interface{public f:void(){}}\npublic A:class implements I{public g:void(){}}\n'
        ).join()).toContain('must implement function f')
        // 完整实现
        expect(check_code(
            'public I:interface{public f:void(){}}\npublic B:class implements I{public f:void(){}}\n'
        )).toEqual([])
        // 缺变量
        expect(check_code(
            'public I:interface{public x:var:number;}\npublic C:class implements I{}\n'
        ).join()).toContain('must implement variable x')
        // 含变量
        expect(check_code(
            'public I:interface{public x:var:number;}\npublic D:class implements I{public x:var:number;}\n'
        )).toEqual([])
        // 接口继承链传递
        expect(check_code(
            'public J:interface{public f:void(){}}\npublic I:interface implements J{}\npublic E:class implements I{public f:void(){}}\n'
        )).toEqual([])
    })

    it('嵌套类绝对路径与成员访问', () => {
        const file = ast_parse(cst_parse(lexer('public A:class{public B:class{}}\n')) as ast_data) as File
        check([file])
        const A = file.children[0] as any
        const B = A.children[0] as any
        expect((A.type as BlockType).local).toEqual(['A'])
        expect((B.type as BlockType).local).toEqual(['A', 'B'])
        // 成员访问与调用
        expect(check_code('public A:class{public f:void(){}}\npublic m:void(x:A){x.f();}\n')).toEqual([])
    })

    it('string 索引与 foreach', () => {
        expect(check_code('public m:string(s:string){return s[0];}\n')).toEqual([])
        expect(check_code('public m:void(s:string,i:number){var c:string=s[i];}\n')).toEqual([])
        expect(check_code('public m:void(s:string){foreach(c:s){return;}}\n')).toEqual([])
    })

    it('map 键必须是字符串', () => {
        // m['a'] 字符串字面量键通过
        expect(check_code('public foo:number(m:number{}){return m["a"];}\n')).toEqual([])
        expect(check_code('public foo:void(m:number{}){m["a"]=1;}\n')).toEqual([])
        // m[key] string 变量键通过
        expect(check_code('public foo:number(m:number{},key:string){return m[key];}\n')).toEqual([])
        expect(check_code('public foo:void(m:number{},key:string){m[key]=1;}\n')).toEqual([])
        // m[1] 数字键报错
        expect(check_code('public foo:number(m:number{}){return m[1];}\n').join()).toContain('map key must be string')
        // m[a] 未定义标识符报错
        expect(check_code('public foo:number(m:number{}){return m[a];}\n').join()).toContain('a is not defined')
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

    it('up 外层引用与 up.up 链式', () => {
        // 单层类 up 指向自己
        expect(check_code('public A:class{public f:A(){return up;}}\n')).toEqual([])
        // 单层 up.up 保持顶层
        expect(check_code('public A:class{public f:A(){return up.up;}}\n')).toEqual([])
        // 嵌套类 up 指向外层
        expect(check_code('public A:class{public B:class{public f:A(){return up;}}}\n')).toEqual([])
        // 嵌套类 up.up 再向上
        expect(check_code('public A:class{public B:class{public f:A(){return up.up;}}}\n')).toEqual([])
        // 三层 up.up.up
        expect(check_code('public A:class{public B:class{public C:class{public f:A(){return up.up.up;}}}}\n')).toEqual([])
        // up 类型不匹配时报错
        expect(check_code('public A:class{public f:void(){var x:number=up;}}\n').join()).toContain('not assignable')
    })

    it('this 成员内指向当前类', () => {
        expect(check_code('public A:class{public f:A(){return this;}}\n')).toEqual([])
        expect(check_code('public A:class{public f:void(){var a:A=this;}}\n')).toEqual([])
        // this 类型不匹配时报错
        expect(check_code('public A:class{public f:void(){var x:number=this;}}\n').join()).toContain('not assignable')
    })

    it('new 表达式检查:无/有 constructor、参数匹配', () => {
        // 无 constructor 的类也可 new
        expect(check_code('public A:class{}\npublic m:void(){var a:A=new A();}\n')).toEqual([])
        // 有 constructor,参数匹配通过
        expect(check_code(
            'public A:class{public constructor:void(x:number){}}\npublic m:void(){var a:A=new A(1);}\n'
        )).toEqual([])
        // 参数个数不匹配报错
        expect(check_code(
            'public A:class{public constructor:void(x:number){}}\npublic m:void(){var a:A=new A();}\n'
        ).join()).toContain('new can only be applied to class')
        // new 的返回值类型可用(赋值给 A 类型变量)
        expect(check_code(
            'public A:class{}\npublic m:A(){var a:A=new A();return a;}\n'
        )).toEqual([])
    })
})
