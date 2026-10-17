# compiler 测试体系

按编译流水线分层建立。目标是"每一层的行为都有测试钉住，每个修过的 bug 都有对应回归"。

## 运行

```shell
# 全部
node .\node_modules\vitest\vitest.mjs run

# 单个文件 / 单个用例
node .\node_modules\vitest\vitest.mjs run test/unit/lexer-adjacent.test.ts
node .\node_modules\vitest\vitest.mjs run -t '相邻 token'
```

（`npx vitest` 在本机被 PowerShell 执行策略挡住，用上面的 node 直调。）

## 命名与目录

| 目录 | 命名 | 说明 |
|---|---|---|
| `test/unit/` | `功能集-功能.test.ts` | 单层行为，如 `desugar-command.test.ts` |
| `test/integration/` | `功能集.test.ts` | 跨层链路，如 `ir-container.test.ts` |
| `test/system/` | `测试代码项目名称.test.ts` | 端到端，如 `feature-matrix.test.ts` |

## 辅助工具（非测试文件）

| 文件 | 作用 |
|---|---|
| `helper.ts` | 词法/语法/检查阶段的便捷入口：`lex_src` `parse` `parse_expr` `check_src` `errors_of` `run_check` `render` `type_str` |
| `helper-ir.ts` | IR 与编码阶段：`ir_of` `opt_of` `bin_of`（写 `os.tmpdir()`）`all_of` `count_of` `dump_ir` `dump_flow` `names_of` `null_args` |
| `interpreter.ts` | 最小 IR 解释器：`exec(tool, args)` 返回 `{ret, halt, steps}`，用于"优化前后语义一致"的差分测试与具体数值断言 |
| `sbin.ts` | `.sbin` 只读解码器：`decode(buf)` 把产物整体解一遍（文件头/池条目/块头尾/操作码/尾部字节），不自洽直接抛错；导出合法操作码集合 `OPCODES` |

## 分层清单

### 词法

| 文件 | 覆盖 |
|---|---|
| `unit/lexer-token.test.ts` | token 类型与值、进制、三种引号与转义、注释、行号列号、科学计数法、`e+1` 不被误吞 |
| `unit/lexer-adjacent.test.ts` | **相邻 token 切分矩阵（61 条）**：最长匹配（`<=`/`<<=`/`>>=`/`&&=`/`||=`/`===`/`!==`）、标识符与数字边界、注释、`@T`、`$x`、`#x` |

### 语法（cst → ast）

| 文件 | 覆盖 |
|---|---|
| `unit/parser-lib.test.ts` | 解析器底层：seg/delete/choose/while/loop 的行为与回溯 |
| `unit/parser-identifier.test.ts` | 标识符、类型、泛型列表 |
| `unit/parser-expr.test.ts` | 表达式与运算符优先级、结合性 |
| `unit/parser-command.test.ts` | 单个命令的形态（含 try/catch/finally 四种写法） |
| `unit/parser-statement.test.ts` | 11 种赋值、控制流、`&&=`/`||=`、条件可省略的 for、switch、try |
| `unit/parser-block.test.ts` | module/class/interface/enum/value/link |
| `unit/parser-decl.test.ts` | 声明与 8 类类型及后缀叠加 |

### 语义检查

| 文件 | 覆盖 |
|---|---|
| `unit/check-censor.test.ts` | 修饰符与关键字禁用 |
| `unit/check-symbol.test.ts` | 符号表：重名、重复声明、implement、泛型存在性 |
| `unit/check-type.test.ts` | 类型标注：赋值、运算、索引、返回、cast |
| `unit/check-semantics.test.ts` | 合法程序不报错 + 各类错误 |
| `unit/check-multi-error.test.ts` | 多错误报告、诊断带行列号 |
| `unit/check-operator.test.ts` | `value` 块、`operation`/`cast` 声明与调用生成 |
| `unit/check-cast-generic.test.ts` | 转换语法与隐式转换、泛型推断/显式实参、`new` 与构造函数 |
| `unit/check-overload.test.ts` | 重载选择（按参数类型/个数）、跨模块、具体优先于泛型 |

### desugar

| 文件 | 覆盖 |
|---|---|
| `unit/desugar-expr.test.ts` | oper/cast、短路展开、调用 this、成员/下标 |
| `unit/desugar-command.test.ts` | 复合赋值、控制流展开、switch 降级成 if 链、try 的 throw 标志 |
| `unit/desugar-block.test.ts` | module/class/enum/function 的降级与重载序号 |
| `unit/desugar-try.test.ts` | try 矩阵：throw 标志、catch/finally lambda、重抛、`if(throw)` 保护、finally-only 的传播 |

### HIR

| 文件 | 覆盖 |
|---|---|
| `unit/hir-expr.test.ts` | 字面量/标识符/成员/下标/调用/运算符映射 |
| `unit/hir-command.test.ts` | 赋值、return、break/continue、vm、await、if/while |
| `unit/hir-block.test.ts` | HScope 的 id 分配、路径、link 别名、入口识别 |

### IR

| 文件 | 覆盖 |
|---|---|
| `unit/ir-operand.test.ts` | **操作数语义**：右值 `reg` 是立即数、左值 `reg` 是槽号、读槽用 `value` |
| `unit/ir-vmmap.test.ts` | `vm()` 内联指令表 33 键逐键覆盖 + 每个键的操作数形态 |
| `unit/ir-dicts.test.ts` | `CmpDict` 比较序号、`BinaryDict` 运算符→指令名（`&&`/`||` 不在其中） |
| `integration/ir.test.ts` | 各语句/表达式的 IR 形态 |
| `integration/ir-statement.test.ts` | 9 类语句的结构 + 生成形状（CALL/RET/JMP/CZ/CMP）+ 部分语义 |
| `integration/ir-container.test.ts` | 数组容器：字面量建在目标槽、下标读写、下标/成员目标的自增 |
| `integration/ir-logic.test.ts` | 短路真值表、`&&=`/`||=` 语义 |

### 优化器

| 文件 | 覆盖 |
|---|---|
| `unit/optimize-tool.test.ts` | 工具：读写常量、槽表、`flush`/`sweep` |
| `unit/optimize-fold.test.ts` | 常量折叠 |
| `unit/optimize-prop.test.ts` | 常量传播 |
| `unit/optimize-copy.test.ts` | 赋值传播 |
| `unit/optimize-peephole.test.ts` | 窥孔规则 |
| `unit/optimize-last.test.ts` | 收尾轮：池常量搬进槽、`arg_pool` 复用 |
| `unit/optimize-clean.test.ts` | 优化后不留"一眼能化简"的形态 + 两次优化一致 |
| `unit/optimize-fixpoint.test.ts` | **不动点**：把结果再喂回优化器，逐指令 dump 必须一致 |
| `integration/optimize.test.ts` | 优化链路的整体行为 |
| `integration/optimize-equivalence.test.ts` | **差分执行**：同一程序优化前后解释执行结果必须相同（36 个程序 × 5 组输入）|

### 代码生成

| 文件 | 覆盖 |
|---|---|
| `unit/generate-encode.test.ts` | 各指令编码 |
| `unit/generate-opcode.test.ts` | **opcode 表**：28 条指令的精确操作码、形式位（`(基址+类型偏移)*8+v1*4+v2*2+v3`）、操作数原样写入、缺参补 `reg 0` |
| `unit/generate-pool.test.ts` | 常量池编码（类型/长度/去重）、代码段块头尾与块号 |
| `unit/generate-edge.test.ts` | 边界：空池/空块/空指令流、大槽号、100/1000 条指令的精确字节数 |
| `integration/generate.test.ts` | 产物整体结构 |

### 系统级

| 文件 | 覆盖 |
|---|---|
| `system/api.test.ts` | 公开入口：产物文件、插件按顺序看到 8 个轮次、多文件、确定性 |
| `system/feature-matrix.test.ts` | **特性矩阵 15 个程序**：raw/优化后结果 + 字节码确定性 + 产物解码 |
| `system/feature-mix.test.ts` | 多特性混合程序的端到端数值 |
| `system/error-paths.test.ts` | **错误路径 26 条**：每条断言具体诊断片段 + 行列号；另有 6 条"不该报错" |
| `system/sbin-decode.test.ts` | **全字节解码**：10 个真实程序，池/块/操作码/尾部字节全部解释过；截断与篡改能被发现 |
| `system/mini-lib.test.ts` | 小库整体编译 |
| `integration/pipeline.test.ts` / `integration/compiler.test.ts` | 流水线整体与程序矩阵、确定性 |
| `integration/runnable.test.ts` | 结构 + 定值使用校验，**生成阶段与优化后各跑一遍** |

## 已知缺口

只有一条（用 `it.fails` 固定，修好后转正例）：

- `泛型类型后面直接跟 = 也能解析`：`var x:C<T>=a;` 里泛型闭合的 `>` 紧跟 `=` 时被词法成 `>=`。
  需要能回滚的 token 拆分或事务式回溯，试过四次都因为回溯点不唯一而回退。

另有一项按作者要求**搁置**：`POP` 指令没有操作数（VM 侧恢复约定由作者决定）。

## 维护约定

- 修 bug 时先补一条能复现的用例，再改代码；如果确定是缺口但暂时不修，用 `it.fails` + 注释说明根因。
- 表驱动的契约（opcode 表、`CmpDict`、`VMMap`）改动会直接挂测试，是有意为之。
- 慢用例（反复编译的）显式给 `{timeout: ...}`，避免"单跑绿、全跑红"。
- 测试辅助函数放 `test/*.ts`；`src` 里的 helper 一律放各层的 `tool.ts`，不要塞进 visitor 文件。
