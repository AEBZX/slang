import {
    ASTTree,
    Expression,
    File,
    ForStatement,
    ForeachStatement,
    Scope,
    Type,
    VoidType,LambdaExpression
} from '../utils'
import symbol from './symbol'
import type_map from './type'
import censor_map from './censor'
//寻找检查器
function find_checker(map: Map<any, any>, cls: any): any {
    while (cls) {
        if (map.has(cls)) return map.get(cls)
        cls = Object.getPrototypeOf(cls)
    }
    return undefined
}
function type_of(ast: ASTTree, scope: Scope): Type {
    let cached = scope.get_sym(ast)
    if (cached) return cached
    let checker = find_checker(type_map, ast.constructor)
    let type = checker ? checker(ast, scope, (child) => type_of(child, scope)) : new VoidType()
    scope.sym(ast, type)
    ast.type = type
    return type
}
function type_expr_children(ast: ASTTree, scope: Scope) {
    for (let key in ast) {
        let v = (ast as any)[key]
        if (v instanceof Expression) type_of(v, scope)
        else if (Array.isArray(v)) v.forEach(x => x instanceof Expression && type_of(x, scope))
        else if (v instanceof Map) v.forEach(x => x instanceof Expression && type_of(x, scope))
    }
}
function visit(ast: ASTTree, scope: Scope) {
    if (ast instanceof Expression) {
        type_of(ast, scope)
        //LambdaExpression 的函数体也要做命令级检查
        if (ast instanceof LambdaExpression && ast.body) {
            let ls = scope.enter()
            ls.loop = false
            ls.data.set('while', null as any)
            ls.data.set('throw', null as any)
            for (let [k, v] of ast.params) {
                ls.set(k, v)
                ls.sym(v, v)
            }
            ls.set('return', ast.ret)
            ls.sym(ast.ret, ast.ret)
            visit(ast.body, ls)
        }
        return
    }
    //For/Foreach 的 condition 依赖 init 声明的变量,由检查器自行按序处理,不预计算
    let checker = find_checker(censor_map, ast.constructor)
    if (ast instanceof ForStatement || ast instanceof ForeachStatement) {
        if (checker) checker(ast, scope, (child, s) => visit(child, s || scope))
        return
    }
    type_expr_children(ast, scope)
    if (checker) {
        checker(ast, scope, (child, s) => visit(child, s || scope))
    } else {
        for (let key in ast) {
            let v = (ast as any)[key]
            if (v instanceof ASTTree && !(v instanceof Expression)) visit(v, scope)
            else if (Array.isArray(v)) v.forEach(x => x instanceof ASTTree && !(x instanceof Expression) && visit(x, scope))
            else if (v instanceof Map) v.forEach(x => x instanceof ASTTree && !(x instanceof Expression) && visit(x, scope))
        }
    }
}

export default function check(files: File[]): Scope {
    const scope = new Scope(null, new Scope(null, null))
    symbol(files, scope)
    //多文件同模块去重:标准库 6 个文件都声明 public std:module,symbol 合并时把旧子节点
    //推入最后注册的模块,但各文件自己的模块节点仍留在 File.children 里;
    //不剪枝的话 desugar/hir/ir 会对每份重复模块树各生成一遍代码(入口块指令数爆炸,
    //优化器 O(n²) 卡死)。只保留全局注册表指向的那棵(合并后的完整树)
    for (let file of files) {
        file.children = file.children.filter(b => scope.global.data.get(b.name) === b)
    }
    for (let file of files) {
        //link 别名作用域是文件级:每个文件进入独立子 scope 注册自身 links,不污染其他文件
        let fs = scope.enter()
        for (let v of file.links) {
            let target = scope.get(v.module.join('.'))
            if (target) fs.set(v.as, target)
        }
        visit(file, fs)
    }
    //输出错误信息,有错误则停止
    if (scope.global.error.length) {
        let msg = scope.global.error.join('\n')
        throw new Error(msg)
    }
    return scope
}
