import {describe, expect, it} from 'vitest'
import {run_to_desugar} from '../helpers'
import {LabelCommand, ListCommand, Variable} from '../../src/utils'

describe('desugar 管线集成', () => {
    it('check 后的 AST 被降糖:函数变 Variable(name@index)', () => {
        const desugared = run_to_desugar('app: module { f: void() { } }') as any
        const fn_var = desugared[0].children[0].children[0] as Variable
        expect(fn_var.name).toBe('f@0')
    })

    it('while 降糖为 label/goto/if 链', () => {
        const desugared = run_to_desugar('app: module { main: void() { while (1) { } } }') as any
        const body = desugared[0].children[0].children[0].value.body
        const flat = body.commands[0] as ListCommand
        expect(flat.commands[0]).toBeInstanceOf(LabelCommand)
        expect(flat.commands[0].name).toBe('while')
    })
})
