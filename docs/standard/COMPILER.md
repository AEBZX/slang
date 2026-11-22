# COMPILER 规范

本文档定义 Slang 编译器的**实现规范**：对源文件集合的输入行为、语法、语义、中间表示、指令集与二进制产物。
其目的是统一不同实现之间的行为，确保它们在处理相同输入时产生相同输出。

> 标注 **[TBD]** 的条目是尚未定稿的部分（多为与 null/任意精度 number 方案联动的编码细节）。
> 标注 *（注）* 的条目是从当前实现反推的约定，若与设计意图冲突以实现为准并应回改本文档。

# 1. 暴露接口

应当暴露一个默认导出的 JavaScript/TypeScript 函数：

```typescript
export default function (source: string[],
                         plugin: (pipeline: PeepholeTool[], config: any) => PeepholeTool[],
                         config: any): Buffer;
```

|参数|语义|
|--|--|
|source|所有被编译的 .sl 文件内容集合|
|plugin|插件集合，在管线启动前对管线做变换|
|config|编译配置（优化级别等）|
|返回值|二进制产物（见 §9）|

## 1.1 PeepholeTool

管线的每一级都是一个 `PeepholeTool`：

```typescript
export type peephole_type='lexer'|'parser'|'check'|'desugar'|'hir'|'ir'|'optimize'|'generate'
export default class PeepholeTool{
    constructor(public name:peephole_type){}
    run(param:any):any{}
    use(data:any):PeepholeTool{return null}
}
```

|函数|作用|
|--|--|
|构造函数|区分阶段类型|
|run|接收上一级产物，返回本阶段产物|
|use|注入本阶段的规则/visitor 表|

特殊语义：

|条件|要求|
|--|--|
|name==lexer|必须接受 `string[]`，返回 `token[][]`|
|name==parser|返回 `ASTTree[]`（File 节点）|
|name==check|返回作用域对象；若收集到错误，必须以 `Error` 抛出，消息以 `check 报错:` 开头|
|name==generate|必须返回 `Buffer`|

## 1.2 运行顺序

```typescript
for (const i of plugin) pipeline = i(pipeline, config)
let ret = pipeline[lexer].run(source)
ret = pipeline[parser].run(ret)
ret = pipeline[check].run(ret)      // 报错则抛出
ret = pipeline[desugar].run(ret)
ret = pipeline[hir].run(ret)
ret = pipeline[ir].run(ret)
ret = pipeline[optimize].run(ret)
ret = pipeline[generate].run(ret)
return ret
```

# 2. 编译管线与各阶段产物

|阶段|输入|输出|职责|
|--|--|--|--|
|lexer|`string[]`|`token[][]`|分词；token 携带 `行:列` 定位；注释作为 token 保留，由 parser 丢弃|
|parser|`token[][]`|`File[]`（AST）|CST 规则匹配 → AST 构建；parser 不做错误恢复，规则结束后仍有剩余 token 即语法错误|
|check|`File[]`|作用域对象|四轮检查：censor（结构）→ symbol（符号）→ build（全局注册）→ type（类型），见 §4|
|desugar|`File[]`|`File[]`|语法糖降级，见 §5.2|
|hir|`File[]`|`[HScope, HModule[]]`|槽号化：标识符→槽号、label→块号，见 §7|
|ir|同上|`IRTool`（块化指令）|HIR→IR 指令块，见 §8|
|optimize|`IRTool`|`OPTTool`|优化（当前为占位，仅透传代码/常量池/id 计数）|
|generate|`OPTTool`|`Buffer`|二进制序列化，见 §9|

# 3. 语法

## 3.1 词法

- 标识符：`[A-Za-z_$][A-Za-z0-9_$]*`。
- 数字：十进制；`0x/0X` 十六进制、`0b/0B` 二进制、`0o/0O` 八进制；小数（`.` 后必须跟数字）；科学计数 `1e3 / 1.5e-2`。
- 字符串：`'` `"` `` ` `` 三种引号成对出现；`\` 转义按 JSON 转义表解析（不认识的转义保留原字符）。词法层**不含引号**返回内容。
- 注释：`//` 行注释与 `/* */` 块注释；不参与语法。
- 换行与空格是空白；token 均记录 `行:列`。

## 3.2 文件与块

```
文件   := link* 块顶层*
link   := 'link' 路径 'as' 标识符 ';'        // 路径是点分类型路径
块顶层 := value | 块
块     := 修饰符* 名字 ':' 块体
块体   := module 体 | class 体 | interface 体 | enum 体 | 函数 | 变量

module    := 'module' '{' 块* '}'
class     := 'class' 泛型声明? 'implements' 类型? '{' 块* '}'
interface := 'interface' 泛型声明? 'implements' 类型? '{' 块* '}'
enum      := 'enum' '{' 标识符 (',' 标识符)* '}'
函数      := 泛型声明? 类型 '(' 参数 (',' 参数)* ')' (命令 | ';')   // 命令通常为 '{...}' 块
变量      := 类型 ('=' 表达式)? ';'
泛型声明  := '<' 标识符 ('implements' 类型)? (',' ...)* '>'
修饰符    := ('public'|'private'|'static'|'unstatic'|'async'|'sync')*
```

- 函数即 `名字: 返回类型(参数列表) {体}`；`Implement` 为 `;` 时是纯声明。
- 重载：同作用域同名函数合法，按声明顺序获得重载序号（决议见 §4.3）。
- value 块：

```
value     := 'value' 字面量类型 '{' (operation | cast)* '}'
operation := 'operation' 符号 lambda        // 符号 ∈ 运算符全集 + '[]' + '()'
cast      := 'cast' 类型 lambda
lambda    := 泛型声明? '(' 参数 (',' 参数)* ')' '=>' 类型 命令
```

- value 的类型只能是 `number` / `boolean`（LiteralType）。desugar 后 value 块被重命名为名为 `number` / `boolean` 的 module，其 operation/cast 成员被重命名为 `operation@序号` / `cast@序号` 的普通函数。
- `operation '++'`（后缀自增）签名固定为 `(操作数, number)`，第二个参数是占位参数；前缀自增为 `(操作数)` 单参数 —— 以此区分前后缀。
- enum 成员值为其声明序号（从 0 开始）。

## 3.3 类型

```
类型     := 基本类型 类型后缀*
类型后缀 := '[' ']' | '*' | '&'
基本类型 := 'number'|'boolean'|'void'|'null'? 泛型 '@'标识符 | '(' 类型 ')' | lambda类型 | 类路径
类路径   := 标识符 ('.' 标识符)* 泛型实参?
lambda类型 := 泛型声明? '(' 参数类型 (',' 参数类型)* ')' '=>' 类型
```

|类型|含义|
|--|--|
|`number`|任意精度数（见 §6.3）|
|`boolean`|布尔（运行时以 0/1 数表示，见 §6.3）|
|`void`|空类型；同时是"无值/未解析"的标记|
|`T[]`|数组|
|`T*`|指针|
|`T&`|引用；引用变量必须初始化，且初始化必须是左值|
|lambda 类型|函数值类型；`overload` 标记表示一组同名重载|
|`@T`|泛型参数引用|

- 引用类型带 `literal` 标记：`identifier`（变量/索引这类无需特殊处理的左值引用）与 `call`（返回引用的调用产生的引用值，使用前需解引用）。

## 3.4 表达式（优先级从低到高）

|层级|运算符|结合|
|--|--|--|
|三元|`? :`|右结合|
|逻辑或|`||`||
|逻辑与|`&&`||
|位或|`\|`||
|异或|`^`||
|位与|`&`||
|相等|`==` `!=`||
|关系|`<` `>` `<=` `>=`||
|移位|`<<` `>>`||
|加减|`+` `-`||
|乘除模|`*` `/` `%`||
|前缀|`(类型)` 强转、`++` `--` `!` `~` `-` `*` 解引用、`&` 取地址、`new`|右结合|
|后缀|`++` `--` `.成员` `[索引]` `(调用)`（含显式泛型实参 `<T,...>`）|左结合|
|初等|字面量、标识符、lambda、`(表达式)`、`[数组字面量]`||

- `new` 语法固定为 `new 类名<泛型实参?>(实参)`；语义上改写为对 `类名.constructor` 的调用（§6.4）。
- lambda：`(参数) => 返回类型 {体}`，参数带类型标注。

## 3.5 语句

```
命令 := 块命令 | 基本命令
块命令 := if | while | do-while | for | foreach | switch | try | '{' 命令* '}'

基本命令 :=
    'var' 标识符 ':' 类型 ('=' 表达式)? ';'   // 变量声明
  | 表达式 赋值符 表达式 ';'                  // 13 种赋值符：= += -= *= /= %= &= |= ^= <<= >>= &&= ||=
  | 表达式 ';'                                // 表达式语句
  | 'await' 命令                              // 协程（§6.7）
  | 'return' 表达式? ';'
  | 'break' ';' | 'continue' ';'
  | 'throw' 表达式 ';'
  | 'vm' '(' 字符串 (',' 表达式)* ')' ';'     // 内联指令（§8.9）
  | 'delete' 表达式 ';'
  | 标识符 ':'                                // label
  | 'goto' 标识符 ';'                          // goto

switch 的 case := 'case' 表达式 '=>' 命令
try := 'try' 命令 ('catch' '(' 标识符 ':' 类型 ')' 命令)? ('finally' 命令)?
```

- 赋值是**语句**而不是表达式，不存在 `a = b = c` 链。
- label 的语法是 `名字:` 后紧跟一条命令（没有空语句形式）。

# 4. 检查阶段（check）

四轮按序执行；symbol 与 build 通过 `call(节点, 轮次)` 互相交错递归，以处理嵌套作用域：

|轮|名称|职责|
|--|--|--|
|0|censor|结构校验：修饰符合法性、块内成员种类、enum 重名、lambda 参数/泛型重名、引用必须初始化、cast 单参数、operation 非零参数、break/continue 必须在循环内|
|1|build|全局符号注册：模块/类/静态函数/静态变量路径、函数重载表、operation/cast 注册表、implement 继承链|
|2|symbol|符号表构建（§4.2）、link 别名绑定、label 注册与 goto 延迟结算（§4.2）、泛型检查|
|3|type|类型推导与决议：表达式/语句类型标注、重载决议、cast 插入、`oper`/`cast` 调用路径写入|

所有 visitor 通过 `call(节点, 轮次, scope)` 把**当前作用域显式传给子节点**；进入新作用域（函数体/lambda 体/语句列表/for/catch）的 visitor 必须把 enter 后的作用域作为第 3 参传出，否则子节点会拿到父级作用域。

## 4.1 修饰符规则

- `(public, private)`、`(static, unstatic)`、`(async, sync)` 互斥，同时出现是 UB；重复出现同一修饰符是 UB。
- module / class / interface / enum 强制 `static=true, sync=true`；value 强制 `public=true, static=true, sync=true`。
- module 内的变量必须 `static`。
- private 成员仅当前块内可见；`this` 的成员访问不受 private 限制。

## 4.2 作用域与符号

- 文件级作用域持有 link 别名 → 被链接块。
- class/interface 内：`this` = 指向自身 ClassType 的引用；module 内：`up` = 父路径 BlockType。
- 变量在符号表中以其**类型**登记；块（module/class/function）以块节点登记。
- 标签作用域：label 注册到最近的**函数作用域**（函数体/lambda 体为边界）；同一函数内标签必须唯一；**goto 允许前向引用**（延迟到函数作用域结束时统一结算，未定义则报错）。

## 4.3 类型推导与决议

- `type_is(a, b)` 求两类型的最小超类型：引用剥离后比较；泛型解析后比较；LiteralType 相等才相容；数组/指针逐元素；lambda 逐参数/泛型/返回值；ClassType 走 implement 继承链；enum 同路径；否则不相容（VoidType）。
- 二元表达式决议顺序：先查 `operation` 重载 → 内建集合（§6.4）→ 双侧尝试 cast 到 number/boolean。
- 赋值决议：先查赋值运算重载 → 左值必须是引用 → `=` 要求类型相容 → 布尔系赋值符（`&= |= &&= ||=`）要求双侧布尔 → number 系 → 尝试 cast。
- 函数调用决议：显式泛型实参注入 → `param_check`（参数相容 + 泛型数量）筛选 → 具体性决议（`param_best`：存在参数比候选更具体的其他候选则淘汰）→ 必须唯一。调用成功后在 AST 上写入 `call_target = 全局路径 '@' 重载序号`。
- 条件语境（if/while/三元条件）：非 boolean 条件自动尝试一次 cast 到 boolean。
- foreach：容器类型 → 数组（元素类型作为迭代变量类型）；否则先查与迭代变量同名的 operation，再尝试 cast 到数组。

# 5. 语义

## 5.1 语言内建能力的最小集

Slang 语言本体只提供**够用的最小内建集**，其余一切能力由标准库以 `value` 块（operation/cast）拼装：

|内建能力|说明|
|--|--|
|二元算术/位/比较|`+ - * / % << >> & \| ^ == > <`（操作数同为 number → number；比较结果为 boolean）|
|`!=` `&&` `\|\|`|**内建 VM 不提供**，由 Slang 层（标准库）以 operation 提供；标准库未提供时行为为 **UB**（当前实现编码为 opcode 0）。条件降糖产生的 `x != null` 依赖该 operation|
|一元|`!`（boolean）、`~` `-`（number）；前缀 `++` `--`（number，单参数）|
|后缀自增|`++` `--`（双参数 `(操作数, number占位)`，可重载）|
|数组索引|`a[i]` 读写（OFFSET_GET/OFFSET_SET）|
|成员访问|`a.b`（按成员槽 id 的 OFFSET_GET/OFFSET_SET）|
|赋值|13 种赋值符|
|`new`|改写为 `类名.constructor(实参)` 调用|
|`delete` `vm` `label/goto` `try/throw` `await`|见下文|

解引用 `*p` / 取地址 `&x`：`*p` 是对名为 `'&'` 的 operation 的调用、`&x` 是对名为 `'*'` 的 operation 的调用 —— 由标准库（指针类型）提供。编译器自身插入的引用处理（§5.3 de_ref）走 REF 指令，不经 operation。

## 5.2 desugar 降级规则

desugar 把语法统一降级为极小的核心形态：

|源语法|降级产物|
|--|--|
|变量声明 `var x: T = v`|赋值 `x = v`；局部变量的槽由 HIR 阶段分配（首次赋值懒分配）|
|复合赋值 `x += v` 等|无重载时降为 `x = x + v`|
|函数 `f`（重载序号 k）|Variable `f@k`，值为 lambda 表达式；类/接口成员函数追加 `this` 引用参数；`constructor` 追加隐式 `return this`|
|value 块|Module `number`/`boolean`；operation→函数 `operation@序号`，cast→函数 `cast@序号`|
|enum|一组静态 number 变量|
|while|`label 'while'; 体; if(cond) goto 'while'; label 'break';`|
|do-while|体一次 + while 结构|
|for|init 序列 + while(init;cond;step)|
|foreach|`for@index` 下标 + while + 每轮把 `容器[for@index]` 存入迭代变量|
|switch|case 的 if-else 链|
|break / continue|`goto 'break'` / `goto 'while'`|
|表达式语句|赋值给哑变量 `';Im air'`（该名字不可能与用户标识符冲突）后丢弃|
|boolean 字面量|number 1 / 0|
|单字符字符串|number（UTF-8 字节按大端打包）|
|多字符字符串|number 数组字面量（每字符一个 number）|
|超出 uint32 的 number 字面量|嵌套数组 `[[整商,整余],[小数商,小数余]]`（§6.3）|
|带重载的运算/索引/解引用/取址/调用/强转|对 `全局路径.operation@N` / `cast@N` / `call_target` 的调用表达式|
|无重载的运算|保留原表达式节点，走内建指令（§5.1）|
|非 `identifier` 引用值的使用处|包裹解引用（HIR 层 REF 指令）|

## 5.3 引用与指针

- `T&` 引用是"指向槽的值"；`T*` 指针以整数地址参与运算（地址即槽号）。
- 引用赋值/传参绑定的是**左值本身**（`identifier` 引用不拷贝）；`call` 引用携带运行时地址，使用时由编译器插入解引用。
- `delete` 接受一个槽地址（左值/引用/索引结果），删除它指向的槽。

## 5.4 try / catch / finally / throw

编译到中断指令（§8.6）：`INT_REGISTER` 注册处理块，`throw` 即 `INT`（携带异常值），catch 变量由 `INT_GET` 取出。finally 由编译器排在 try 正常路径与 catch 路径之后各调用一次。异常值不按类型分派：一个 try 只有一个 catch。

## 5.5 label / goto

- 作用域：函数级；同一函数内唯一；允许前向引用（§4.2）。
- 实现：label 是块边界（§8.4）；`break`/`continue` 降糖为对保留标签 `break`/`while` 的 goto。
- goto 可跨越块边界跳出/跳入（同一函数内）；跳转不做栈调整，由目标位置的代码结构保证一致性。

## 5.6 delete / vm / await

- `delete expr`：expr 必须是引用（左值）；指令行为见 §8.3。
- `vm("助记符", p1, p2, p3)`：内联指令，见 §8.9。
- `await 命令`：把命令切到独立块并作为**协程**启动（`THREAD`，frame=0）；**不阻塞**当前执行流 —— 语义是"单独开一个协程执行这段代码"。

## 5.7 入口约定

- 入口是名为 `main` 的全局变量（函数形式的 `main@0` 同样视为入口；其值为 lambda）。
- 块 0 是 VM 的运行起点：先执行全部全局变量的初始化（每个全局变量：求值其 lambda → 写入全局槽），尾部以 `JMP(value(entry槽), frame=0)` 跳转 —— 槽内容 = main lambda 的块号。每个模块只发射一条（重复发射被去重）。

# 6. 运行时值模型

## 6.1 槽（slot）

VM 的可寻址单元是**槽**。以下 id 全部来自**同一自增 id 空间**（HIR 阶段分配全局变量/成员 id，IR 阶段延续同一计数器分配局部槽、临时槽与块号）：

- 全局变量槽、类/模块成员槽（成员访问按成员 id 偏移）；
- 函数局部槽/临时槽；
- 块号（代码块 id，与 label 共用）。

## 6.2 null

**null 是 0 号寄存器的值**：一个独立的标记值，不等于任何数字（≠ 0）。0 号寄存器只读，恒为 null。
*（注：foreach 终止条件、OFFSET_GET 越界行为与 null 的联动仍在定稿中，见 §12。）*

## 6.3 number（任意精度）

- 数值在 uint32 范围内时直接表示。
- 超出时以块表示：以 `2147483647` 为基数分块，整数部分 `[整商, 整余]`、小数部分（去尾零）`[小数商, 小数余]`，即 `[[整商,整余],[小数商,小数余]]` 的嵌套数组形式参与编译。
- boolean 以 0/1 数表示。

## 6.4 字符串

语言没有 string 类型：单字符字面量是 number（UTF-8 字节大端打包），字符串字面量是 number 数组。字符串操作由标准库提供。

# 7. HIR（槽号化中间表示）

HIR 阶段遍历 desugar 后的 AST：

- 为每个块/变量分配全局 id，注册 `全局路径 → id`（global 与各级局部作用域双份）；`unstatic` 成员打上实例标记。
- 标识符 → `HIdentifierExpr(槽号)`（局部变量查作用域链，全局查路径表）。
- label → `HLabel(块号)`；goto → `HGoto(块号)`（允许前向，块号由 label 预分配）。
- 成员访问链 `a.b.c` → **OFFSET_GET 链** `HIndexExpr(前缀, 成员id)`：前缀若是 link 别名先替换为真实路径；若最长前缀是模块/类（静态前缀）则以该前缀的全局槽为起点，剩余段逐级 OFFSET_GET；实例前缀（标记为 unstatic 的 id）整体作为对象。
- 语句集合 → `HListCommand`；try 的 catch 变量分配 id；函数/lambda 体保持 `HVariable(全局槽, 值)`。
- lambda 的值保留为 `HLambdaExpr(参数槽号表, 体)`；lambda 的运行时值是其**块号**。

# 8. 指令集（bzx-ins1）

## 8.1 指令编码

- 每条指令 **16 字节**：4 字节操作码 + 3 个 4 字节大端参数（v1, v2, v3）；缺失参数按 `reg 0` 填充。
- 操作码 = `(基号 + 子号) × 8 + 寻址位`，寻址位 = `(v1 是 value ? 4 : 0) + (v2 是 value ? 2 : 0) + (v3 是 value ? 1 : 0)`。

|基号|指令|基号|指令|基号|指令|
|--|--|--|--|--|--|
|0|MOV|8|RET|16|DELETE|
|1|REF|9|PUSH|17|INT|
|2|JZ|10|POP|18|INT_REGISTER|
|3|CZ|11|OFFSET_SET|19|INT_GET|
|4|TZ|12|OFFSET_GET|20|NOT|
|5|JMP|13|IN|21|BIT_NOT|
|6|CALL|14|OUT|22|BINARY|
|7|THREAD|15|GC|23/24|PARAM_SET / PARAM_LOAD|

BINARY 子号：`add 0 / sub 1 / mul 2 / div 3 / mod 4 / shl 5 / shr 6 / and 7 / or 8 / xor 9 / eq 10 / grt 11 / smr 12`。
（`eq/grt/smr` 只由内建二元表达式产生；`vm()` 助记符表暂未收录它们，见 §8.9。）

## 8.2 操作数模型

操作数分两类，按其在指令中的**位置**解释：

|位置|`reg n`|`value n`|
|--|--|--|
|目标（左值）|槽 n ← 源（直接写槽）|p ← 槽 n 的内容；*p ← 源（间接写，写指针指向的目标）|
|源（右值）|立即数 n|槽 n 的内容|

## 8.3 数据与运算指令

|指令|参数|语义|
|--|--|--|
|MOV dst, src|2|槽/指针写入，按操作数模型|
|REF dst, src|2|dst ← 引用值，指向 src 槽内容所表示的地址|
|NOT dst, src|2|dst ← !src（按位/逻辑取反，VM 规范定义）|
|BIT_NOT dst, src|2|dst ← ~src|
|BINARY op, dst, l, r|3|dst ← l op r；op ∈ §8.1 子号表|
|OFFSET_SET obj, idx, val|3|把 val 写入容器 obj 的 idx 位置（数组=下标；对象=成员槽 id）|
|OFFSET_GET dst, obj, idx|3|dst ← obj[idx] 的**槽地址**（常跟 REF 包装成引用值）|
|PUSH slot|1|进入上下文（保存该槽，VM 自管对应关系）|
|POP|0|恢复最近一次 PUSH 的槽|
|DELETE slot|1|删除参数给出的槽|
|GC|0|建议 VM 执行垃圾回收|
|IN oper, target|2|宿主交互：oper=命令字（干啥），target=数据槽|
|OUT oper, target|2|同上，方向相反；命令字集合由 VM/宿主定义（语言没有 native，IN/OUT 就是与宿主交互的通道）|

## 8.4 控制转移与帧

- **target 的解释由操作数类型决定**（与 frame 无关）：`reg n` = 立即数块号 n；`value n` = 槽间接（读槽 n 的内容得到目标块号，如 lambda 值槽）。
- **frame 只标记是否函数帧**：`frame=0` 为块级 —— `CZ/JZ` 进入的块执行到块尾自动返回调用点（G_If 的编排依赖此语义），`THREAD` 把块作为协程启动；`frame=1` 为函数级 —— `CALL` 创建新函数帧，`RET`（参数恒为 1）用于提前返回。**函数帧的块尾同样自动返回**；缺失 RET 属于 UB，编译器不强制报错。
- JZ/CZ/TZ = 带条件的 JMP/CALL/THREAD：**cond 槽内容 = 1 执行，= 0 不执行**。

## 8.5 调用约定

- 参数槽区：槽 0 = 返回值，槽 1..n = 实参（0 基实参 i 写入槽 i）。
- 调用方：`PARAM_SET(reg(i), value(arg槽))` 逐个写入实参 → `PUSH` 自己的参数槽（保护现场）→ `CALL(value(目标槽), frame=1)` → `POP` 恢复 → `PARAM_LOAD(value(结果槽), reg(0))` 从槽 0 取返回值。
- 被调方入口：`PARAM_LOAD(reg(形参槽), reg(i+1))` 逐个从槽 i+1 取实参。
- 返回：`PARAM_SET(reg(0), value(结果槽))` → `RET(reg(1))`。

## 8.6 异常（中断）

|指令|语义|
|--|--|
|INT_REGISTER block|注册中断处理块|
|INT data|抛出中断，data 槽内容为异常值|
|INT_GET dst|取出当前中断的异常值写入 dst（catch 变量）|

## 8.7 运算到指令的对应

|源语法|指令|
|--|--|
|内建二元运算|BINARY|
|`!` `~`|NOT / BIT_NOT|
|`a[i]` 读 / `a.b`|OFFSET_GET（+REF 包装引用）|
|`a[i]=v` / `a.b=v`|OFFSET_SET|
|`x = 表达式`|表达式结果入临时槽 → MOV|
|`*p = 表达式`（引用左值）|间接 MOV（value 目标）|
|数组/对象字面量|逐元素 OFFSET_SET|
|三元 `c ? a : b`|两个子块 + CZ/NOT/CZ|
|前缀/后缀 `++` `--`（内建 number）|BINARY add/sub ± 1|
|lambda 值|MOV 立即数（块号）|

## 8.8 块（block）与 label

- 代码以**块**为单位组织，块有全局唯一块号；label 即块边界：label 处结束当前块（以 `JMP(label块号, frame=0)` 收尾）并从 label 块号开新块。
- 块级调用进入的块执行到块尾自动返回（§8.4）。

## 8.9 vm() 语句与助记符

`vm("助记符", e1, e2, e3)`：三个实参表达式先求值到三个临时槽（p1, p2, p3，均以 value 传入），再由助记符构造指令。可用助记符（30 个）：

```
mov  add  sub  mul  div  mod  shr  shl  and  or  xor
not  bit_not  jmp  call  thread  jz  cz  tz  ret
push pop  param_load  param_set  offset_set  offset_get
delete  gc  in  out
```

- `mov` 源端强制 value；`jz/cz/tz` 第三个参数是条件；`in` 双 value。
- 注意：`eq/grt/smr` 比较指令只能由编译器内建二元表达式生成，vm() 暂无对应助记符。

# 9. 二进制格式

```
'SLANG'            5 字节魔数
'bzx-ins1'         8 字节格式版本
uint64BE           id 空间总长（块号+槽号上限）
'POOL_START'
  uint32BE × N     常量池条目（当前仅 number；编码随任意精度/null 方案定稿调整 [TBD]）
'POOL_END'
'CODE_START'
  ('BLOCK_START' uint32BE 块号 指令×16字节* 'BLOCK_END')*
'CODE_END'
```
# 10. 标准库职责边界

语言内建仅 §5.1 所列最小集。标准库（Slang 层）负责提供：

- number 的扩展运算、boolean 的 `&&`/`||`
- 类的 `constructor`；
- 容器（数组之外的结构，经 `'[]'` / `'()'` operation 重载接入 foreach 与调用语法）;
- 字符串及其他一切高级设施。

标准库同样运行在 bzx-ins1 指令集上，通过 `vm()` 语句直接使用底层指令实现原语。

# 11. 插件

插件签名 `(pipeline: PeepholeTool[], config: any) => PeepholeTool[]`，在管线运行前执行，可替换/增删任意阶段（§1.2 之外的行为由插件自担；遵循本规范的范围是：标准管线行为集合内的输出不变式）。

# 12. 当前实现状态（回归测试 2026-11-22，样例 S1–S11 全通过 + 单测 78 例全通过）

已全部落地：check 错误如实抛出；type_is 结构比较 + type_sub 子类型判定（param_best 布尔化）；fast_cast/type_sub 调用点传类型而非节点；Scope.enter 继承函数返回类型；赋值统一 left_addr；++/-- 地址槽回写；实参槽 PARAM_SET(reg(index+1))；嵌套模块 bootstrap 单条且 entry_id 未定义时跳过；隐式 this 仅实例方法追加（module 函数均为 static）；Type_Member/Type_Arguments 经 type_view 取块 .type；Type_Arguments 实参传类型数组并防重载决议空表崩溃；global_local 路径统一（父设子路径约定，join_path 无尾点，Type 块节点用 ast.global_local）；censor 循环 _loop 置位/恢复（含 for/foreach）；parser 补 Delete 生成器。

## 语言特性（非缺陷，测试按此断言）
- for 的 step 是 BasicCommand 列表，语句必须带分号：`for (…; …; i = i + 1;)` 合法，裸 `i++` 不合法。
- value 块是顶层独立项且**无名字**：`value number { operation '+' … }`，块名由类型决定（desugar 后固定为 number/boolean）。
- `!=` `&&` `||` 内建 VM 不提供，由标准库以 operation 提供；标准库缺失时按 UB 编码为 opcode 0。
- 函数帧块尾自动返回，缺失 RET 为 UB，编译器不强制报错。

## 后续工作
- 标准库：!=/&&/||、指针 &/*、字符串等（均在 Slang 层实现）。
- VM 对齐：按本规范实现 bzx-ins1 的新二进制格式与指令语义。
- optimize 阶段仍为占位。