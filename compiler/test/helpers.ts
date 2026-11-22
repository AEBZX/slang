import lexerInst from '../src/lexer'
import parserInst from '../src/parser'
import checkInst from '../src/check'
import desugarInst from '../src/desugar'
import hirInst from '../src/hir'
import irInst from '../src/ir'
import optimizeInst from '../src/optimize'
import generateInst from '../src/generate'

//逐管线推进的共享助手:每个函数返回对应阶段的产物,供单测/集成测试断言
export const parse_files = (srcs: string[]) => parserInst.run(lexerInst.run(srcs))

export const run_to_check = (src: string) => {
    const files = parse_files([src])
    const scope = checkInst.run(files)
    return {files, scope}
}

export const run_to_desugar = (src: string) => {
    const {files} = run_to_check(src)
    return desugarInst.run(files) as any
}

export const run_to_hir = (src: string) => {
    const {files} = run_to_check(src)
    return hirInst.run(desugarInst.run(files)) as any
}

export const run_to_ir = (src: string) => {
    const [hir_scope, hir_modules] = run_to_hir(src)
    return irInst.run([hir_scope, hir_modules]) as any
}

export const run_to_optimize = (src: string) => {
    const ir_tool = run_to_ir(src)
    return optimizeInst.run(ir_tool) as any
}

export const run_to_generate = (src: string) => {
    return generateInst.run(run_to_optimize(src)) as Buffer
}

export const compile_files = (srcs: string[]) => {
    const files = parse_files(srcs)
    checkInst.run(files)
    const desugared = desugarInst.run(files)
    const [hir_scope, hir_modules] = hirInst.run(desugared)
    const ir_tool = irInst.run([hir_scope, hir_modules])
    return generateInst.run(optimizeInst.run(ir_tool)) as Buffer
}
