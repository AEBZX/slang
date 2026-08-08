import { describe, it, expect } from 'vitest'
import { lexer } from '../../utils/lexer'
import { ast_data, TokenType } from '../../utils/data'
import $ from '../../utils'
import ExprRules from '../../parser/cst/expr.js'
import IdentifierRules from '../../parser/cst/identifier.js'
import CommandRules from '../../parser/cst/command.js'
import BlockRules from '../../parser/cst/block.js'

// 辅助: 深克隆规则数组 (避免 mutation 污染)
function clone_rules(rules: any[]): any[] {
    return JSON.parse(JSON.stringify(rules))
}

// 辅助: lex → parse 指定规则
function parse_entry(entry: string, rules: any[], code: string): ast_data | string {
    const tokens = lexer(code)
    return $.parser.run(entry, clone_rules(rules), tokens)
}

// ==================== 类型解析 (identifier.ts) ====================
describe('类型解析 (Type)', () => {
    const rules = [...IdentifierRules]

    it('基础类型: number', () => {
        const result = parse_entry('Type', rules, 'number') as ast_data
        expect(result.type).toBe('Type')
        const basic = result.children.get('child_0') as ast_data
        expect(basic.type).toBe('NumberType')
    })

    it('基础类型: boolean', () => {
        const result = parse_entry('Type', rules, 'boolean') as ast_data
        const basic = result.children.get('child_0') as ast_data
        expect(basic.type).toBe('BooleanType')
    })

    it('基础类型: string', () => {
        const result = parse_entry('Type', rules, 'string') as ast_data
        const basic = result.children.get('child_0') as ast_data
        expect(basic.type).toBe('StringType')
    })

    it('数组类型: number[]', () => {
        const result = parse_entry('Type', rules, 'number[]') as ast_data
        const postfixList = result.children.get('child_1') as ast_data
        expect(postfixList.children.size).toBe(1)
        expect((postfixList.children.get('param_0') as ast_data).type).toBe('ArrayPostfix')
    })

    it('map 类型: string{}', () => {
        const result = parse_entry('Type', rules, 'string{}') as ast_data
        const postfixList = result.children.get('child_1') as ast_data
        expect(postfixList.children.size).toBe(1)
        expect((postfixList.children.get('param_0') as ast_data).type).toBe('MapPostfix')
    })

    it('指针类型: number*', () => {
        const result = parse_entry('Type', rules, 'number*') as ast_data
        const postfixList = result.children.get('child_1') as ast_data
        expect(postfixList.children.size).toBe(1)
        expect((postfixList.children.get('param_0') as ast_data).type).toBe('PointPostfix')
    })

    it('多层嵌套: number[][]*', () => {
        const result = parse_entry('Type', rules, 'number[][]*') as ast_data
        const postfixList = result.children.get('child_1') as ast_data
        expect(postfixList.children.size).toBe(3)
        expect((postfixList.children.get('param_0') as ast_data).type).toBe('ArrayPostfix')
        expect((postfixList.children.get('param_1') as ast_data).type).toBe('ArrayPostfix')
        expect((postfixList.children.get('param_2') as ast_data).type).toBe('PointPostfix')
    })

    it('void 作为返回类型', () => {
        const result = parse_entry('Type', rules, 'void') as ast_data
        const basic = result.children.get('child_0') as ast_data
        expect(basic.type).toBe('VoidType')
    })

    it('lambda 类型: (x:number)=>number', () => {
        const result = parse_entry('Type', rules, '(x:number)=>number') as ast_data
        const basic = result.children.get('child_0') as ast_data
        expect(basic.type).toBe('LambdaType')
    })

    it('lambda 类型空参数: ()=>number', () => {
        const result = parse_entry('Type', rules, '()=>number') as ast_data
        const basic = result.children.get('child_0') as ast_data
        expect(basic.type).toBe('LambdaType')
    })
})

// ==================== 表达式解析 (expr.ts) ====================
describe('表达式解析 (Expression)', () => {
    const rules = [...ExprRules, ...IdentifierRules]

    it('数字字面量: 42', () => {
        const result = parse_entry('Expression', rules, '42') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('标识符: myVar', () => {
        const result = parse_entry('Expression', rules, 'myVar') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('括号表达式: (x)', () => {
        const result = parse_entry('Expression', rules, '(x)') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('后缀 ++ : x++', () => {
        const result = parse_entry('Expression', rules, 'x++') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('成员访问: obj.prop', () => {
        const result = parse_entry('Expression', rules, 'obj.prop') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('函数调用: fn( a , b )', () => {
        const result = parse_entry('Expression', rules, 'fn( a , b )') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('前缀 -x', () => {
        const result = parse_entry('Expression', rules, '-x') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('前缀 !x', () => {
        const result = parse_entry('Expression', rules, '!x') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('加法: a + b', () => {
        const result = parse_entry('Expression', rules, 'a + b') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('乘法优先: a + b * c', () => {
        const result = parse_entry('Expression', rules, 'a + b * c') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('比较: a < b', () => {
        const result = parse_entry('Expression', rules, 'a < b') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('等于: a == b', () => {
        const result = parse_entry('Expression', rules, 'a == b') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('严格等于: a === b', () => {
        const result = parse_entry('Expression', rules, 'a === b') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('逻辑与: a && b', () => {
        const result = parse_entry('Expression', rules, 'a && b') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('逻辑或: a || b', () => {
        const result = parse_entry('Expression', rules, 'a || b') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('三元: a ? b : c', () => {
        const result = parse_entry('Expression', rules, 'a ? b : c') as ast_data
        expect(result.type).toBe('TernaryExpression')
    })

    it('三元嵌套二元: a > b ? 1 : 0', () => {
        const result = parse_entry('Expression', rules, 'a > b ? 1 : 0') as ast_data
        expect(result.type).toBe('TernaryExpression')
    })

    it('位移: a << 2', () => {
        const result = parse_entry('Expression', rules, 'a << 2') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('位运算: a & b', () => {
        const result = parse_entry('Expression', rules, 'a & b') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('数组字面量: [1,2,3]', () => {
        const result = parse_entry('Expression', rules, '[1,2,3]') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('空数组: []', () => {
        const result = parse_entry('Expression', rules, '[]') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })

    it('Map字面量: [key : 1]', () => {
        const result = parse_entry('Expression', rules, '[key : 1]') as ast_data
        expect(result.type).toBe('BinaryExpression')
    })
})

// ==================== 命令解析 (command.ts) ====================
describe('命令解析 (Commands)', () => {
    const all_rules = [...IdentifierRules, ...ExprRules, ...CommandRules]

    it('var 声明: var x:number=5;', () => {
        const result = parse_entry('VarDeclaration', all_rules, 'var x:number=5;') as ast_data
        expect(result.type).toBe('VarDeclaration')
    })

    it('var 声明无初始化: var x:number;', () => {
        const result = parse_entry('VarDeclaration', all_rules, 'var x:number;') as ast_data
        expect(result.type).toBe('VarDeclaration')
    })

    it('return: return x;', () => {
        const result = parse_entry('Return', all_rules, 'return x;') as ast_data
        expect(result.type).toBe('Return')
    })

    it('return 无值: return;', () => {
        const result = parse_entry('Return', all_rules, 'return;') as ast_data
        expect(result.type).toBe('Return')
    })

    it('break: break;', () => {
        const result = parse_entry('Break', all_rules, 'break;') as ast_data
        expect(result.type).toBe('Break')
    })

    it('continue: continue;', () => {
        const result = parse_entry('Continue', all_rules, 'continue;') as ast_data
        expect(result.type).toBe('Continue')
    })

    it('throw: throw x;', () => {
        const result = parse_entry('Throw', all_rules, 'throw x;') as ast_data
        expect(result.type).toBe('Throw')
    })

    it('VM 命令: vm "opcode";', () => {
        const result = parse_entry('VM', all_rules, 'vm "opcode";') as ast_data
        expect(result.type).toBe('VM')
    })

    it('赋值: x=5;', () => {
        const result = parse_entry('Assign', all_rules, 'x=5;') as ast_data
        expect(result.type).toBe('AAssign')
    })

    it('复合赋值 +=: x+=5;', () => {
        const result = parse_entry('Assign', all_rules, 'x+=5;') as ast_data
        expect(result.type).toBe('AddAssign')
    })

    it('if 语句: if(x){return;}', () => {
        const result = parse_entry('IfStatement', all_rules, 'if(x){return;}') as ast_data
        expect(result.type).toBe('IfStatement')
    })

    it('if-else: if(x){return;}else{break;}', () => {
        const result = parse_entry('IfStatement', all_rules, 'if(x){return;}else{break;}') as ast_data
        expect(result.type).toBe('IfStatement')
    })

    it('while 循环: while(x){break;}', () => {
        const result = parse_entry('WhileStatement', all_rules, 'while(x){break;}') as ast_data
        expect(result.type).toBe('WhileStatement')
    })

    it('do-while: do{break;}while(x);', () => {
        const result = parse_entry('DoWhileStatement', all_rules, 'do{break;}while(x);') as ast_data
        expect(result.type).toBe('DoWhileStatement')
    })

    it('try-catch: try{return;}catch(e:number){return;}', () => {
        const result = parse_entry('TryStatement', all_rules, 'try{return;}catch(e:number){return;}') as ast_data
        expect(result.type).toBe('TryStatement')
    })

    it('try-catch-finally', () => {
        const result = parse_entry('TryStatement', all_rules, 'try{return;}catch(e:number){return;}finally{break;}') as ast_data
        expect(result.type).toBe('TryStatement')
    })

    it('try-catch 带类型标注: try{return;}catch(e:number){return;}', () => {
        const result = parse_entry('TryStatement', all_rules, 'try{return;}catch(e:number){return;}') as ast_data
        expect(result.type).toBe('TryStatement')
    })

    it('try-catch-finally 带类型标注', () => {
        const result = parse_entry('TryStatement', all_rules, 'try{return;}catch(e:string){return;}finally{break;}') as ast_data
        expect(result.type).toBe('TryStatement')
    })

    it('调用: foo( x );', () => {
        const result = parse_entry('Call', all_rules, 'foo( x );') as ast_data
        expect(result.type).toBe('Call')
    })

    it('await 调用: await foo( x );', () => {
        const result = parse_entry('Call', all_rules, 'await foo( x );') as ast_data
        expect(result.type).toBe('Call')
    })

    it('for 循环: for(var i:number=0;i<10;i++){break;}', () => {
        const result = parse_entry('ForStatement', all_rules, 'for(var i:number=0;i<10;i++){break;}') as ast_data
        expect(result.type).toBe('ForStatement')
    })

    it('foreach 循环: foreach(i:item){break;}', () => {
        const result = parse_entry('ForeachStatement', all_rules, 'foreach(i:item){break;}') as ast_data
        expect(result.type).toBe('ForeachStatement')
    })

    it('switch: case + default', () => {
        const result = parse_entry('SwitchStatement', all_rules,
            'switch(x){case 1=>{break;}default=>{break;}}') as ast_data
        expect(result.type).toBe('SwitchStatement')
    })

    it('switch: 仅 default', () => {
        const result = parse_entry('SwitchStatement', all_rules,
            'switch(x){default=>{break;}}') as ast_data
        expect(result.type).toBe('SwitchStatement')
    })

    it('Commands: 单个命令', () => {
        // Commands = or(BasicCommand, BlockCommand), BasicCommand returns directly
        const result = parse_entry('Commands', all_rules, 'return;') as ast_data
        expect(result.type).toBe('Return')
    })

    it('BlockCommand: if 语句', () => {
        const result = parse_entry('BlockCommand', all_rules, 'if(x){return;}') as ast_data
        expect(result.type).toBe('IfStatement')
    })

    it('BlockCommand: {} 块', () => {
        const result = parse_entry('BlockCommand', all_rules, '{return;}') as ast_data
        // child_rule 返回第一个 object child → loop(Commands) 的结果
        expect(result.type).toBe('Commands')
    })
})

// ==================== 顶层块解析 (block.ts) ====================
describe('顶层块解析 (File)', () => {
    const all_rules = [...IdentifierRules, ...ExprRules, ...CommandRules, ...BlockRules]

    it('link 语句: link std.io.print as print;', () => {
        const result = parse_entry('link', all_rules, 'link std.io.print as print;') as ast_data
        expect(result.type).toBe('link')
    })

    it('var 变量 (通过block提供名字): var:number=5;', () => {
        // Variable 规则: var : Type = Expr ; 名字由 block 规则提供
        const result = parse_entry('Variable', all_rules, 'var:number=5;') as ast_data
        expect(result.type).toBe('Variable')
    })

    it('ModuleName: 单标识符', () => {
        const result = parse_entry('ModuleName', [...BlockRules], 'foo') as ast_data
        expect(result.type).toBe('ModuleName')
    })

    it('ModuleName: 多级限定名', () => {
        const result = parse_entry('ModuleName', [...BlockRules], 'std.io.print') as ast_data
        expect(result.type).toBe('ModuleName')
        expect(result.children.size).toBeGreaterThanOrEqual(3)
    })

    it('blocks: 多行顶层定义', () => {
        const result = parse_entry('blocks', all_rules,
            'public main:void(){return;}'
        ) as ast_data
        expect(result.type).toBe('blocks')
    })

    it('File: 完整文件', () => {
        const result = parse_entry('File', all_rules,
            'link std.io.print as print;\n' +
            'public main:void(){return;}'
        ) as ast_data
        expect(result.type).toBe('File')
    })

    it('Enum: 空枚举 {}', () => {
        const result = parse_entry('Enum', all_rules, 'enum{}') as ast_data
        expect(result.type).toBe('Enum')
    })

    it('Enum: 带成员 a,b', () => {
        const result = parse_entry('Enum', all_rules, 'enum{a,b}') as ast_data
        expect(result.type).toBe('Enum')
    })

    it('Class: 可选 implements 子句命中', () => {
        const result = parse_entry('Class', all_rules, 'class implements std.io {}') as ast_data
        expect(result.type).toBe('Class')
        // d('class') 不占 child → implements 子句是 child_0
        const child = result.children.get('child_0') as ast_data
        expect(child.type).toBe('ModuleName')
    })

    it('Class: 无 implements 子句', () => {
        const result = parse_entry('Class', all_rules, 'class {}') as ast_data
        expect(result.type).toBe('Class')
    })

    it('function: 空参数非空体', () => {
        const result = parse_entry('Function', all_rules, 'void(){return;}') as ast_data
        expect(result.type).toBe('Function')
    })

    it('function: 带参数', () => {
        const result = parse_entry('Function', all_rules, 'void(a:number,b:string){return;}') as ast_data
        expect(result.type).toBe('Function')
    })

    it('function: 空参数空体 (Type 不再直接接触 {} 后缀)', () => {
        const result = parse_entry('Function', all_rules, 'void(){}') as ast_data
        expect(result.type).toBe('Function')
    })

    it('blocks: 真实解析出 Function(而非空列表)', () => {
        const result = parse_entry('blocks', all_rules,
            'public main:void(){return;}'
        ) as ast_data
        expect(result.type).toBe('blocks')
        const block = result.children.get('param_0') as ast_data
        expect(block.type).toBe('Block')
        // Block = seg(Modifiers, Identifier, ':', or(BlockData))
        const fn = block.children.get('child_3') as ast_data
        expect(fn.type).toBe('Function')
    })
})

// ==================== 边界和错误情况 ====================
describe('边界和错误情况', () => {
    const all_rules = [...IdentifierRules, ...ExprRules, ...CommandRules, ...BlockRules]

    it('空 tokens 应该抛出', () => {
        expect(() => parse_entry('Type', [...IdentifierRules], '')).toThrow()
    })

    it('空输入 Commands 应该抛出', () => {
        expect(() => parse_entry('Commands', all_rules, '')).toThrow()
    })

    it('空输入 IfStatement 应该抛出', () => {
        expect(() => parse_entry('IfStatement', all_rules, '')).toThrow()
    })

    it('不匹配的关键字应该抛出', () => {
        expect(() => parse_entry('IfStatement', all_rules, 'while')).toThrow()
    })
})

