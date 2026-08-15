# SLANG sbin 文件格式

生成实现见 [command.ts](../compiler/cli/command.ts) 的 `compiler()`。sbin 是编译器输出的字节码文件（项目配置的 `output` 字段 + `.sbin` 后缀），整体为顺序段结构，全程**小端序（Little-Endian）**。

## 1. 整体布局

```
┌──────────────────────────┐
│  "POOL_START"  (10 B)    │  ASCII 魔数
├──────────────────────────┤
│  常量池条目 × N           │  变长
├──────────────────────────┤
│  "POOL_END"    (8 B)     │
├──────────────────────────┤
│  "CODE_START"  (10 B)    │
├──────────────────────────┤
│  指令 × M                 │  每条定长 13 B
├──────────────────────────┤
│  "CODE_END"    (8 B)     │
└──────────────────────────┘
```

文件总大小 = 36（四个魔数）+ 常量池字节数 + 13 × 指令数。

## 2. 常量池段

每个条目结构：

| 字段 | 宽度 | 说明 |
|------|------|------|
| id | uint32 | 条目编号（指令中以 value 操作数引用） |
| type | uint8 | 类型标记：`1` = number，`0` = string |
| length | uint32 | 数据区字节数（number 固定为 8） |
| data | length B | number 为 float64（LE double）；string 为 UTF-8 字节序列 |

条目头固定 9 字节（4 + 1 + 4）。

## 3. 代码段

每条指令定长 13 字节：

| 字段 | 宽度 | 说明 |
|------|------|------|
| opcode | uint8 | 见 [VM-INSTRUCTIONS.md](VM-INSTRUCTIONS.md) |
| a1 | uint32 | 操作数 1（寄存器号或常量池编号） |
| a2 | uint32 | 操作数 2，无则补 0 |
| a3 | uint32 | 操作数 3，无则补 0 |

注意：

- `block_end` 是真实指令（opcode `158`），占 13 字节，与 `block_start` 成对出现
- 块边界由 `block_start` / `block_end` 标记划分，无独立块索引表
- 指令按生成顺序线性存放，跳转目标为指令序号

## 4. VM 加载流程

1. 校验 `POOL_START` 魔数
2. 逐条读取常量池条目直到遇到 `POOL_END`
3. 校验 `CODE_START`，按 13 字节步长逐条取指，直到 `CODE_END`
