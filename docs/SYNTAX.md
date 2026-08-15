# SLANG 语言语法

文法定义见 [compiler/parser/cst](../compiler/parser/cst)，词法见 [lexer.ts](../compiler/utils/lexer.ts)。源文件扩展名 `.sl`，强制 UTF-8 编码。

## 1. 词法

### 1.1 标识符

- 起始字符：字母、`_`、`$`
- 后续字符：字母、数字、`_`、`$`

### 1.2 数字字面量

| 形式 | 示例 |
|------|------|
| 十进制整数 | `42`、`-7`、`+1` |
| 小数 | `3.14`、`0.5`（`.` 后必须是数字，避免与成员访问混淆） |
| 十六进制 | `0xFF`、`0Xab` |
| 二进制 | `0b1010` |
| 八进制 | `0o755` |

### 1.3 字符串字面量

三种定界符，均支持 `\` 转义定界符本身：

```
"双引号字符串"
'单引号字符串'
`反引号字符串`
```

### 1.4 注释

```
// 单行注释
/* 块注释
   可跨行 */
```

### 1.5 关键字

| 类别 | 关键字 |
|------|--------|
| 修饰符 | `public` `private` `static` `unstatic` `async` `sync` |
| 外层声明 | `link` `module` `class` `interface` `enum` `function` `var` `as` `implements` `of` |
| 类型 | `void` `boolean` `number` `string` |
| 语句 | `if` `else` `switch` `case` `default` `for` `foreach` `while` `do` `break` `continue` `return` `throw` `try` `catch` `finally` `await` `vm` |
| 字面量 | `null` `true` `false` |
| 运算符 | 见下表 |

## 2. 文件结构

一个 `.sl` 文件由**若干 `link` 导入声明**和**块声明列表**组成：

```
link a.b.c as m;        // 导入模块并起别名

public main: module {   // 块声明：修饰符 名称: 块体
    ...
}
```

块声明的通用形式：`修饰符* 标识符 : 块体`，块体可以是以下之一：

| 块体 | 语法 |
|------|------|
| 模块 | `module { 块声明列表 }` |
| 类 | `class [implements 模块名] { 块声明列表 }` |
| 接口 | `interface [implements 模块名] { 块声明列表 }` |
| 枚举 | `enum { 标识符, 标识符, ... }` |
| 函数 | `返回类型 (参数: 类型, ...) 语句块` |
| 变量 | `var : 类型 [= 表达式];` |

示例：

```
public main: module {
    public add: number (a: number, b: number) {
        return a + b;
    }
    public PI: number = 3.14159;
    public Color: enum { RED, GREEN, BLUE }
}
```

## 3. 类型系统

```
Type := 基础类型 后缀*
```

| 类型 | 写法 |
|------|------|
| 基础类型 | `number` `boolean` `string` `void` |
| Lambda 类型 | `(参数: 类型, ...) => 返回类型` |
| 类类型 | `a.b.C`（点分模块路径） |
| 括号分组 | `(类型)` |

后缀（可任意叠加）：

| 后缀 | 含义 |
|------|------|
| `[]` | 数组 |
| `{}` | 映射（Map） |
| `*` | 指针 |

示例：`number[]`、`string{}`、`number*`、`(number)=>void`。

## 4. 语句

### 4.1 基础语句

```
var x: number = 1;          // 变量声明
x = 2;                       // 赋值
x += 1; -= *= /= %= &= |= ^= <<= >>=   // 复合赋值
x++;  x--;                   // 自增/自减
foo();                       // 调用（表达式语句）
await foo();                 // 异步调用
return 表达式;               // 返回（表达式可省略）
break;  continue;            // 循环控制
throw 表达式;                // 抛出异常
vm "指令串";                 // VM 内联指令
```

### 4.2 流程控制

```
if (条件) { ... } else { ... }

while (条件) { ... }
do { ... } while (条件);

for (var i: number = 0; i < 10; i++) { ... }
foreach (x : 容器) { ... }

switch (条件) {
    case 1 => { ... }
    case 2 => { ... }
    default => { ... }
}

try { ... }
catch (e : 类型) { ... }
finally { ... }
```

`{ ... }` 本身也是语句（嵌套块）。

## 5. 表达式

优先级从低到高：

| 优先级 | 内容 |
|--------|------|
| 三元 | `a ? b : c` |
| 逻辑或 | `\|\|` |
| 逻辑与 | `&&` |
| 按位或 | `\|` |
| 按位异或 | `^` |
| 按位与 | `&` |
| 相等 | `==` `!=` |
| 关系 | `<` `>` `<=` `>=` |
| 移位 | `<<` `>>` |
| 加减 | `+` `-` |
| 乘除模 | `*` `/` `%` |
| 前缀 | `++` `--` `!` `~` `-` `&`（引用） `*`（解引用） `new` |
| 后缀 | `++` `--` `.成员` `[下标]` `(实参表)` |
| 基本 | 字面量、标识符、Lambda、数组、Map、括号分组 |

### 5.1 字面量

```
[1, 2, 3]              // 数组
[a: 1, b: 2]           // Map（键为标识符）
(x: number) => number { return x * 2; }   // Lambda
```

### 5.2 后置链

成员访问、下标、调用可任意链式组合：

```
obj.field[0](1, 2).name
```
