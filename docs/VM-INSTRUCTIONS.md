# SLANG 虚拟机指令集

指令编码实现见 [ir.ts](../compiler/utils/model/ir.ts)。

## 1. 指令格式

每条指令为三地址码形式的定长四槽结构：

```
[opcode, a1, a2, a3]
```

- 每个槽位对应 sbin 中的一个字段：opcode 为 uint8，a1/a2/a3 为 uint32（小端）
- 操作数槽不足时补 `0`
- 操作数种类（`asm_args`）：
  - `['reg', n]`：第 n 号寄存器
  - `['value', n]`：常量池第 n 号条目

## 2. Opcode 编码规则

opcode = **指令基址 + 参数组合偏移**。基址按"3 参 8 单位、2 参 4 单位、1 参 2 单位、0 参 1 单位"预留，避免重叠；偏移由操作数的 reg/value 组合决定：

| 参数个数 | 组合 | 偏移 |
|---------|------|------|
| 0 | — | 0 |
| 1 | reg / value | 0 / 1 |
| 2 | regreg / regvalue / valuereg / valuevalue | 0 / 1 / 2 / 3 |
| 3 | regregreg / regregvalue / regvaluereg / regvaluevalue / valuereg… / valuevaluevalue | 0–7 |

例如 `add` 基址为 4，`add reg = reg op value` 编码为 `4 + 1 = 5`。

## 3. 指令列表

### 3.1 数据移动

| 指令 | 基址 | 操作数 | 语义 |
|------|------|--------|------|
| `mov` | 0 | dst, src | 寄存器间搬移 |
| `load` | 84 | reg, data | 加载常量池数据到寄存器 |

### 3.2 算术与位运算（三地址：result = left op right）

| 指令 | 基址 | 运算 |
|------|------|------|
| `add` | 4 | + |
| `sub` | 12 | - |
| `mul` | 20 | * |
| `div` | 28 | / |
| `mod` | 36 | % |
| `shr` | 44 | >> |
| `shl` | 52 | << |
| `and` | 60 | & |
| `or` | 68 | \| |
| `xor` | 76 | ^ |
| `not` | 106 | 逻辑非（单操作数，结果原地写回 a1） |
| `bit_not` | 108 | 按位取反（同上） |

### 3.3 比较与跳转

| 指令 | 基址 | 操作数 | 语义 |
|------|------|--------|------|
| `cmp` | 110 | left, right, oper | 比较，oper 为比较符（常量池编号） |
| `jz` | 92 | target, cond | cond 为零时跳转到 target |
| `cz` | 88 | target, cond, is_func_call | 条件块调用（if/while），压块帧；is_func_call=0 |
| `tz` | 96 | target, cond | 条件跳转变体 |
| `jmp` | 102 | target | 无条件跳转 |

### 3.4 调用与栈帧

| 指令 | 基址 | 操作数 | 语义 |
|------|------|--------|------|
| `call` | 100 | target, is_func_call | 调用函数；is_func_call=1（固定），压函数帧，`retn` 靠它弹到函数帧 |
| `push` | 118 | target | 压栈 |
| `pop` | 120 | target | 出栈 |
| `ret` | 122 | — | 弹出一帧后返回（break 语义使用） |
| `retn` | 169 | — | 函数返回：弹出所有块帧直到函数帧（或栈空）再返回调用者；解决 if/while 分支内 return 只弹块帧的问题。注：原在 121（与 `pop` 的 value 槽位重叠），已挪至 169 |
| `param_set` | 159 | param, value | 设置函数参数 |
| `param_load` | 163 | data, param | 读取函数参数 |
| `delete` | 167 | data | 释放变量槽（O2 逃逸分析生成，供 VM 回收；data 为槽号） |

> `call`/`cz` 的第三个操作数为 `is_func_call` 标识：`call` 恒为 1（函数调用，压函数帧），`cz` 恒为 0（if/while 块调用，压块帧）；VM 实现 `retn` 时依据该标识弹出函数帧。

### 3.5 偏移访问（对象/数组字段）

三参指令：

| 指令 | 基址 | 操作数 | 语义 |
|------|------|--------|------|
| `offset_set` | 124 | target, offset, value | target[offset] = value |
| `offset_get` | 132 | target, data, offset | target = data[offset] |
| `offset_addr` | 140 | target, data, offset | target = &data[offset]（取地址） |

### 3.6 IO 与并发

| 指令 | 基址 | 操作数 | 语义 |
|------|------|--------|------|
| `in` | 148 | oper, data | 输入 |
| `out` | 152 | oper, target | 输出 |
| `thread` | 104 | target | 创建线程执行 target |
| `gc` | 123 | — | 触发垃圾回收 |

### 3.7 块边界标记

| 指令 | 基址 | 操作数 | 语义 |
|------|------|--------|------|
| `block_start` | 156 | name | 块起始标记，name 为块的标识（常量池编号） |
| `block_end` | 158 | — | 块结束标记，与 `block_start` 成对，真实输出（不跳过） |

## 4. 备注

- opcode 按指令族预留编号区间，便于后续扩展特化变体或超指令
- 当前空闲槽位：121 原为 0 参区预留（已挪给 `retn` 后改用于 169），157 空闲；各指令族尾部按预留宽度保留空位
