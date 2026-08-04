import {
    ASTTree,
    Expression,
    File,
    Scope,
    Type,
    VoidType
} from '../utils'
import symbol from './symbol'
import type_map from './type'
import censor_map from './censor'

//沿构造函数原型链查找注册表(子类命中基类)
function find_checker(map: Map<any, any>, cls: any): any {
    while (cls) {
        if (map.has(cls)) return map.get(cls)
        cls = Object.getPrototypeOf(cls)
    }
    return undefined
}

//计算表达式类型并缓存到 scope.symbol
function type_of(ast: ASTTree, scope: Scope): Type {
    let cached = scope.get_sym(ast)
    if (cached) return cached
    let checker = find_checker(type_map, ast.constructor)
    let type = checker ? checker(ast, scope, (child) => type_of(child, scope)) : new VoidType()
    scope.sym(ast, type)
    return type
}

//预计算命令节点中的纯表达式子节点(供 C_Assign 等 get_sym 使用)
function type_expr_children(ast: ASTTree, scope: Scope) {
    for (let key in ast) {
        let v = (ast as any)[key]
        if (v instanceof Expression) type_of(v, scope)
        else if (Array.isArray(v)) v.forEach(x => x instanceof Expression && type_of(x, scope))
        else if (v instanceof Map) v.forEach(x => x instanceof Expression && type_of(x, scope))
    }
}

//递归遍历:表达式走 type_checker,命令/块走 check_visitor,无注册则 fallback
function visit(ast: ASTTree, scope: Scope) {
    if (ast instanceof Expression) {
        type_of(ast, scope)
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
