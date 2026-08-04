import { describe, it, expect } from 'vitest'
import { lexer } from '../../utils/lexer'
import cst_parse from '../../parser/cst'
import ast_parse from '../../parser/ast'
import {
    ArrayFix,
    ast_data,
    BinaryExpression,
    Class,
    File,
    FixType,
    Function,
    IfStatement,
    Link,
    ListCommand,
    MapFix,
    NumberLiteral,
    Return,
    VarDeclaration,
    Variable
} from '../../utils'

// 辅助: code -> cst -> ast
function parse_ast(code: string): any {
    return ast_parse(cst_parse(lexer(code)) as ast_data)
}

// ==================== 顶层 File ====================
describe('File 转换', () => {
    it('links 与 blocks 完整转换', () => {
        const ast = parse_ast(
            'link std.io.print as print;\n' +
            'public main:void(a:number){return;}\n' +
            'public Foo:class{}\n'
        ) as File
        expect(ast).toBeInstanceOf(File)
        expect(ast.links).toHaveLength(1)
        const link = ast.links[0] as Link
        expect(link).toBeInstanceOf(Link)
        expect(link.module).toEqual(['std', 'io', 'print'])
        expect(link.as).toBe('print')
        expect(ast.children).toHaveLength(2)
        expect(ast.children[0]).toBeInstanceOf(Function)
        expect(ast.children[1]).toBeInstanceOf(Class)
    })

    it('无 link 的空文件', () => {
        const ast = parse_ast('') as File
        expect(ast).toBeInstanceOf(File)
        expect(ast.links).toHaveLength(0)
        expect(ast.children).toHaveLength(0)
    })

    it('ASTTree 携带行信息(与 ast_data.line 一致)', () => {
        const ast = parse_ast(
            'link std.io.print as print;\n' +
            'public main:void(){return;}\n'
        ) as File
        expect(ast.line).toBeInstanceOf(Array)
        expect(ast.line.length).toBeGreaterThan(0)
        const fn = ast.children[0] as Function
        expect(fn.line.length).toBeGreaterThan(0)
        // 行信息应与源码行对应
        expect(ast.line.join('')).toContain('public main:void')
    })
})

// ==================== Function ====================
describe('Function 转换', () => {
    it('返回类型、参数、命令体', () => {
        const ast = parse_ast(
            'public main:void(a:number,b:string){return;}\n'
        ) as File
        const fn = ast.children[0] as Function
        expect(fn).toBeInstanceOf(Function)
        expect(fn.name).toBe('main')
        expect(fn.return_type?.constructor?.name).toBe('VoidType')
        expect([...(fn.params?.keys() || [])]).toEqual(['a', 'b'])
        expect(fn.commands).toBeInstanceOf(ListCommand)
        const cmds = (fn.commands as ListCommand).commands
        expect(cmds[0]).toBeInstanceOf(Return)
    })

    it('空参数函数', () => {
        const ast = parse_ast('public main:void(){return;}\n') as File
        const fn = ast.children[0] as Function
        expect(fn.params?.size).toBe(0)
    })

    it('嵌套块(递归 t 规则无状态污染)', () => {
        const ast = parse_ast(
            'public main:void(){var x:number=1;if(x){return;}else{var y:number=2;}}\n'
        ) as File
        const fn = ast.children[0] as Function
        const cmds = (fn.commands as ListCommand).commands
        const vd = cmds[0] as VarDeclaration
        expect(vd.name).toBe('x')
        expect((vd.value as NumberLiteral).value).toBe('1')
        const iff = cmds[1] as IfStatement
        expect(iff.condition?.constructor?.name).toBe('IdentifierExpr')
        expect((iff.commands as ListCommand).commands[0]).toBeInstanceOf(Return)
        expect((iff.else_ as ListCommand).commands[0]).toBeInstanceOf(VarDeclaration)
    })
})

// ==================== Variable ====================
describe('Variable 转换', () => {
    it('类型与初值', () => {
        const ast = parse_ast('public bar:var:number=5;\n') as File
        const v = ast.children[0] as Variable
        expect(v.name).toBe('bar')
        expect(v.t?.constructor?.name).toBe('NumberType')
        expect((v.value as NumberLiteral).value).toBe('5')
    })

    it('无初值', () => {
        const ast = parse_ast('public bar:var:number;\n') as File
        const v = ast.children[0] as Variable
        expect(v.name).toBe('bar')
        expect(v.value).toBeNull()
    })

    it('数组类型 FixType', () => {
        const ast = parse_ast('public arr:var:number[];\n') as File
        const v = ast.children[0] as Variable
        expect(v.t).toBeInstanceOf(FixType)
        const fix = (v.t as FixType).fix
        expect(fix[0]).toBeInstanceOf(ArrayFix)
    })

    it('map 类型 string{}', () => {
        const ast = parse_ast('public y:var:string{};\n') as File
        const v = ast.children[0] as Variable
        expect(v.t).toBeInstanceOf(FixType)
        expect((v.t as FixType).fix[0]).toBeInstanceOf(MapFix)
    })

    it('限定名类型 std.io', () => {
        const ast = parse_ast('public y:var:std.io;\n') as File
        const v = ast.children[0] as Variable
        expect(v.t?.constructor?.name).toBe('ClassType')
        expect((v.t as any).local).toEqual(['std', 'io'])
    })

    it('括号类型 (number)', () => {
        const ast = parse_ast('public y:var:(number);\n') as File
        const v = ast.children[0] as Variable
        expect(v.t?.constructor?.name).toBe('NumberType')
    })

    it('lambda 类型 (x:number)=>number', () => {
        const ast = parse_ast('public y:var:(x:number)=>number;\n') as File
        const v = ast.children[0] as Variable
        expect(v.t?.constructor?.name).toBe('LambdaType')
        expect([...(v.t as any).params.keys()]).toEqual(['x'])
        expect((v.t as any).returnType?.constructor?.name).toBe('NumberType')
    })
})

// ==================== 表达式 ====================
describe('表达式转换', () => {
    it('二元表达式 a+b', () => {
        const ast = parse_ast(
            'public main:void(){var x:number=a+b;}\n'
        ) as File
        const fn = ast.children[0] as Function
        const vd = (fn.commands as ListCommand).commands[0] as VarDeclaration
        expect(vd.value).toBeInstanceOf(BinaryExpression)
        const bin = vd.value as BinaryExpression
        expect(bin.constructor.name).toBe('AdditiveExpression')
        expect((bin.left as any).name).toBe('a')
        expect((bin.right as any).name).toBe('b')
    })

    it('优先级 a+b*c', () => {
        const ast = parse_ast(
            'public main:void(){var x:number=a+b*c;}\n'
        ) as File
        const fn = ast.children[0] as Function
        const vd = (fn.commands as ListCommand).commands[0] as VarDeclaration
        const bin = vd.value as BinaryExpression
        expect(bin.constructor.name).toBe('AdditiveExpression')
        expect((bin.right as BinaryExpression).constructor.name).toBe('MultiplicativeExpression')
    })

    it('函数调用 fn(a,b)', () => {
        const ast = parse_ast(
            'public main:void(){fn(a,b);}\n'
        ) as File
        const fn = ast.children[0] as Function
        const call = (fn.commands as ListCommand).commands[0] as any
        expect(call.constructor.name).toBe('Call')
        expect((call.data as any).constructor.name).toBe('PostfixExpression')
        expect((call.data as any).postfix?.[0]?.constructor?.name).toBe('ArgumentsPostfix')
    })
})

// ==================== Class ====================
describe('Class 转换', () => {
    it('空体与带 implements', () => {
        const ast = parse_ast(
            'public Foo:class{}\n' +
            'public Bar:class implements std.io{}\n'
        ) as File
        expect((ast.children[0] as Class).implement).toEqual([])
        const bar = ast.children[1] as Class
        expect(bar.implement).toEqual(['std', 'io'])
        expect(bar.children).toEqual([])
    })

    it('body 中的函数', () => {
        const ast = parse_ast(
            'public Foo:class{public foo:void(){return;}}\n'
        ) as File
        const cls = ast.children[0] as Class
        expect(cls.children[0]).toBeInstanceOf(Function)
    })
})

// ==================== 块命令 ====================
describe('块命令转换', () => {
    function commands(code: string): any[] {
        const ast = parse_ast(code) as File
        const fn = ast.children[0] as Function
        return ((fn.commands as ListCommand).commands as any[]) || []
    }

    it('switch: case 与 default', () => {
        const cmds = commands(
            'public main:void(){switch(x){case 1=>{return;}default=>{break;}}}\n'
        )
        const sw = cmds[0] as any
        expect(sw.constructor.name).toBe('SwitchStatement')
        expect(sw.case_list).toHaveLength(1)
        expect(sw.case_list[0].condition?.constructor?.name).toBe('NumberLiteral')
        expect(sw.case_list[0].commands).toBeInstanceOf(ListCommand)
        expect(sw.default_).toBeInstanceOf(ListCommand)
    })

    it('try-catch-finally(带类型 catch)', () => {
        const cmds = commands(
            'public main:void(){try{return;}catch(e:number){return;}finally{break;}}\n'
        )
        const tr = cmds[0] as any
        expect(tr.constructor.name).toBe('TryStatement')
        expect(tr.commands).toBeInstanceOf(ListCommand)
        expect(tr.catch_.iden).toBe('e')
        expect(tr.catch_.type?.constructor?.name).toBe('NumberType')
        expect(tr.catch_.command).toBeInstanceOf(ListCommand)
        expect(tr.finally_).toBeInstanceOf(ListCommand)
    })

    it('try-catch 无类型', () => {
        const cmds = commands(
            'public main:void(){try{return;}catch(e){return;}}\n'
        )
        const tr = cmds[0] as any
        expect(tr.constructor.name).toBe('TryStatement')
        expect(tr.catch_.iden).toBe('e')
        expect(tr.catch_.type).toBeNull()
        expect(tr.finally_).toBeNull()
    })

    it('for: init/condition/step/body', () => {
        const cmds = commands(
            'public main:void(){for(var i:number=0;i<10;i++){break;}}\n'
        )
        const fo = cmds[0] as any
        expect(fo.constructor.name).toBe('ForStatement')
        expect(fo.init).toHaveLength(1)
        expect(fo.init[0]).toBeInstanceOf(VarDeclaration)
        expect(fo.condition?.constructor.name).toBe('LessExpression')
        expect(fo.step).toHaveLength(1)
        expect(fo.commands).toBeInstanceOf(ListCommand)
    })

    it('while', () => {
        const cmds = commands(
            'public main:void(){while(x){break;}}\n'
        )
        const wh = cmds[0] as any
        expect(wh.constructor.name).toBe('WhileStatement')
        expect(wh.condition?.constructor?.name).toBe('IdentifierExpr')
        expect(wh.commands).toBeInstanceOf(ListCommand)
    })

    it('do-while', () => {
        const cmds = commands(
            'public main:void(){do{break;}while(x);}\n'
        )
        const dw = cmds[0] as any
        expect(dw.constructor.name).toBe('DoWhileStatement')
        expect(dw.condition?.constructor?.name).toBe('IdentifierExpr')
    })

    it('复合赋值 x+=5', () => {
        const cmds = commands(
            'public main:void(){x+=5;}\n'
        )
        const as = cmds[0] as any
        expect(as.constructor.name).toBe('AddAssign')
        expect((as.data as any).name).toBe('x')
        expect((as.value as NumberLiteral).value).toBe('5')
    })
})
