import { describe, it, expect } from 'vitest'
import { lexer } from '../../utils/lexer'
import cst_parse from '../../parser/cst'
import ast_parse from '../../parser/ast'
import {
    AAssign,
    AdditiveExpression,
    ast_data,
    File,
    ForStatement,
    IfStatement,
    LambdaType,
    ListCommand,
    Variable,
    WhileStatement
} from '../../utils'
import check from '../../check'
import desugar from '../../desugar'

function desugar_code(code: string): any {
    const files = [ast_parse(cst_parse(lexer(code)) as ast_data) as File]
    check(files)
    return desugar(files)
}

function fn_body(files: any): any[] {
    const fn = files[0].children[0]
    return (fn.value.body.commands) || []
}

describe('desugar 语法糖转换', () => {
    it('函数转换为 Variable(LambdaType)', () => {
        const out = desugar_code('public m:number(){return 1;}\n')
        const fn = out[0].children[0]
        expect(fn).toBeInstanceOf(Variable)
        expect(fn.t).toBeInstanceOf(LambdaType)
        expect(fn.value.body).toBeInstanceOf(ListCommand)
    })

    it('复合赋值 x+=1 → AAssign(x, x+1)', () => {
        const out = desugar_code('public m:void(x:number){x+=1;}\n')
        const cmds = fn_body(out)
        expect(cmds[0]).toBeInstanceOf(AAssign)
        expect(cmds[0].value).toBeInstanceOf(AdditiveExpression)
    })

    it('do-while → while', () => {
        const out = desugar_code('public m:void(){do{break;}while(true);}\n')
        const cmds = fn_body(out)
        expect(cmds[0]).toBeInstanceOf(ListCommand)
        expect(cmds[0].commands[1]).toBeInstanceOf(WhileStatement)
    })

    it('foreach → ForStatement', () => {
        const out = desugar_code(
            'public m:void(){var a:number[]=[1];foreach(i:a){break;}}\n'
        )
        const cmds = fn_body(out)
        const inner = cmds[1]
        expect(inner).toBeInstanceOf(ListCommand)
        expect(inner.commands[1]).toBeInstanceOf(ForStatement)
    })

    it('switch → if 链', () => {
        const out = desugar_code(
            'public m:void(x:number){switch(x){case 1=>{return;}}}\n'
        )
        const cmds = fn_body(out)
        expect(cmds[0]).toBeInstanceOf(IfStatement)
    })
})
