import { describe, it, expect } from 'vitest'
import { lexer, Lexer } from '../../utils/lexer'
import { TokenType } from '../../utils/data'

describe('Lexer', () => {
    it('Lexer 类应该可以被实例化', () => {
        const lexerInstance = new Lexer()
        expect(lexerInstance).toBeInstanceOf(Lexer)
    })
})

describe('lexer - 数字解析', () => {
    it('应该正确解析十进制整数', () => {
        const result = lexer('123')
        const tokens = result.filter(t => t.type === TokenType.Number)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('123')
        expect(tokens[0].type).toBe(TokenType.Number)
    })

    it('应该正确解析数字 0', () => {
        const result = lexer('0')
        const tokens = result.filter(t => t.type === TokenType.Number)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('0')
    })

    it('应该正确解析带正号的数字', () => {
        const result = lexer('+123')
        const tokens = result.filter(t => t.type === TokenType.Number)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('+123')
    })

    it('应该正确解析带负号的数字', () => {
        const result = lexer('-456')
        const tokens = result.filter(t => t.type === TokenType.Number)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('-456')
    })

    it('应该正确解析十六进制数字 (0x)', () => {
        const result = lexer('0x1A')
        const tokens = result.filter(t => t.type === TokenType.Number)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('1A')
    })

    it('应该正确解析十六进制数字 (0X)', () => {
        const result = lexer('0XFF')
        const tokens = result.filter(t => t.type === TokenType.Number)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('FF')
    })

    it('应该正确解析二进制数字 (0b)', () => {
        const result = lexer('0b101')
        const tokens = result.filter(t => t.type === TokenType.Number)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('101')
    })

    it('应该正确解析二进制数字 (0B)', () => {
        const result = lexer('0B110')
        const tokens = result.filter(t => t.type === TokenType.Number)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('110')
    })

    it('应该正确解析八进制数字 (0o)', () => {
        const result = lexer('0o77')
        const tokens = result.filter(t => t.type === TokenType.Number)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('77')
    })

    it('应该正确解析八进制数字 (0O)', () => {
        const result = lexer('0O52')
        const tokens = result.filter(t => t.type === TokenType.Number)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('52')
    })

    it('应该将 0x 后无有效字符的情况解析为 0', () => {
        const result = lexer('0x')
        const tokens = result.filter(t => t.type === TokenType.Number)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('0')
    })

    it('应该将 0b 后无有效字符的情况解析为 0', () => {
        const result = lexer('0b')
        const tokens = result.filter(t => t.type === TokenType.Number)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('0')
    })
})

describe('lexer - 标识符解析', () => {
    it('应该正确解析简单标识符', () => {
        const result = lexer('hello')
        const tokens = result.filter(t => t.type === TokenType.Identifier)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('hello')
    })

    it('应该正确解析以下划线开头的标识符', () => {
        const result = lexer('_private')
        const tokens = result.filter(t => t.type === TokenType.Identifier)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('_private')
    })

    it('应该正确解析以美元符号开头的标识符', () => {
        const result = lexer('$var')
        const tokens = result.filter(t => t.type === TokenType.Identifier)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('$var')
    })

    it('应该正确解析包含数字的标识符', () => {
        const result = lexer('var123')
        const tokens = result.filter(t => t.type === TokenType.Identifier)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('var123')
    })

    it('应该正确解析包含下划线和数字的标识符', () => {
        const result = lexer('my_var_1')
        const tokens = result.filter(t => t.type === TokenType.Identifier)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('my_var_1')
    })

    it('应该正确解析大写字母标识符', () => {
        const result = lexer('MyClass')
        const tokens = result.filter(t => t.type === TokenType.Identifier)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('MyClass')
    })
})

describe('lexer - 字符串解析', () => {
    it('应该正确解析双引号字符串', () => {
        const result = lexer('"hello"')
        const tokens = result.filter(t => t.type === TokenType.String)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('hello')
    })

    it('应该正确解析单引号字符串', () => {
        const result = lexer("'world'")
        const tokens = result.filter(t => t.type === TokenType.String)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('world')
    })

    it('应该正确解析模板字符串', () => {
        const result = lexer('`template`')
        const tokens = result.filter(t => t.type === TokenType.String)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('template')
    })

    it('应该正确解析包含转义引号的字符串', () => {
        const result = lexer('"hello\\"world"')
        const tokens = result.filter(t => t.type === TokenType.String)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('hello"world')
    })

    it('应该正确解析空字符串', () => {
        const result = lexer('""')
        const tokens = result.filter(t => t.type === TokenType.String)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('')
    })
})

describe('lexer - 注释解析', () => {
    it('应该正确解析单行注释', () => {
        const result = lexer('// this is a comment')
        const tokens = result.filter(t => t.type === TokenType.Comment)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('// this is a comment')
    })

    it('应该正确解析多行注释', () => {
        const result = lexer('/* multi line */')
        const tokens = result.filter(t => t.type === TokenType.Comment)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('/* multi line */')
    })

    it('应该正确解析包含星号的多行注释', () => {
        const result = lexer('/** doc comment */')
        const tokens = result.filter(t => t.type === TokenType.Comment)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('/** doc comment */')
    })
})

describe('lexer - 关键字/运算符解析', () => {
    it('应该正确解析单字符运算符 +', () => {
        const result = lexer('+')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('+')
    })

    it('应该正确解析单字符运算符 -', () => {
        const result = lexer('-')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('-')
    })

    it('应该正确解析单字符运算符 *', () => {
        const result = lexer('*')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('*')
    })

    it('应该正确解析等于运算符 ==', () => {
        const result = lexer('==')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('==')
    })

    it('应该正确解析不等于运算符 !=', () => {
        const result = lexer('!=')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('!=')
    })

    it('应该正确解析复合赋值运算符 +=', () => {
        const result = lexer('+=')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('+=')
    })

    it('应该正确解析括号 (', () => {
        const result = lexer('(')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('(')
    })

    it('应该正确解析括号 )', () => {
        const result = lexer(')')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe(')')
    })

    it('应该正确解析花括号 {', () => {
        const result = lexer('{')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('{')
    })

    it('应该正确解析花括号 }', () => {
        const result = lexer('}')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('}')
    })

    it('应该正确解析分号 ;', () => {
        const result = lexer(';')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe(';')
    })

    it('应该正确解析冒号 :', () => {
        const result = lexer(':')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe(':')
    })

    it('应该正确解析逗号 ,', () => {
        const result = lexer(',')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe(',')
    })

    it('应该正确解析点号 .', () => {
        const result = lexer('.')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('.')
    })

    it('应该正确解析赋值运算符 =', () => {
        const result = lexer('=')
        const tokens = result.filter(t => t.type === TokenType.Keyword)
        expect(tokens.length).toBe(1)
        expect(tokens[0].value).toBe('=')
    })
})

describe('lexer - 复合输入', () => {
    it('应该正确解析包含数字和运算符的表达式', () => {
        const result = lexer('1+2')
        // 注意: 当前 number_match 将 + 作为数字符号消费，因此 1+2 被解析为 1 和 +2
        const numberTokens = result.filter(t => t.type === TokenType.Number)
        expect(numberTokens.length).toBe(2)
        expect(numberTokens[0].value).toBe('1')
        expect(numberTokens[1].value).toBe('+2')
    })

    it('应该正确解析减号表达式', () => {
        const result = lexer('3-1')
        const numberTokens = result.filter(t => t.type === TokenType.Number)
        expect(numberTokens.length).toBe(2)
        expect(numberTokens[0].value).toBe('3')
        expect(numberTokens[1].value).toBe('-1')
    })

    it('应该正确解析独立运算符与数字的组合', () => {
        // * 不被 number_match 作为符号处理
        const result = lexer('5*3')
        const numberTokens = result.filter(t => t.type === TokenType.Number)
        const keywordTokens = result.filter(t => t.type === TokenType.Keyword)
        expect(numberTokens.length).toBe(2)
        expect(keywordTokens.length).toBe(1)
        expect(numberTokens[0].value).toBe('5')
        expect(keywordTokens[0].value).toBe('*')
        expect(numberTokens[1].value).toBe('3')
    })

    it('应该正确解析标识符后跟括号', () => {
        const result = lexer('foo(')
        expect(result.length).toBeGreaterThanOrEqual(2)
        const identifierTokens = result.filter(t => t.type === TokenType.Identifier)
        expect(identifierTokens.length).toBe(1)
        expect(identifierTokens[0].value).toBe('foo')
    })

    it('应该正确解析字符串后跟运算符', () => {
        const result = lexer('"hello"+')
        expect(result.length).toBeGreaterThanOrEqual(2)
        const stringTokens = result.filter(t => t.type === TokenType.String)
        expect(stringTokens.length).toBe(1)
    })

    it('应该包含行信息', () => {
        const result = lexer('var x = 10')
        expect(result.length).toBeGreaterThan(0)
        result.forEach(token => {
            expect(token).toHaveProperty('line')
            expect(token).toHaveProperty('type')
            expect(token).toHaveProperty('value')
        })
    })
})

describe('lexer - 边界情况', () => {
    it('应该正确处理空输入', () => {
        const result = lexer('')
        expect(result).toEqual([])
    })

    it('应该正确处理只有空格的输入', () => {
        const result = lexer('   ')
        expect(result).toEqual([])
    })

    it('返回的 token 应包含 type, value, line 三个属性', () => {
        const result = lexer('42')
        expect(result.length).toBeGreaterThan(0)
        const token = result[0]
        expect(token).toHaveProperty('type')
        expect(token).toHaveProperty('value')
        expect(token).toHaveProperty('line')
        expect(typeof token.type).toBe('number')
        expect(typeof token.value).toBe('string')
        expect(typeof token.line).toBe('string')
    })
})
