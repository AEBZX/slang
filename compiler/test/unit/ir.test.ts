import { describe, it, expect } from 'vitest'
import { ASMFactory, BinFactory, default as ir } from '../../utils/lib/ir'
import { asm, asm_command, asm_args, asm_type, ast_data, bin } from '../../utils/data'

// ==================== 辅助函数 ====================
function makeAst(type: string, children: (ast_data | string)[] = []): ast_data {
    return { type, line: [], comment: '', children }
}

function makeAsmCommand(name: asm_type, args: asm_args[] = []): asm_command {
    return { name, args }
}

function makeAsmArgs(value: number, type: 'value' | 'reg' = 'value'): asm_args {
    return { type, value }
}

function makeAsm(code: Map<string, asm_command[]> = new Map()): asm {
    return {
        code,
        data: new Map(),
        pool: new Map()
    }
}

// ==================== ASMFactory ====================
describe('ASMFactory', () => {
    it('初始化: visit 为空 Map', () => {
        const factory = new ASMFactory()
        expect(factory.visit).toBeInstanceOf(Map)
        expect(factory.visit.size).toBe(0)
    })

    it('visitor: 调用已注册的 visitor 函数, 传入 ast/factory/asm', () => {
        const factory = new ASMFactory()
        const ast = makeAst('NumberLiteral', ['42'])
        let capturedAst: ast_data | undefined
        let capturedFactory: ASMFactory | undefined
        let capturedAsm: asm | undefined

        factory.visit.set('NumberLiteral', (a, f, asm) => {
            capturedAst = a
            capturedFactory = f
            capturedAsm = asm
        })

        const result = factory.visitor(ast)

        expect(capturedAst).toBe(ast)
        expect(capturedFactory).toBe(factory)
        expect(capturedAsm).toBe(result)
        expect(result.code).toBeInstanceOf(Map)
        expect(result.data).toBeInstanceOf(Map)
        expect(result.pool).toBeInstanceOf(Map)
    })

    it('visitor: 返回的 asm 对象各字段独立初始化', () => {
        const factory = new ASMFactory()
        factory.visit.set('Test', () => {})
        const result = factory.visitor(makeAst('Test'))
        expect(result.code).toBeInstanceOf(Map)
        expect(result.code.size).toBe(0)
        expect(result.data).toBeInstanceOf(Map)
        expect(result.data.size).toBe(0)
        expect(result.pool).toBeInstanceOf(Map)
        expect(result.pool.size).toBe(0)
    })

    it('visitor: 可在 visitor 中修改 asm.code', () => {
        const factory = new ASMFactory()
        factory.visit.set('Assign', (data, factory, asm) => {
            const cmd = makeAsmCommand(asm_type.mov, [makeAsmArgs(10)])
            asm.code.set('main', [cmd])
        })

        const result = factory.visitor(makeAst('Assign'))
        expect(result.code.has('main')).toBe(true)
        expect(result.code.get('main')[0].name).toBe(asm_type.mov)
        expect(result.code.get('main')[0].args[0].value).toBe(10)
    })

    it('visitor: 可在 visitor 中修改 asm.data', () => {
        const factory = new ASMFactory()
        factory.visit.set('Var', (data, factory, asm) => {
            asm.data.set('x', 0)
            asm.data.set(0x100, 42)
        })

        const result = factory.visitor(makeAst('Var'))
        expect(result.data.get('x')).toBe(0)
        expect(result.data.get(0x100)).toBe(42)
    })

    it('visitor: 可在 visitor 中修改 asm.pool', () => {
        const factory = new ASMFactory()
        factory.visit.set('String', (data, factory, asm) => {
            asm.pool.set(0, 'hello')
            asm.pool.set(1, 100)
        })

        const result = factory.visitor(makeAst('String'))
        expect(result.pool.get(0)).toBe('hello')
        expect(result.pool.get(1)).toBe(100)
    })

    it('visitor: 注册多个不同的 visitor, 根据 ast.type 分发', () => {
        const factory = new ASMFactory()
        const calls: string[] = []

        factory.visit.set('A', () => { calls.push('A') })
        factory.visit.set('B', () => { calls.push('B') })
        factory.visit.set('C', () => { calls.push('C') })

        factory.visitor(makeAst('A'))
        factory.visitor(makeAst('B'))
        factory.visitor(makeAst('C'))
        factory.visitor(makeAst('A'))

        expect(calls).toEqual(['A', 'B', 'C', 'A'])
    })

    it('visitor: 使用 ast.children 中的数据生成 asm 指令', () => {
        const factory = new ASMFactory()
        factory.visit.set('BinaryExpr', (data, factory, asm) => {
            expect(data.children).toHaveLength(3)
            expect(data.children[0]).toBe('x')
            expect(data.children[1]).toBe('+')
            expect(data.children[2]).toBe('10')

            asm.code.set('expr', [
                makeAsmCommand(asm_type.add, [makeAsmArgs(10)])
            ])
        })

        const ast = makeAst('BinaryExpr', ['x', '+', '10'])
        const result = factory.visitor(ast)
        expect(result.code.get('expr')[0].name).toBe(asm_type.add)
    })
})

// ==================== BinFactory ====================
describe('BinFactory', () => {
    it('初始化: block 和 command 正确设置', () => {
        const blockFn = (name: string, code: asm_command[]) => []
        const factory = new BinFactory(blockFn)
        expect(factory.block).toBe(blockFn)
        expect(factory.command).toBeInstanceOf(Map)
        expect(factory.command.size).toBe(0)
    })

    it('register: 注册 command converter', () => {
        const factory = new BinFactory(() => [])
        const converter = (asm: asm_command) => ({ name: 0, args: [1, 2, 3] })
        factory.register(asm_type.mov, converter)

        expect(factory.command.has(asm_type.mov)).toBe(true)
        expect(factory.command.get(asm_type.mov)).toBe(converter)
    })

    it('register: 注册多个不同 asm_type 的 converter', () => {
        const factory = new BinFactory(() => [])
        const c1 = () => ({ name: 0, args: [] })
        const c2 = () => ({ name: 1, args: [] })
        const c3 = () => ({ name: 2, args: [] })

        factory.register(asm_type.add, c1)
        factory.register(asm_type.sub, c2)
        factory.register(asm_type.mul, c3)

        expect(factory.command.size).toBe(3)
        expect(factory.command.get(asm_type.add)).toBe(c1)
        expect(factory.command.get(asm_type.sub)).toBe(c2)
        expect(factory.command.get(asm_type.mul)).toBe(c3)
    })

    it('register: 同名 asm_type 覆盖旧 converter', () => {
        const factory = new BinFactory(() => [])
        const oldFn = () => ({ name: 0, args: [] })
        const newFn = () => ({ name: 1, args: [] })

        factory.register(asm_type.mov, oldFn)
        factory.register(asm_type.mov, newFn)

        expect(factory.command.size).toBe(1)
        expect(factory.command.get(asm_type.mov)).toBe(newFn)
    })

    it('generate: 空 asm → 返回空 bin', () => {
        const blockFn = (name: string, code: asm_command[]) => {
            return code.map(c => ({ name: 0, args: [] }))
        }
        const factory = new BinFactory(blockFn)
        const result = factory.generate(makeAsm())

        expect(result.bin).toEqual([])
        expect(result.pool).toBeInstanceOf(Map)
    })

    it('generate: 单个 block 转换为 bin_command[]', () => {
        const factory = new BinFactory((name, code, visit) => {
            return code.map(c => visit(c))
        })
        factory.register(asm_type.mov, (asm) => ({ name: 0, args: asm.args.map(a => a.value) }))
        factory.register(asm_type.add, (asm) => ({ name: 1, args: asm.args.map(a => a.value) }))

        const asm: asm = {
            code: new Map([['main', [
                makeAsmCommand(asm_type.mov, [makeAsmArgs(1)]),
                makeAsmCommand(asm_type.add, [makeAsmArgs(2), makeAsmArgs(3)])
            ]]]),
            data: new Map(),
            pool: new Map()
        }

        const result = factory.generate(asm)
        expect(result.bin).toHaveLength(2)
        expect(result.bin[0].name).toBe(0)
        expect(result.bin[0].args).toEqual([1])
        expect(result.bin[1].name).toBe(1)
        expect(result.bin[1].args).toEqual([2, 3])
    })

    it('generate: 多个 block 拼接为平数组', () => {
        const factory = new BinFactory((name, code) => {
            return code.map(c => ({ name: 0, args: c.args.map(a => a.value) }))
        })
        factory.register(asm_type.mov, (asm) => ({ name: 0, args: asm.args.map(a => a.value) }))

        const asm: asm = {
            code: new Map([
                ['block1', [makeAsmCommand(asm_type.mov, [makeAsmArgs(1)])]],
                ['block2', [makeAsmCommand(asm_type.mov, [makeAsmArgs(2)])]],
                ['block3', [makeAsmCommand(asm_type.mov, [makeAsmArgs(3)])]]
            ]),
            data: new Map(),
            pool: new Map()
        }

        const result = factory.generate(asm)
        expect(result.bin).toHaveLength(3)
        expect(result.bin[0].args).toEqual([1])
        expect(result.bin[1].args).toEqual([2])
        expect(result.bin[2].args).toEqual([3])
    })

    it('generate: pool 被正确传递到 bin', () => {
        const factory = new BinFactory(() => [])
        const asm: asm = {
            code: new Map(),
            data: new Map(),
            pool: new Map([[0, 'hello'], [1, 'world']])
        }

        const result = factory.generate(asm)
        expect(result.pool).toBe(asm.pool)
        expect(result.pool.get(0)).toBe('hello')
        expect(result.pool.get(1)).toBe('world')
    })

    it('generate: block 函数接收 name 和 code 参数', () => {
        const capturedNames: string[] = []
        const capturedCodes: asm_command[][] = []

        const factory = new BinFactory((name, code) => {
            capturedNames.push(name)
            capturedCodes.push(code)
            return []
        })

        const cmd1 = makeAsmCommand(asm_type.mov)
        const cmd2 = makeAsmCommand(asm_type.add)
        const asm: asm = {
            code: new Map([
                ['init', [cmd1]],
                ['main', [cmd1, cmd2]]
            ]),
            data: new Map(),
            pool: new Map()
        }

        factory.generate(asm)
        expect(capturedNames).toEqual(['init', 'main'])
        expect(capturedCodes[0]).toEqual([cmd1])
        expect(capturedCodes[1]).toEqual([cmd1, cmd2])
    })

    it('generate: block 函数的 visit 参数正确转换 asm→bin_command', () => {
        const factory = new BinFactory((name, code, visit) => {
            return code.map(c => visit(c))
        })
        factory.register(asm_type.mov, (asm) => ({ name: 0, args: [100] }))
        factory.register(asm_type.add, (asm) => ({ name: 1, args: [200] }))

        const asm: asm = {
            code: new Map([['main', [
                makeAsmCommand(asm_type.mov, [makeAsmArgs(1)]),
                makeAsmCommand(asm_type.add, [makeAsmArgs(2)])
            ]]]),
            data: new Map(),
            pool: new Map()
        }

        const result = factory.generate(asm)
        expect(result.bin[0].name).toBe(0)
        expect(result.bin[0].args).toEqual([100])
        expect(result.bin[1].name).toBe(1)
        expect(result.bin[1].args).toEqual([200])
    })
})

// ==================== 默认导出 asm 辅助函数 ====================
describe('默认导出 asm 辅助函数', () => {
    it('asm.visitor: 返回 {name, visitor}', () => {
        const fn = (data: ast_data, factory: ASMFactory, asm: asm) => {}
        const result = ir.asm.visitor('Test', fn)
        expect(result).toEqual({ name: 'Test', visitor: fn })
    })

    it('asm.factory: 创建 ASMFactory 并注册多个 visitor', () => {
        const calls: string[] = []
        const factory = ir.asm.factory([
            ir.asm.visitor('A', () => { calls.push('A') }),
            ir.asm.visitor('B', () => { calls.push('B') })
        ])

        expect(factory).toBeInstanceOf(ASMFactory)
        expect(factory.visit.has('A')).toBe(true)
        expect(factory.visit.has('B')).toBe(true)
        expect(factory.visit.size).toBe(2)

        // 验证 visitor 可被调用
        factory.visitor(makeAst('A'))
        factory.visitor(makeAst('B'))
        expect(calls).toEqual(['A', 'B'])
    })

    it('asm.factory: 空数组创建无注册 visitor 的 factory', () => {
        const factory = ir.asm.factory([])
        expect(factory).toBeInstanceOf(ASMFactory)
        expect(factory.visit.size).toBe(0)
    })
})

// ==================== 默认导出 bin 辅助函数 ====================
describe('默认导出 bin 辅助函数', () => {
    it('bin.factory: 返回 {name, visitor}', () => {
        const fn = (asm: asm_command) => ({ name: 0, args: [] })
        const result = ir.bin.factory(asm_type.mov, fn)
        expect(result).toEqual({ name: asm_type.mov, visitor: fn })
    })

    it('bin.generate: 完整流程 asm→bin 转换', () => {
        const asm: asm = {
            code: new Map([['main', [
                makeAsmCommand(asm_type.mov, [makeAsmArgs(42)]),
                makeAsmCommand(asm_type.add, [makeAsmArgs(1), makeAsmArgs(2)])
            ]]]),
            data: new Map(),
            pool: new Map([[0, 'string data']])
        }

        const blockFn = (name: string, code: asm_command[], visit: (asm: asm_command) => any) => {
            return code.map(c => visit(c))
        }

        const result = ir.bin.generate(asm, blockFn, [
            ir.bin.factory(asm_type.mov, (cmd) => ({ name: 0, args: cmd.args.map(a => a.value) })),
            ir.bin.factory(asm_type.add, (cmd) => ({ name: 1, args: cmd.args.map(a => a.value) }))
        ])

        expect(result.bin).toHaveLength(2)
        expect(result.bin[0].name).toBe(0)
        expect(result.bin[0].args).toEqual([42])
        expect(result.bin[1].name).toBe(1)
        expect(result.bin[1].args).toEqual([1, 2])
        expect(result.pool.get(0)).toBe('string data')
    })

    it('bin.generate: 空 asm + 空 factory 返回空 bin', () => {
        const result = ir.bin.generate(makeAsm(), () => [], [])
        expect(result.bin).toEqual([])
        expect(result.pool).toBeInstanceOf(Map)
    })
})

// ==================== ASM → Bin 集成流程 ====================
describe('ASM → Bin 集成流程 (完整 pipeline)', () => {
    it('ASMFactory.visitor 产生 asm → BinFactory.generate 转换为 bin', () => {
        // 1. 创建 ASMFactory 并注册 AST→ASM 转换
        const asmFactory = new ASMFactory()
        asmFactory.visit.set('AddExpr', (data, factory, asm) => {
            const cmd = makeAsmCommand(asm_type.add, [
                makeAsmArgs(10), makeAsmArgs(20)
            ])
            asm.code.set('calc', [cmd])
            asm.pool.set(0, 'add_expr')
        })

        // 2. AST → ASM
        const ast = makeAst('AddExpr', ['10', '+', '20'])
        const asmResult = asmFactory.visitor(ast)

        expect(asmResult.code.get('calc')).toHaveLength(1)
        expect(asmResult.code.get('calc')[0].name).toBe(asm_type.add)

        // 3. ASM → Bin
        const binFactory = new BinFactory((name, code, visit) => code.map(c => visit(c)))
        binFactory.register(asm_type.add, (cmd) => ({
            name: 0,
            args: cmd.args.map(a => a.value)
        }))

        const binResult = binFactory.generate(asmResult)
        expect(binResult.bin).toHaveLength(1)
        expect(binResult.bin[0].name).toBe(0)
        expect(binResult.bin[0].args).toEqual([10, 20])
        expect(binResult.pool.get(0)).toBe('add_expr')
    })

    it('使用默认导出完成完整 pipeline', () => {
        // 1. ASM Factory
        const factory = ir.asm.factory([
            ir.asm.visitor('Move', (data, factory, asm) => {
                asm.code.set('entry', [
                    makeAsmCommand(asm_type.mov, [makeAsmArgs(100)])
                ])
                asm.pool.set(0, 'move_op')
            })
        ])

        const asm = factory.visitor(makeAst('Move', ['x', '=', '100']))
        expect(asm.code.has('entry')).toBe(true)

        // 2. Bin generate
        const blockFn = (name: string, code: asm_command[], visit: (asm: asm_command) => any) => {
            return code.map(c => visit(c))
        }
        const result = ir.bin.generate(asm, blockFn, [
            ir.bin.factory(asm_type.mov, (cmd) => ({ name: 0, args: cmd.args.map(a => a.value) }))
        ])

        expect(result.bin).toHaveLength(1)
        expect(result.bin[0].args).toEqual([100])
        expect(result.pool.get(0)).toBe('move_op')
    })
})
