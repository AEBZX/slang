import {tokens} from '../../utils/data'
import {lexer} from '../../utils/lib/lexer'
import parser from '../../parser'
import Check from '../../utils/lib/check'
import check from '../../check'
import desugar from '../../desugar'
import hir from '../../hir'
import {Scope} from '../../check/tool'
import {ASTTree, Expression, File, Function, ListCommand} from '../../utils'

//用完整 token 表把源码切成 token
export function lex_src(src: string) {
    return lexer(src, tokens as any[])
}

//解析单个源文件:Parser.run 收的是「每个文件一个 token 数组」
export function parse(src: string): File {
    return parser.run([lex_src(src)])[0] as File
}

//解析并取第一个顶层块
export function parse_first_block(src: string): any {
    return parse(src).children[0]
}

//解析一段函数体,取函数节点
export function parse_function(body: string, head = 'void()'): Function {
    return parse(`f:${head}{ ${body} }`).children[0] as Function
}

//解析一段函数体,取函数体的命令列表
export function parse_commands(body: string, head = 'void()'): any[] {
    const fn = parse_function(body, head)
    return (fn.commands as ListCommand).commands
}

//解析一个表达式:塞进 var 声明的初值位置
export function parse_expr(src: string): any {
    return parse_commands(`var a:number=${src};`)[0].value
}

//解析一个类型:塞进 var 声明的类型位置
export function parse_type(src: string): any {
    return parse_commands(`var a:${src};`)[0].t
}

//把 AST/HIR 节点转成可比较的纯数据:丢掉行号,保留类名与全部自有字段
export function dump(v: any): any {
    if (v == null || typeof v != 'object') return v
    if (Array.isArray(v)) return v.map(dump)
    if (v instanceof Map) {
        const o: Record<string, any> = {}
        for (const [k, x] of v) o[String(k)] = dump(x)
        return o
    }
    const o: Record<string, any> = {$: v.constructor.name}
    for (const k of Object.keys(v)) {
        if (k == 'line') continue
        o[k] = dump(v[k])
    }
    return o
}

//按指定轮次跑 check,返回作用域
export function check_rounds(files: File[], rounds: [number, Map<any, any>][]) {
    let c = new Check()
    for (const [r, m] of rounds) c = c.use([r, m]) as Check
    //和 check/index.ts 一样:外层 scope 的 global 才是收集错误的地方
    c = c.use(() => new Scope(null, new Scope(null, null))) as Check
    return c.run(files)
}

//跑完整四轮 check
export function run_check(files: File[]) {
    return check.run(files) as Scope
}

//Scope.thr 把诊断记在最外层作用域上,也就是 Check.run 返回的那个
export function errors_of(scope: any): string[] {
    if (scope == null) return []
    if (Array.isArray(scope.error)) return scope.error
    return (scope.global && scope.global.error) || []
}

//解析 + 完整 check(只跑一轮时用 check_rounds),返回真实收集到的错误
export function check_src(src: string): string[] {
    return errors_of(run_check([parse(src)]))
}

//跑完 parser -> check -> desugar -> hir,check 有错就直接抛出来
export function pipeline(src: string) {
    const file = parse(src)
    const scope = run_check([file])
    const errs = errors_of(scope)
    if (errs.length) throw new Error('check 报错: ' + errs.join(' | '))
    const files = desugar.run([file]) as any[]
    const out = hir.run(files) as any
    return {file, scope, files, hscope: out[0], nodes: out[1] as any[]}
}

//跑 pipeline 并渲染 HIR 树
export function hir_src(src: string): string {
    const {nodes} = pipeline(src)
    return nodes.map(render).join('')
}

//把类型节点渲染成源码风格
export function type_str(t: any): string {
    if (t == null) return 'null'
    switch (t.constructor.name) {
        case 'NumberType':
            return 'number'
        case 'BooleanType':
            return 'boolean'
        case 'StringType':
            return 'string'
        case 'VoidType':
            return 'void'
        case 'ArrayType':
            return type_str(t.t) + '[]'
        case 'MapType':
            return type_str(t.t) + '{}'
        case 'PointType':
            return type_str(t.t) + '*'
        case 'ClassType':
            return (t.local ? t.local.join('.') : '?') +
                (t.generic && t.generic.length ? '<' + t.generic.map(type_str).join(',') + '>' : '')
        case 'GenericType':
            return '@' + t.generic
        case 'EnumType':
            return 'enum ' + (t.local ? t.local.join('.') : '?')
        case 'BlockType':
            return 'block ' + (t.local ? t.local.join('.') : '?')
        case 'LambdaType':
            //脱糖阶段会造出 generic/params 为 null 的 LambdaType,渲染时要容错
            return (t.generic && t.generic.size ? '<' + [...t.generic.keys()].join(',') + '>' : '') +
                '(' + (t.params ? [...t.params].map(([k, v]) => k + ':' + type_str(v)).join(',') : '') + ')=>' +
                type_str(t.returnType)
        default:
            return '?' + t.constructor.name
    }
}

const quoted = (s: string) => JSON.stringify(String(s))

//修饰符三元组:未写是 ?,显式写了才给出 true/false 对应的关键字
function mods(m: any): string {
    if (m == null) return '[-]'
    const u = m.unstatic === true ? 'unstatic' : m.unstatic === false ? 'static' : '?'
    const a = m._async === true ? 'async' : m._async === false ? 'sync' : '?'
    const p = m._private === true ? 'private' : m._private === false ? 'public' : '?'
    return `[${u},${a},${p}]`
}

//把表达式渲染成带括号的前缀风格,便于断言结合性与优先级
function expr_str(n: any): string {
    if (n == null) return 'null'
    const c = n.constructor.name
    switch (c) {
        case 'NumberLiteral':
            return n.value
        case 'StringLiteral':
            return quoted(n.value)
        case 'BooleanLiteral':
            return n.value
        case 'NullLiteral':
            return 'null'
        case 'IdentifierExpr':
            return n.name
        case 'ArrayExpression':
            return '[' + n.elements.map(expr_str).join(',') + ']'
        case 'MapExpression':
            return '[' + [...n.elements].map(([k, v]) => k + ':' + expr_str(v)).join(',') + ']'
        case 'LambdaExpression':
            return (n.generic && n.generic.size ? '<' + [...n.generic.keys()].join(',') + '>' : '') +
                '(' + (n.params ? [...n.params].map(([k, v]) => k + ':' + type_str(v)).join(',') : '') + ')=>' +
                type_str(n.ret) + '{' + render(n.body) + '}'
        case 'TernaryExpression':
            return '(' + expr_str(n.condition) + '?' + expr_str(n.trueExpr) + ':' + expr_str(n.falseExpr) + ')'
        case 'AddExpression':
        case 'SubExpression':
        case 'MulExpression':
        case 'DivExpression':
        case 'ModExpression':
        case 'ShlExpression':
        case 'ShrExpression':
        case 'LessExpression':
        case 'GreaterExpression':
        case 'LessEqualExpression':
        case 'GreaterEqualExpression':
        case 'EqualExpression':
        case 'InequalExpression':
        case 'AndExpression':
        case 'OrExpression':
        case 'XorExpression':
        case 'LogicAndExpression':
        case 'LogicOrExpression':
            return '(' + expr_str(n.left) + n.op + expr_str(n.right) + ')'
        case 'IncrementPostfix':
            return '(' + expr_str(n.expr) + '++)'
        case 'DecrementPostfix':
            return '(' + expr_str(n.expr) + '--)'
        case 'MemberPostfix':
            return '(' + expr_str(n.expr) + '.' + n.name + ')'
        case 'IndexPostfix':
            return '(' + expr_str(n.expr) + '[' + expr_str(n.index) + '])'
        case 'ArgumentsPostfix':
            return '(' + expr_str(n.expr) +
                (n.generic.length ? '<' + n.generic.map(type_str).join(',') + '>' : '') +
                '(' + n.args.map(expr_str).join(',') + '))'
        case 'IncrementPrefix':
            return '(++' + expr_str(n.expr) + ')'
        case 'DecrementPrefix':
            return '(--' + expr_str(n.expr) + ')'
        case 'NotPrefix':
            return '(!' + expr_str(n.expr) + ')'
        case 'BitNotPrefix':
            return '(~' + expr_str(n.expr) + ')'
        case 'MinusPrefix':
            return '(-' + expr_str(n.expr) + ')'
        case 'ReferencePrefix':
            return '(*' + expr_str(n.expr) + ')'
        case 'AddressPrefix':
            return '(&' + expr_str(n.expr) + ')'
        case 'NewPrefix':
            return '(new ' + expr_str(n.expr) + ')'
        case 'TypePrefix':
            return '((' + type_str(n.t) + ')' + expr_str(n.expr) + ')'
        default:
            throw new Error('render: 未知的表达式节点 ' + c)
    }
}

//把 AST 节点(表达式/命令/块)渲染成源码风格
export function render(n: any): string {
    if (n == null) return ''
    //表达式统一交给 expr_str,命令/块/HIR 走下面的分支
    if (n instanceof Expression) return expr_str(n)
    const c = n.constructor.name
    switch (c) {
        case 'ListCommand':
            return n.commands.map(render).join(' ')
        case 'ExprCommand':
            return expr_str(n.data) + ';'
        case 'VarDecl':
            return 'var ' + n.name + ':' + type_str(n.t) + (n.value == null ? '' : '=' + expr_str(n.value)) + ';'
        case 'Assign':
        case 'AAssign':
        case 'AddAssign':
        case 'SubAssign':
        case 'MulAssign':
        case 'DivAssign':
        case 'ModAssign':
        case 'AndAssign':
        case 'OrAssign':
        case 'XorAssign':
        case 'ShlAssign':
        case 'ShrAssign':
            return expr_str(n.data) + (n.op == null ? '=' : n.op) + expr_str(n.value) + ';'
        case 'Return':
            return 'return ' + (n.data == null ? '' : expr_str(n.data)) + ';'
        case 'Break':
            return 'break;'
        case 'Continue':
            return 'continue;'
        case 'Throw':
            return 'throw ' + expr_str(n.data) + ';'
        case 'Await':
            return 'await ' + render(n.command)
        case 'VM':
            return 'vm(' + quoted(n.data) + (n.param.length ? ',' + n.param.map(expr_str).join(',') : '') + ');'
        case 'IfStatement':
            return 'if(' + expr_str(n.condition) + ')' + render(n.commands) +
                (n.else_ == null ? '' : 'else ' + render(n.else_))
        case 'WhileStatement':
            return 'while(' + expr_str(n.condition) + ')' + render(n.commands)
        case 'DoWhileStatement':
            return 'do ' + render(n.commands) + 'while(' + expr_str(n.condition) + ');'
        case 'ForStatement':
            return 'for(' + n.init.map(render).join('') + expr_str(n.condition) + ';' +
                n.step.map(render).join('') + ')' + render(n.commands)
        case 'ForeachStatement':
            return 'foreach(' + n.iden + ':' + expr_str(n.data) + ')' + render(n.commands)
        case 'SwitchStatement':
            return 'switch(' + expr_str(n.condition) + '){' +
                n.case_list.map((i: any) => 'case ' + expr_str(i.condition) + '=>' + render(i.commands)).join('') +
                (n.default_ == null ? '' : 'default=>' + render(n.default_)) + '}'
        case 'TryStatement':
            return 'try{' + render(n.commands) + '}catch(' + n.catch_.iden + ':' + type_str(n.catch_.type) + '){' +
                render(n.catch_.command) + '}' + (n.finally_ == null ? '' : 'finally{' + render(n.finally_) + '}')
        case 'Link':
            return 'link ' + n.module.join('.') + ' as ' + n.as
        case 'Module':
            return mods(n.modifiers) + n.name + ':module{' + n.children.map(render).join('') + '}'
        case 'Class':
            return mods(n.modifiers) + n.name + ':class' +
                (n.generic && n.generic.size ? '<' + [...n.generic.keys()].join(',') + '>' : '') +
                (n.implement == null ? '' : ' implements ' + type_str(n.implement)) +
                '{' + n.children.map(render).join('') + '}'
        case 'Interface':
            return mods(n.modifiers) + n.name + ':interface' +
                (n.generic && n.generic.size ? '<' + [...n.generic.keys()].join(',') + '>' : '') +
                (n.implement == null ? '' : ' implements ' + type_str(n.implement)) +
                '{' + n.children.map(render).join('') + '}'
        case 'Enum':
            return mods(n.modifiers) + n.name + ':enum{' + n.children.join(',') + '}'
        case 'Function':
            return mods(n.modifiers) + n.name + ':' +
                (n.generic && n.generic.size ? '<' + [...n.generic.keys()].join(',') + '>' : '') +
                type_str(n.return_type) +
                '(' + [...n.params].map(([k, v]) => k + ':' + type_str(v)).join(',') + ')' +
                (n.commands == null ? ';' : '{' + render(n.commands) + '}')
        case 'Variable':
            return mods(n.modifiers) + n.name + ':' + type_str(n.t) +
                (n.value == null ? '' : '=' + expr_str(n.value)) + ';'
        case 'Operation':
            return 'operation ' + n.oper + ' ' + expr_str(n.command)
        case 'Cast':
            return 'cast ' + type_str(n.t) + ' ' + expr_str(n.command)
        case 'Value':
            return 'value ' + type_str(n.value) + '{' + n.children.map(render).join('') + '}'
        case 'File':
            return n.links.map(render).join('') + '|' + n.children.map(render).join('')
        // ---- HIR ----
        case 'HModule':
            return n.name + ':module{' + n.children.map(render).join('') + '}'
        case 'HVariable':
            return n.name + ':' + (n.entry ? 'entry' : '') + (n._static ? 'static' : '') + '=' + render(n.value) + ';'
        case 'HListCommand':
            return n.commands.map(render).join(' ')
        case 'HExprCommand':
            return render(n.data) + ';'
        case 'HAssign':
            return render(n.data) + '=' + render(n.value) + ';'
        case 'HReturn':
            return 'return ' + render(n.data) + ';'
        case 'HBreak':
            return 'break;'
        case 'HContinue':
            return 'continue;'
        case 'HVM':
            return 'vm(' + quoted(n.data) + (n.param.length ? ',' + n.param.map(render).join(',') : '') + ');'
        case 'HIfStatement':
            return 'if(' + render(n.condition) + ')' + render(n.commands) +
                (n.else_ == null ? '' : 'else ' + render(n.else_))
        case 'HWhileStatement':
            return 'while(' + render(n.condition) + ')' + render(n.commands)
        case 'HAwait':
            return 'await ' + render(n.command)
        case 'HNumberLiteral':
            return String(n.value)
        case 'HStringLiteral':
            return quoted(n.value)
        case 'HBooleanLiteral':
            return String(n.value)
        case 'HNullLiteral':
            return 'null'
        case 'HIdentifierExpr':
            return '#' + n.name
        case 'HArrayExpr':
            return '[' + n.elements.map(render).join(',') + ']'
        case 'HMapExpr':
            return '[' + [...n.elements].map(([k, v]) => k + ':' + render(v)).join(',') + ']'
        case 'HLambdaExpr':
            //params 是槽号数组
            return '(' + n.params.map((p: any) => typeof p == 'number' ? '#' + p : render(p)).join(',') + ')=>' +
                render(n.commands)
        case 'HIndexExpr':
            return '(' + render(n.target) + '[' + render(n.index) + '])'
        case 'HMemberExpr':
            return '(' + render(n.target) + '.' + n.member + ')'
        case 'HPostIncrementExpr':
            return '(' + render(n.target) + '++)'
        case 'HPostDecrementExpr':
            return '(' + render(n.target) + '--)'
        case 'HPreIncrementExpr':
            return '(++' + render(n.target) + ')'
        case 'HPreDecrementExpr':
            return '(--' + render(n.target) + ')'
        case 'HArgumentsExpr':
            return '(' + render(n.target) + '(' + n.args.map(render).join(',') + '))'
        case 'HNotExpr':
            return '(!' + render(n.target) + ')'
        case 'HBitNotExpr':
            return '(~' + render(n.target) + ')'
        case 'HReferenceExpr':
            return '(*' + render(n.target) + ')'
        case 'HAddressExpr':
            return '(&' + render(n.target) + ')'
        case 'HBinaryExpr':
            return '(' + render(n.left) + n.op + render(n.right) + ')'
        case 'HTernaryExpr':
            return '(' + render(n.condition) + '?' + render(n.trueExpr) + ':' + render(n.falseExpr) + ')'
        default:
            throw new Error('render: 未知的节点 ' + c)
    }
}
