import {
    ASTTree,
    Expression,
    File,
    Scope,
    Type,
    VoidType
} from '../utils'
import { LambdaExpression } from '../utils/model/expr'
import symbol from './symbol'
import type_map from './type'
import censor_map from './censor'
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
    type_expr_children(ast, scope)
    let checker = find_checker(censor_map, ast.constructor)
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
    for (let file of files)
        visit(file, scope)
    //输出错误信息,有错误则停止
    if (scope.global.error.length) {
        let msg = scope.global.error.join('\n')
        throw new Error(msg)
    }
    return scope
}
