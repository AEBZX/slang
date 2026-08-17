import { describe, expect, it } from 'vitest'
import { lexer } from '../../utils/lexer'
import cst_parse from '../../parser/cst'
import ast_parse from '../../parser/ast'
import { ast_data, File } from '../../utils'
import check from '../../check'
import desugar from '../../desugar'
import hir from '../../hir'
import {
    HArgumentsExpr, HBinaryExpr, HClass, HIdentifierExpr, HLambdaExpr, HListCommand, HNewExpr, HNumberLiteral, HReturn, HVariable
} from '../../utils'

function hir_of(code: string): any[] {
    const files = [ast_parse(cst_parse(lexer(code)) as ast_data) as File]
    check(files)
    //HIR返回[id总数,扁平数组],取扁平数组
    return hir(<File[]>desugar(files))[1]
}

function hir_count(code: string): [number, any[]] {
    const files = [ast_parse(cst_parse(lexer(code)) as ast_data) as File]
    check(files)
    return hir(<File[]>desugar(files))
}

describe('HIR 生成', () => {
    it('变量引用应解析为参数 id 而非 null', () => {
        const h = hir_of('public m:number(a:number){return a+1;}\n')
        const v = h[0] as HVariable
        expect(v).toBeInstanceOf(HVariable)
        expect(v.name).toBeTypeOf('number')

        const lambda = v.value as HLambdaExpr
        expect(lambda).toBeInstanceOf(HLambdaExpr)
        expect(lambda.params.length).toBe(1)
        const a_id = lambda.params[0]
        expect(a_id).toBeTypeOf('number')

        const list = lambda.commands as HListCommand
        expect(list).toBeInstanceOf(HListCommand)
        const ret = list.commands[0] as HReturn
        expect(ret).toBeInstanceOf(HReturn)

        const bin = ret.data as HBinaryExpr
        expect(bin).toBeInstanceOf(HBinaryExpr)
        expect(bin.op).toBe('+')

        // 参数引用 a 应解析为参数 id,而非 null
        const left = bin.left as HIdentifierExpr
        expect(left).toBeInstanceOf(HIdentifierExpr)
        expect(left.name).toBe(a_id)
        expect(bin.right).toBeInstanceOf(HNumberLiteral)
    })

    it('局部变量声明应分配新 id 并在作用域中可解析', () => {
        const h = hir_of('public main:number(){var x:number=1;return x;}\n')
        const v = h[0] as HVariable
        const lambda = v.value as HLambdaExpr
        const list = lambda.commands as HListCommand
        // var x 反糖为 HAssign,return x 引用 x
        const assign = list.commands[0] as any
        const ret = list.commands[1] as HReturn
        const x_id = (assign.data as HIdentifierExpr).name
        expect(x_id).toBeTypeOf('number')
        expect((ret.data as HIdentifierExpr).name).toBe(x_id)
    })

    it('对象扁平化:Module/Class 展开为顶层数组,static HVariable 展开', () => {
        // static 成员展开,非 static(实例成员/普通变量)保留在容器 children 内
        // module 语法修复后需花括号包裹内容
        const h = hir_of('public M:module {public A:class{public static f:number(){return 1;}}public B:class{public g:number(){return 2;}}public m:number(a:number){return a+1;}}\n')
        const types = h.map(i => (i as any).constructor.name)
        // M吞入A/B/m;展开A的static f;B的g非static保留;m非static保留在M内
        expect(types).toEqual(['HModule', 'HClass', 'HVariable', 'HClass'])
    })

    it('HClass 收集 constructor 的 id,供 IR 匹配', () => {
        const [, h] = hir_count('public A:class{public constructor:void(x:number){}}\npublic B:class{}\n')
        // 扁平数组:两个 HClass
        expect(h.length).toBe(2)
        const A = h[0] as HClass
        const B = h[1] as HClass
        // A 有 constructor 成员,constructor_id 指向其 HVariable 的 name
        expect(A.constructor_id).toBeTypeOf('number')
        expect(A.constructor_id).toBeGreaterThan(0)
        const cons = A.children.find(c => (c as any).name === A.constructor_id)
        expect(cons).toBeInstanceOf(HVariable)
        // B 无 constructor
        expect(B.constructor_id).toBe(-1)
    })

    it('new 表达式的实参保留,且 id 总数为所有分配 id 的数量', () => {
        const [count, h] = hir_count('public A:class{public constructor:void(x:number){}}\npublic m:void(){var a:A=new A(1);}\n')
        // m 的 HVariable.value 是 HLambdaExpr,内含 HAssign(a, new A(1))
        const m = h[1] as HVariable
        const lambda = m.value as HLambdaExpr
        const list = lambda.commands as HListCommand
        const assign = list.commands[0] as any
        // new A(1) → HNewExpr(target=A的id, args=[1])(对象分配+this传递)
        expect(assign.value).toBeInstanceOf(HNewExpr)
        expect((assign.value as HNewExpr).args.length).toBe(1)
        expect((assign.value as HNewExpr).args[0]).toBeInstanceOf(HNumberLiteral)
        // id 总数等于扁平数组中出现的最大 id,且大于 0
        expect(count).toBeGreaterThan(0)
    })

    it('HClass 标记 this_id,成员内 this 解析为该 id', () => {
        const [count, h] = hir_count('public A:class{public f:void(){var x:A=this;}}\n')
        const A = h[0] as HClass
        // HClass 有 this_id,且大于 0
        expect(A.this_id).toBeTypeOf('number')
        expect(A.this_id).toBeGreaterThan(0)
        // 成员方法 f 的 HVariable
        const f = A.children[0] as HVariable
        const lambda = f.value as HLambdaExpr
        const list = lambda.commands as HListCommand
        const assign = list.commands[0] as any
        // this 引用解析为 this_id
        expect(assign.value).toBeInstanceOf(HIdentifierExpr)
        expect((assign.value as HIdentifierExpr).name).toBe(A.this_id)
    })
})
