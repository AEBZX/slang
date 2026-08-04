import { describe, it, expect } from 'vitest'
import {
    AdditiveExpression,
    ArrayExpression,
    ArrayFix,
    ASTTree,
    BinaryExpression,
    BooleanLiteral,
    BooleanType,
    EqualityExpression,
    FixType,
    IdentifierExpr,
    IncrementPostfix,
    Literal,
    LogicalAndExpression,
    LogicalOrExpression,
    MinusPrefix,
    NullLiteral,
    NumberLiteral,
    NumberType,
    PostfixExpression,
    PrefixExpression,
    Scope,
    StringLiteral,
    StringType,
    TernaryExpression,
    Type,
    Variable,
    VoidType
} from '../../utils'
import type_map from '../../check/type'
import { GreaterExpression, LessExpression } from '../../utils/model/expr'

// 构造 call: 字面量返回对应类型,标识符查 scope
function make_call(scope: Scope): (ast: ASTTree) => Type {
    return (ast: ASTTree): Type => {
        if (ast instanceof NumberLiteral) return new NumberType()
        if (ast instanceof StringLiteral) return new StringType()
        if (ast instanceof BooleanLiteral) return new BooleanType()
        if (ast instanceof NullLiteral) return new VoidType()
        if (ast instanceof IdentifierExpr) return scope.get_sym(scope.get(ast.name)) || new VoidType()
        return new VoidType()
    }
}

const S_BinaryExpression = type_map.get(BinaryExpression)!
const S_Literal = type_map.get(Literal)!
const S_Identifier = type_map.get(IdentifierExpr)!
const S_Ternary = type_map.get(TernaryExpression)!
const S_Array = type_map.get(ArrayExpression)!
const S_Prefix = type_map.get(PrefixExpression)!
const S_Postfix = type_map.get(PostfixExpression)!

function check(ast: any): { type: Type, errors: string[] } {
    ast.line = ['test']
    const scope = new Scope(null, new Scope(null, null))
    const type = S_BinaryExpression(ast, scope, make_call(scope))
    return { type, errors: scope.global.error }
}

describe('S_BinaryExpression 类型检查', () => {
    it('数字加法返回 number', () => {
        const ast = new AdditiveExpression(new NumberLiteral('1'), new NumberLiteral('2'))
        const { type, errors } = check(ast)
        expect(type).toBeInstanceOf(NumberType)
        expect(errors).toEqual([])
    })

    it('字符串 + 数字报错', () => {
        const ast = new AdditiveExpression(new StringLiteral('a'), new NumberLiteral('2'))
        const { type, errors } = check(ast)
        expect(errors.join()).toContain('not number')
        expect(type).toBeInstanceOf(NumberType)
    })

    it('&& 两边任意类型不报错', () => {
        const ast = new LogicalAndExpression(new NumberLiteral('1'), new StringLiteral('a'))
        const { type, errors } = check(ast)
        expect(errors).toEqual([])
        expect(type).toBeInstanceOf(VoidType)
    })

    it('|| 两边任意类型不报错', () => {
        const ast = new LogicalOrExpression(new BooleanLiteral('true'), new NumberLiteral('1'))
        const { errors } = check(ast)
        expect(errors).toEqual([])
    })

    it('&& 两边兼容类型返回合并类型', () => {
        const ast = new LogicalAndExpression(new NumberLiteral('1'), new NumberLiteral('2'))
        const { type, errors } = check(ast)
        expect(type).toBeInstanceOf(NumberType)
        expect(errors).toEqual([])
    })

    it('关系比较返回 boolean', () => {
        const ast = new LessExpression(new NumberLiteral('1'), new NumberLiteral('2'))
        const { type, errors } = check(ast)
        expect(type).toBeInstanceOf(BooleanType)
        expect(errors).toEqual([])
        expect(check(new GreaterExpression(new NumberLiteral('2'), new NumberLiteral('1'))).type).toBeInstanceOf(BooleanType)
    })

    it('相等比较类型不匹配报错', () => {
        const ast = new EqualityExpression(new NumberLiteral('1'), new StringLiteral('a'))
        const { type, errors } = check(ast)
        expect(errors.join()).toContain('type mismatch')
        expect(type).toBeInstanceOf(BooleanType)
    })

    it('相等比较类型匹配无错误', () => {
        const ast = new EqualityExpression(new NumberLiteral('1'), new NumberLiteral('2'))
        const { errors } = check(ast)
        expect(errors).toEqual([])
    })
})

describe('S_Literal', () => {
    it('数字字面量', () => {
        const scope = new Scope(null, new Scope(null, null))
        expect(S_Literal(new NumberLiteral('1'), scope, make_call(scope))).toBeInstanceOf(NumberType)
    })

    it('字符串字面量', () => {
        const scope = new Scope(null, new Scope(null, null))
        expect(S_Literal(new StringLiteral('a'), scope, make_call(scope))).toBeInstanceOf(StringType)
    })

    it('null 字面量返回 VoidType', () => {
        const scope = new Scope(null, new Scope(null, null))
        expect(S_Literal(new NullLiteral(null), scope, make_call(scope))).toBeInstanceOf(VoidType)
    })
})

describe('S_IdentifierExpression', () => {
    it('未定义变量报错返回 VoidType', () => {
        const ast = new IdentifierExpr('x')
        ast.line = ['test']
        const scope = new Scope(null, new Scope(null, null))
        const type = S_Identifier(ast, scope, make_call(scope))
        expect(scope.global.error.join()).toContain('not defined')
        expect(type).toBeInstanceOf(VoidType)
    })

    it('已定义变量返回其类型', () => {
        const ast = new IdentifierExpr('x')
        ast.line = ['test']
        const scope = new Scope(null, new Scope(null, null))
        const decl = new Variable(null, 'x', new NumberType(), null)
        scope.set('x', decl)
        scope.sym(decl, new NumberType())
        expect(S_Identifier(ast, scope, make_call(scope))).toBeInstanceOf(NumberType)
    })
})

describe('S_TernaryExpression', () => {
    it('布尔条件返回两侧合并类型', () => {
        const ast = new TernaryExpression(new BooleanLiteral('true'), new NumberLiteral('1'), new NumberLiteral('2'))
        ast.line = ['test']
        const scope = new Scope(null, new Scope(null, null))
        expect(S_Ternary(ast, scope, make_call(scope))).toBeInstanceOf(NumberType)
    })

    it('非布尔条件报错', () => {
        const ast = new TernaryExpression(new NumberLiteral('1'), new NumberLiteral('1'), new NumberLiteral('2'))
        ast.line = ['test']
        const scope = new Scope(null, new Scope(null, null))
        S_Ternary(ast, scope, make_call(scope))
        expect(scope.global.error.join()).toContain('condition is not boolean')
    })
})

describe('S_ArrayExpression', () => {
    it('[1,2] 返回数组 FixType', () => {
        const ast = new ArrayExpression([new NumberLiteral('1'), new NumberLiteral('2')])
        ast.line = ['test']
        const scope = new Scope(null, new Scope(null, null))
        const type = S_Array(ast, scope, make_call(scope))
        expect(type).toBeInstanceOf(FixType)
        expect((type as FixType).fix[0]).toBeInstanceOf(ArrayFix)
    })
})

describe('S_PrefixExpression / S_PostfixExpression', () => {
    it('-1 返回 number', () => {
        const ast = new PrefixExpression(new NumberLiteral('1'), [new MinusPrefix()])
        ast.line = ['test']
        const scope = new Scope(null, new Scope(null, null))
        expect(S_Prefix(ast, scope, make_call(scope))).toBeInstanceOf(NumberType)
    })

    it('对字符串取负报错', () => {
        const ast = new PrefixExpression(new StringLiteral('a'), [new MinusPrefix()])
        ast.line = ['test']
        const scope = new Scope(null, new Scope(null, null))
        S_Prefix(ast, scope, make_call(scope))
        expect(scope.global.error.join()).toContain('can only be applied to number')
    })

    it('1++ 返回 number', () => {
        const ast = new PostfixExpression(new NumberLiteral('1'), [new IncrementPostfix()])
        ast.line = ['test']
        const scope = new Scope(null, new Scope(null, null))
        expect(S_Postfix(ast, scope, make_call(scope))).toBeInstanceOf(NumberType)
    })
})
