# Slang Language and Toolchain Specification

**Document**: docs/standard/COMPILER.md
**Applies to**: Slang source programs; conforming compilers; the `bzx-ins1` interchange instruction set
**Style**: normative sections use *shall* / *ill-formed* / *undefined behavior (UB)* in the ISO C++ sense

本文档定义 Slang 语言的**语法、静态语义、运行时语义**，合觃编译器的工具链接口，以及编译器与虚拟机之间的交换指令集 `bzx-ins1`。

本规范描述**必须成立的性质与可观测行为**，不描述任何特定实现的内部机制。凡未由本规范规定的行为，其处理方式由实现自行决定；凡显式标注 UB 的行为，本规范不施加任何约束。

各节使用形如 [lex.number]、[expr.add]、[isa.call] 的锚点编号互相引用。

---

# 1 Scope [scope]

本规范适用于：

- Slang 源程序的语言语义；
- 合觃编译器的诊断要求与产物要求；
- 编译器工具链接口（[toolchain]）；
- 交换指令集 `bzx-ins1` 与二进制格式（[isa], [binfmt]）。

不适用于：VM 内部实现策略、标准库的具体实现方式。

---

# 2 Terms and definitions [terms]

| 术语 | 定义 |
|--|--|
| **well-formed** | 满足全部语法与静态语义 shall 规则的程序。合觃编译器必须接受并编译。 |
| **ill-formed** | 违反语法或静态语义规则的程序。合觃编译器必须诊断并拒绝编译，诊断消息不得为空。 |
| **UB** | undefined behavior。本规范对该构造不施加任何要求；实现可产生任意行为，包括拒绝编译。 |
| **slot** | 虚拟机的可寻址存储单元，以非负整数编号。 |
| **frame** | 控制转移层级标记：`0` 为块帧，`1` 为函数帧。 |
| **module frame** | 由 source 中的顶层块实例化出的全局初始化上下文。 |

---

# 3 Conformance [conform]

- **[conform]/1** 合法编译器 shall 接受所有 well-formed 程序并产出符合 [binfmt] 的二进制。
- **[conform]/2** 合法编译器 shall 诊断所有 ill-formed 程序，并以非空诊断消息拒绝产出二进制。
- **[conform]/3** 诊断消息 shall 包含触发点的行号信息。
- **[conform]/4** 对标注 UB 的构造，编译器不承担 [conform]/2 的诊断义务。
- **[conform]/5** 目标 `bzx-ins1` 的合觃编译器 shall 按 [toolchain] 暴露工具链接口。

---

# 4 Toolchain interface [toolchain]

## 4.1 Entry point [toolchain.entry]

合法编译器暴露一个默认导出函数：

```typescript
function compile(source: string[],
        plugin: (pipeline: PeepholeTool[], config: any) => PeepholeTool[],
        config: any): Buffer{}
```

## 4.2 Pipeline [toolchain.pipeline]

**[toolchain.pipeline]/1** 管线由 8 个顺序阶段组成，阶段顺序 shall 与下表一致；每个阶段是一个对象，暴露 `run(previous): current`。

| # | 阶段 | 输入 → 输出 | 契约 |
|--|--|--|--|
| 1 | lexer | `string[]` → token 序列的序列 | [lex] |
| 2 | parser | token 序列的序列 → AST | [grammar] |
| 3 | checker | AST → AST（写入静态属性）并收集诊断 | [static] |
| 4 | desugar | AST → AST | [dsugar] |
| 5 | hir | AST → 带槽号 IR 树 | [hir] |
| 6 | ir-gen | IR 树 → 指令块集合 | [isa] |
| 7 | optimizer | 指令块集合 → 指令块集合 | 保持程序可观测行为不变 |
| 8 | generator | 指令块集合 → `Buffer` | [binfmt] |

**[toolchain.pipeline]/2** 阶段的内部组织、数据结构与命名 unspecified；仅上述输入/输出契约与可观测行为是规范性的。

**[toolchain.pipeline]/3** checker 阶段 shall 以异常形式抛出全部静态诊断；异常消息 shall 非空且 shall 包含触发点行号。

**[toolchain.pipeline]/4** optimizer 阶段 shall 保持程序的可观测行为不变；本规范版本中 optimizer 可以是恒等变换。

## 4.3 Plugin [toolchain.plugin]

**[toolchain.plugin]/1** 插件接收完整管线并返回替换后的管线；插件可在任意阶段插入、替换或移除。

**[toolchain.plugin]/2** 被插件修改过的管线，其行为由插件定义；本规范仅约束未修改阶段的输出契约。

---

# 5 Lexical conventions [lex]

## 5.1 Tokens [lex.token]

| 类别 | 定义 |
|--|--|
| identifier | `[A-Za-z_$][A-Za-z0-9_$]*` |
| keyword | 保留字（见 [grammar.kw]）；词类关键字匹配要求词边界 |
| number | [lex.number] |
| string | [lex.string] |
| comment | [lex.comment] |

## 5.2 Identifiers [lex.ident]

- **[lex.ident]/1** 标识符以字母、`_` 或 `$` 开头，后续为字母、数字、`_`、`$`。

## 5.3 Numbers [lex.number]

- **[lex.number]/1** 十进制、`0x/0X` 十六进制、`0b/0B` 二进制、`0o/0O` 八进制。
- **[lex.number]/2** 小数：`.` 后必须跟数字，否则该 `.` 属于后缀/成员。
- **[lex.number]/3** 科学计数：`1e3`、`1.5e-2`、`2E+5`。
- **[lex.number]/4** 进制前缀后无合法数字时，仅前缀前的 `0` 为数字字面量。

## 5.4 Strings [lex.string]

- **[lex.string]/1** 定界符为 `'`、`"`、`` ` ``，成对出现。
- **[lex.string]/2** `\` 引导转义；转义表与 JSON 一致；未知转义保留转义符后的原字符。

## 5.5 Comments [lex.comment]

- **[lex.comment]/1** `//` 至行尾；`/* */` 可跨行。注释在词法层产出 token，语法层丢弃。

---

# 6 Grammar [grammar]

## 6.1 Files [grammar.file]

```
file        := link* top-block*
link        := 'link' 路径 'as' 标识符 ';'
top-block   := module-block | value-block
module-block := 修饰符* 名字 ':' 'module' '{' 块* '}'
value-block := 'value' 字面量类型 '{' (operation | cast)* '}'
```

- **[grammar.file]/1** 顶层只能是 module 块或 value 块；否则 ill-formed。
- **[grammar.file]/2** link 别名在同一文件内唯一；否则 ill-formed。
- **[grammar.file]/3** value 块无名字，其类型决定实例化后的模块名（number/boolean）。
- **[grammar.file]/4** value 块的子项只能是 operation 或 cast（[grammar.value]）。

## 6.2 Blocks [grammar.block]

```
块        := 修饰符* 名字 ':' 块体
块体      := module 体 | class 体 | interface 体 | enum 体 | 函数 | 变量 | operation体 | cast 体
函数      := 泛型声明? 返回类型 '(' 参数 (',' 参数)* ')' 函数体
函数体    := 命令 | ';'
变量      := 类型 ('=' 表达式)? ';'
enum      := 'enum' '{' 标识符 (',' 标识符)* '}'
class     := 'class' 泛型声明? 'implements' 类型? '{' 块* '}'

```

- **[grammar.block]/1** 函数体省略（`;`）表示无实现声明。
- **[grammar.block]/2** 同一作用域内同名函数构成重载组；同名非函数块与函数块混用 ill-formed。
- **[grammar.block]/3** enum 子项重名 ill-formed。
- **[grammar.block]/4** class/interface 的 `implements` 子句可选；引用的必须是 interface，否则 ill-formed。
- **[grammar.block]/5** class/interface 的成员只能是函数、变量、operation 或 cast（[grammar.op]）；module 的成员只能是块；enum 的成员只能是标识符。
- **[grammar.block]/6** class/interface 的 operation/cast 成员不带名字前缀；其重载键为该类实例类型（[static.overload]）。
- **[grammar.block]/7** 未有实现支持的构件见 [gaps]。

## 6.3 Modifiers [grammar.mod]

```
修饰符 := ('public'|'private'|'static'|'unstatic'|'async'|'sync')*
```

- **[grammar.mod]/1** 互斥对 `(public,private)`、`(static,unstatic)`、`(async,sync)` 同时出现 UB；同一修饰符重复出现 UB。
- **[grammar.mod]/2** module/class/interface/enum 块强制 static、sync；value 块强制 public、static、sync。
- **[grammar.mod]/3** module 内变量必须 static，否则 ill-formed。
- **[grammar.mod]/4** 规范规定 module 下函数均为 static：仅 `unstatic` 的函数在调用约定中携带隐式接收者（[isa.call]）。

## 6.4 Value blocks [grammar.value]

- **[grammar.value]/1** value 块的字面量类型只能是 `number` 或 `boolean`；其他类型 ill-formed。
- **[grammar.value]/2** 子项语法：`operation 运算符 lambda` 与 `cast 类型 lambda`；子项不带名字。
- **[grammar.value]/3** operation 的运算符取自全部可重载符号（含 `[]` `()`）。
- **[grammar.value]/4** cast 的 lambda 必须恰有一个参数；否则 ill-formed。
- **[grammar.value]/5** value 块实例化后的模块名固定为其字面量类型名（`number`/`boolean`）；同类型多个 value 块的合并语义 unspecified。

## 6.5 Types [grammar.type]

```
类型      := 基本类型 后缀*
后缀      := '[' ']' | '*' | '&'
基本类型  := 'number'|'boolean'|'void'|'@'标识符|'(' 类型 ')'|类路径|lambda 类型
类路径    := 标识符 ('.' 标识符)* 泛型实参?
lambda 类型 := 泛型声明? '(' 参数类型 (',' 参数类型)* ')' '=>' 类型
```

## 6.6 number model [grammar.number]

- **[grammar.number]/1** `number` 的存储为任意精度：uint32 范围内的值直接表示。
- **[grammar.number]/2** 参与 number 运算的值超出 uint32 时，运算行为 UB（[ub.bignum]）。
- **[grammar.number]/3** boolean 以 0/1 数表示。

## 6.7 Operations and casts [grammar.op]

```
operation := 'operation' 运算符 lambda
cast      := 'cast' 类型 lambda
运算符    := 全部二元/一元运算符 | '[' ']' | '(' ')'
```

- **[grammar.op]/1** cast 的 lambda 必须恰有一个参数；否则 ill-formed。
- **[grammar.op]/2** operation 的 lambda 必须至少有一个参数；否则 ill-formed。
- **[grammar.op]/3** 后缀 `++`/`--` 的 operation 签名固定为 `(操作数, number)`；前缀 `++`/`--` 为 `(操作数)` 单参数；两参版本与单参版本可共存，按使用点形态区分。
- **[grammar.op]/4** 运算符 `[]` 与 `()` 为双 token 构成，源码中 shall 不加引号书写（`operation []`、`operation ()`）；加引号形式 ill-formed。

---

# 7 Static semantics [static]

## 7.1 Name resolution [static.name]

- **[static.name]/1** 标识符按词法作用域链解析：内层块 → 外层块 → … → 文件级；未解析标识符 ill-formed。
- **[static.name]/2** 变量在符号表中以其类型登记；module/class/function 以块实体登记。
- **[static.name]/3** link 别名指称被链接的顶层块；被链接模块不存在 ill-formed。
- **[static.name]/4** class/interface 内 `this` 指称自身实例；module 内 `up` 指称父块。
- **[static.name]/5** label 的作用域为其所在函数；同一函数内 label 唯一，否则 ill-formed；goto 允许前向引用。

## 7.2 Type rules [static.type]

- **[static.type]/1** 内建二元运算（[expr.add] 等）要求两侧操作数同为 number，结果为 number；比较运算（`==` `!=` `<` `>` 及布尔域的 `| & ^ == != < >`）结果为 boolean。
- **[static.type]/2** 一元 `-`/`~` 要求 number；`!` 要求 boolean；前缀/后缀 `++`/`--` 要求 number。
- **[static.type]/3** 索引 `a[i]`：a 为数组且 i 为 number，结果为元素类型的左值引用；或命中 `'[]'` 重载。
- **[static.type]/4** 赋值 `x = v`：v 可赋给 x 的类型；复合赋值 `x op= v` 等价 `x = x op v`。
- **[static.type]/5** 引用类型变量必须初始化且初始化必须是左值；否则 ill-formed。
- **[static.type]/6** 函数返回：`return e` 要求 e 可赋给函数返回类型；无值 `return` 要求返回类型为 void；否则 ill-formed。
- **[static.type]/7** 三元 `c ? a : b`：c 可转换至 boolean，a 与 b 的公共类型为结果类型；无公共类型 ill-formed。
- **[static.type]/8** 条件语境（if/while/三元条件/for 条件）：非 boolean 条件自动尝试一次到 boolean 的转换；失败 ill-formed。

## 7.3 Overload resolution [static.overload]

- **[static.overload]/1** 调用 `f(a₁,…,aₙ)` 的候选为同名重载组全体；候选按参数相容筛选后按具体性决议：若存在参数比候选更具体的其他候选，则该候选被淘汰。
- **[static.overload]/2** 恰有一个存活候选 → 决议成功；零个或多个 → ill-formed。
- **[static.overload]/3** 显式泛型实参在相容筛选前注入。
- **[static.overload]/4** operation/cast 决议同上：先按签名相容筛选，再做具体性决议，必须唯一；具体性比较只在通过筛选的候选间进行，且要求候选参数个数相同。
- **[static.overload]/5** operation 的重载键为接收者类型（第一形参）；cast 的重载键为其输出类型，使用点按目标类型查询。
- **[static.overload]/6** 命中重载后，运算符/转换使用点绑定到该 operation/cast 的指称（宿主路径 + `operation@`/`cast@` + 序号），脱糖将其落地为一次函数调用。

## 7.4 Diagnostics [static.diag]

- **[static.diag]/1** 全部静态诊断 shall 在 checker 阶段以异常抛出，消息 shall 非空并 shall 包含行号。
- **[static.diag]/2** 存在任一静态诊断时编译器 shall 不产出二进制。

---

# 8 Runtime semantics [runtime]

## 8.1 Evaluation order [runtime.order]

除另有规定外：

- **[runtime.order]/1** 语句按出现顺序依次求值。
- **[runtime.order]/2** 二元运算：先求左操作数，后求右操作数，再产生结果。
- **[runtime.order]/3** 一元/后缀运算：先求操作数。
- **[runtime.order]/4** 赋值 `x = v`：先求 v，再求 x 的地址，最后写入。
- **[runtime.order]/5** 复合赋值 `x op= v` 等价于 `x = x op v`（x 的左值只求一次地址）。
- **[runtime.order]/6** 调用 `f(a₁,…,aₙ)`：实参自左向右求值，随后求值被调指称，随后发生调用。
- **[runtime.order]/7** 三元 `c ? a : b`：先求 c；仅求值被选中分支。
- **[runtime.order]/8** 数组/对象字面量：元素/成员自左向右求值并写入。
- **[runtime.order]/9** `&&`/`||`/`!=` 无内建语义，求值顺序由其标准库 operation 定义（[std]）。
- **[runtime.order]/10** 表达式语句：求值表达式并丢弃其值。

## 8.2 Variables [runtime.var]

- **[runtime.var]/1** 变量声明引入一个槽；有初始化器时声明即执行初始化赋值。
- **[runtime.var]/2** 无初始化器的声明仅引入槽，其内容为 null。
- **[runtime.var]/3** 标识符读取求值为变量的当前内容；标识符作为左值/取地址目标时求值为变量槽的地址。

## 8.3 Functions and calls [runtime.call]

- **[runtime.call]/1** 函数名指称一个函数实体；重载组按 [static.overload] 决议。
- **[runtime.call]/2** 调用将实参按位置传入参数区，被调体执行至返回（[isa.call]）。
- **[runtime.call]/3** `return e` 求值 e 并将值作为调用结果返回；无值 `return` 返回 null。
- **[runtime.call]/4** 函数体执行至末尾等同执行了无值 `return`（缺失 RET 为 UB，见 [ub.ret]）。
- **[runtime.call]/5** `unstatic` 函数经接收者调用时，接收者占据参数区第一槽绑定 `this`。
- **[runtime.call]/6** `new C(a₁,…,aₙ)` 求值为调用 `C.constructor`，实参为 a₁..aₙ，接收者为正在构造的实例；constructor 体末尾隐式返回该实例，实例即 `new` 表达式的值。

## 8.4 Loops [runtime.loop]

- **[runtime.loop]/1** `while (c) body`：重复求值 c，为真时求值 body；c 为假时循环结束。
- **[runtime.loop]/2** `do body while (c)`：先求值 body 一次，随后与 while 相同。
- **[runtime.loop]/3** `for (init; c; step) body`：求值 init（一次）、c、body、step 循环往复；c 为假时结束。
- **[runtime.loop]/4** `break` 终止最近层循环；`continue` 跳过本轮剩余体并进入条件求值（for 含 step）。
- **[runtime.loop]/5** label/goto 提供函数内非结构控制转移；转移不调整任何栈。

## 8.5 Exceptions [runtime.exc]

- **[runtime.exc]/1** `throw e` 以 e 为异常值引发中断。
- **[runtime.exc]/2** 中断被最近的 `try` 的处理块捕获；catch 变量绑定异常值。
- **[runtime.exc]/3** finally 体在 try 正常结束与 catch 结束后各执行一次。
- **[runtime.exc]/4** 无处理块覆盖的中断：行为 UB。

## 8.6 Semantic equivalences [dsugar]

以下改写为规范性的语义等价：改写前后程序的可观测行为 shall 相同。实现可以采用任何产生相同可观测行为的机制。

- **[dsugar]/1** `var x: T = v;` ≡ 引入槽 x 并执行赋值 x = v。
- **[dsugar]/2** `x op= v;` ≡ `x = x op v`。
- **[dsugar]/3** 表达式语句 ≡ 求值表达式并丢弃其值。
- **[dsugar]/4** `while (c) body` ≡ 重复`求值 c；为真则求值 body`；`do body while (c)` ≡ 先求值 body 一次再循环；`for (init; c; step) body` ≡ init、`while (c) { body; step }`。
- **[dsugar]/5** `break`/`continue` ≡ 转移到最近层循环的出口/继续点。
- **[dsugar]/6** `switch (x) { case v₁ => s₁ … default => sd }` ≡ 依序比较 x 与各 vᵢ，命中执行对应 sᵢ，否则执行 sd。
- **[dsugar]/7** 函数指称 ≡ 一个以其形参、返回类型与体定义的函数值；module 下函数为 static（无接收者）。
- **[dsugar]/8** enum `E { A, B }` ≡ 一组以成员名指称、值为序号的 number 常量。
- **[dsugar]/9** value 块 ≡ 以字面量类型名指称的 operation/cast 集合。

## 8.7 await [runtime.await]

- **[runtime.await]/1** `await 命令` 将命令作为独立协程启动；不阻塞当前执行流，两者的相对顺序 unspecified。

---

# 9 Instruction set bzx-ins1 [isa]

> 本节是编译器与 VM 之间的交换契约。合觃编译器产出本节定义的指令序列；合觃 VM 按本节语义执行。

## 9.1 Encoding [isa.enc]

- **[isa.enc]/1** 每条指令 16 字节：4 字节操作码 + 3 个 4 字节大端参数（v1,v2,v3）；缺失参数按 `reg 0` 填充。
- **[isa.enc]/2** 操作码 = `(基号+子号) × 8 + 寻址位`；寻址位 = `(v1 是 value ? 4:0) + (v2 是 value ? 2:0) + (v3 是 value ? 1:0)`。

基号表：

| 基号 | 指令 | 基号 | 指令 | 基号 | 指令 |
|--|--|--|--|--|--|
| 0 | MOV | 8 | RET | 16 | OUT |
| 1 | REF | 9 | PUSH | 17 | GC |
| 2 | JZ | 10 | POP | 18 | DELETE |
| 3 | CZ | 11 | OFFSET_SET | 19 | INT |
| 4 | TZ | 12 | OFFSET_GET | 20 | INT_REGISTER |
| 5 | JMP | 13 | PARAM_LOAD | 21 | INT_GET |
| 6 | CALL | 14 | PARAM_SET | 22 | NOT |
| 7 | THREAD | 15 | IN | 23 | BIT_NOT |
|  |  |  |  | 24 | BINARY |

BINARY 子号：`add 0 / sub 1 / mul 2 / div 3 / mod 4 / shl 5 / shr 6 / and 7 / or 8 / xor 9 / eq 10 / grt 11 / smr 12`。

## 9.2 Operand model [isa.op]

| 位置 | `reg n` | `value n` |
|--|--|--|
| 目标（左值） | 槽 n ← 源 | p ← 槽 n 的内容；*p ← 源（间接写） |
| 源（右值） | 立即数 n | 槽 n 的内容 |

## 9.3 Data instructions [isa.data]

| 指令 | 形式 | Effects |
|--|--|--|
| MOV dst, src | 2 | 按 [isa.op] 写入 |
| REF dst, src | 2 | dst ← 指向 src 槽内容所表示地址的引用值 |
| NOT / BIT_NOT dst, src | 2 | dst ← !src / ~src |
| BINARY op, dst, l, r | 3 | dst ← l op r（op ∈ 子号表） |
| OFFSET_SET obj, idx, val | 3 | obj[idx] ← val（数组=下标；对象=成员槽 id） |
| OFFSET_GET dst, obj, idx | 3 | dst ← obj[idx] 的槽地址（常跟 REF 包装为引用值） |
| PUSH slot / POP | 1 / 0 | 进入/恢复上下文；VM 自管配对 |
| DELETE slot | 1 | 删除该槽 |
| GC | 0 | 建议 VM 执行回收 |
| IN oper, target / OUT oper, target | 2 | 宿主交互：oper=命令字，target=数据槽；命令字集合由宿主定义 |

## 9.4 Control transfer [isa.flow]

- **[isa.flow]/1** target 的解释由操作数类型决定，与 frame 无关：`reg n` = 立即数块号 n；`value n` = 槽间接（读槽 n 内容得目标块号）。
- **[isa.flow]/2** frame 标记是否函数帧：`frame=0` 块级——`CZ/JZ` 进入的块执行到块尾自动返回调用点，`THREAD` 将块作为协程启动；`frame=1` 函数级——`CALL` 创建新函数帧，`RET` 执行提前返回。
- **[isa.flow]/3** 函数帧的块尾自动返回；缺失显式 RET 为 UB（[ub.ret]）。
- **[isa.flow]/4** JZ/CZ/TZ = 带条件的 JMP/CALL/THREAD：cond 槽内容 = 1 执行，= 0 不执行。
- **[isa.flow]/5** goto/label 编译为块边界：label 处结束当前块（以 `JMP(label块号, frame=0)` 收尾）并从该块号开新块；goto 产生 `JMP(label块号, frame=0)`。

## 9.5 Calling convention [isa.call]

- **[isa.call]/1** 参数槽区：槽 0 = 返回值，槽 1..n = 实参。
- **[isa.call]/2** 调用方：`PARAM_SET(reg(i+1), value(arg槽))` 逐个写入实参 → `PUSH` 自身参数槽 → `CALL(value(目标槽), frame=1)` → `POP` 恢复 → `PARAM_LOAD(value(结果槽), reg(0))` 取返回值。
- **[isa.call]/3** 被调方入口：`PARAM_LOAD(reg(形参槽), reg(i+1))` 逐个取实参；`unstatic` 函数的槽 1 绑定 `this`，显式参数自槽 2 起。
- **[isa.call]/4** 返回：`PARAM_SET(reg(0), value(结果槽))` → `RET(reg(1))`。

## 9.6 Interrupts [isa.int]

| 指令 | Effects |
|--|--|
| INT_REGISTER block | 注册中断处理块 |
| INT data | 以 data 槽内容为异常值引发中断 |
| INT_GET dst | 取出当前中断异常值写入 dst |

---

# 10 Interchange binary format [binfmt]

```
'SLANG'            5 字节魔数
'bzx-ins1'         8 字节格式版本
uint64BE           id 空间总长（块号+槽号上限）
'POOL_START'
  uint32BE × N     常量池条目
'POOL_END'
'CODE_START'
  ('BLOCK_START' uint32BE 块号 指令×16字节* 'BLOCK_END')*
'CODE_END'
```

- **[binfmt]/1** 常量池条目当前仅为 number；任意精度/null 编码定稿前，超出 uint32 的条目编码 unspecified。

---

# 11 Standard library requirements [std]

- **[std]/1** 以下 operation 由标准库提供，签名与语义由标准库规范定义；标准库缺失时程序按 [ub.logic] 处理：`!=` `&&` `||`。
- **[std]/2** `!=`/`&&`/`||` 之外的运算符内建于 [static.type] 与 [isa]；指针解引用/取地址内建于 [static.type]（[lang.expr]/7）。
- **[std]/3** 非 32 位 int 的 number 算术运算（任意精度路径）行为 UB（[ub.bignum]）。
- **[std]/4** 字符串及容器设施由标准库提供。

---

# 12 Undefined behavior index [ub]

| 条目 | 触发 |
|--|--|
| [ub.mod] | 互斥修饰符同时出现；同一修饰符重复出现 |
| [ub.logic] | 使用 `!=`/`&&`/`||` 而标准库未提供对应 operation |
| [ub.bignum] | 参与 number 运算的值超出 uint32（任意精度运算路径未定义） |
| [ub.ret] | 函数体缺失 RET（块尾自动返回为约定行为） |
| [ub.enc] | 生成阶段遇到未定义编码输入（undefined/NaN 参数写 0） |
| [ub.foreign] | 插件替换阶段后的行为 |
