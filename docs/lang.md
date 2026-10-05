# Slang语法文档

> 依据解析器具体语法(CST)整理,规则名与源码一一对应:
> 程序结构/块:`compiler/parser/cst/block.ts`;命令:`compiler/parser/cst/command.ts`;
> 表达式:`compiler/parser/cst/expr.ts`;类型:`compiler/parser/cst/identifier.ts`;
> 词法:`compiler/utils/lib/lexer.ts`。机器可读 EBNF 见 `compiler/test/formal/out/grammar.ebnf.txt`。
>
> 记法:`A ::= B` 定义;`|` 有序选择(先左后右,失败回退);`[A]` 可选;`{A}` 重复;
> `A ("," A)*` 分隔列表。**所有列表均可为空**:实参表、枚举成员、泛型实参、数组/Map 元素、
> for 的初始化与步进等,写空是合法的。

## 词法

- 注释:`// 行注释`、`/* 块注释 */`,解析前被丢弃。
- 标识符:`[_$A-Za-z][_$A-Za-z0-9]*`。
- 数字:十进制 `123`、小数 `1.5`(小数点后必须有数字,因此 `a.b` 是成员访问不是小数);
  进制前缀 `0x`/`0X`、`0b`/`0B`、`0o`/`0O`;无指数记法。
- 字符串:`'…'`、`"…"`、`` `…` `` 三种引号,支持 `\` 转义(如 `\n`、`\"`、`\\`)。
- 关键字:`public private async sync static unstatic link module class enum interface implements
  var as operation cast value void boolean number string vm break continue return throw await
  try catch finally foreach if else switch case default for while do null true false` 及运算符符号。
  其中 `value` 是硬关键字(不能作标识符);`of`、`function`、`@`、`===`、`!==`、`&&=`、`||=`
  已词法化但当前文法未使用。

## 程序结构

```
File        ::= { Link } { Block | Value } ;
Link        ::= "link" ModuleName "as" Identifier ";" ;
ModuleName  ::= Type ;
```

一个文件 = 若干条 `link` 导入 + 若干个顶层块/`value` 块。模块名为点分类型名:

```slang
link std.io as io;
link std.io.print as print;
```

## 块

```
Block      ::= Modifiers Identifier ":" BlockData ;
Modifiers  ::= { "public" | "private" | "static" | "unstatic" | "async" | "sync" } ;
BlockData  ::= Module | Class | Interface | Enum | Function | Variable ;
```

块的一般形式:`修饰符* 名称 ":" 块定义`。修饰符可任意组合、顺序不限、均可省略;
缺省值:模块/类/接口/枚举为 static+public,函数/变量为 unstatic+private(即实例成员)。

| 块类型 | 定义 | 说明 |
|--------|------|------|
| 模块 | `module { Block* }` | `名称:module{…}` |
| 类 | `class [泛型] [implements BasicType] { Block* }` | `名称:class<T>{…}`,泛型在 `class` 之后 |
| 接口 | `interface [泛型] [implements BasicType] { Block* }` | 同类;函数以 `;` 结尾表示无实现 |
| 枚举 | `enum { [A ("," A)*] }` | 成员只能是标识符,不带值 |
| 函数 | `[泛型] Type (参数表) (命令 \| ";")` | 泛型在返回类型之前:`f:<T>Ret(…)` |
| 变量 | `Type ["=" Expression] ";"` | `名称:类型(=表达式);` |

```slang
public std:module{
    public math:module{ /* 同名模块默认合并 */ }
    public Box:class<T> implements Container<T>{ /* ... */ }
    public Color:enum{ Red, Green, Blue }
    public static pow:number(a:number,b:number){
        var ret:number=1;
        /* ... */
    }
    public pi:number=3.14159265358979323846;
}
```

特殊行为:
1. 同名模块默认合并。
2. 类可以实现接口,也可以不实现:未实现接口的成员不构成错误;实现链(谁实现了谁)用于子类型判断与类型合并。

> **迁移提示**:块级变量旧写法 `name:var:Type`(如 `n:var:number=1;`)已被拒绝,
> `var` 现在只用于命令级变量声明。

## 类型

```
Type        ::= BasicType { TypePostfix } ;
TypePostfix ::= "{" "}" | "[" "]" | "*" ;
BasicType   ::= "number" | "boolean" | "string" | "void"
              | "(" Type ")"
              | LambdaType
              | ClassType ;
LambdaType  ::= [泛型] "(" [参数表] ")" "=>" Type ;
ClassType   ::= Identifier { "." Identifier } [ "<" Type ("," Type)* ">" ] ;
```

| 类型 | 写法 |
|------|------|
| 数字 / 布尔 / 字符串 / 空 | `number` / `boolean` / `string` / `void` |
| 数组 | `T[]`,可叠加:`number[][]` |
| Map | `T{}`,如 `string{}` |
| 指针 | `T*` |
| 函数 | `(a:number,b:number)=>number` |
| 类/枚举/模块 | 类型名,可点分嵌套 `std.Item`,可带泛型 `Box<number>` |

## 表达式

```
Expression  ::= TernaryExpression | BinaryExpression ;
Ternary     ::= BinaryExpression "?" Expression ":" Expression ;
Binary      ::= LogicAnd { "||" LogicAnd } ;
LogicAnd    ::= Or { "&&" Or } ;
Or          ::= Xor { "|" Xor } ;
Xor         ::= And { "^" And } ;
And         ::= Equal { "&" Equal } ;
Equal       ::= Relational { ("=="|"!=") Relational } ;
Relational  ::= Shift { ("<"|">"|"<="|">=") Shift } ;
Shift       ::= Add { ("<<"|">>") Add } ;
Add         ::= Mul { ("+"|"-") Mul } ;
Mul         ::= Prefix { ("*"|"/"|"%") Prefix } ;
Prefix      ::= { PrefixOp } Postfix ;
PrefixOp    ::= "(" Type ")" | "++" | "--" | "!" | "~" | "-" | "*" | "&" | "new" ;
Postfix     ::= Primary { PostfixOp } ;
PostfixOp   ::= "++" | "--" | "." Identifier | "[" Expression "]"
              | [ "<" Type ("," Type)* ">" ] "(" [ Expression ("," Expression)* ] ")" ;
Primary     ::= Number | String | "true" | "false" | "null" | Identifier
              | Lambda | "(" Expression ")"
              | "[" [ Expression ("," Expression)* ] "]"
              | "[" [ Identifier ":" Expression ("," Identifier ":" Expression)* ] "]" ;
Lambda      ::= [泛型] "(" [参数表] ")" "=>" Type 命令 ;
```

优先级从高到低:

| 层级 | 运算符 |
|------|--------|
| 后缀 | `++` `--` 自增自减、`.x` 成员访问、`[i]` 下标、`(实参)` 调用 |
| 前缀 | `(Type)` 类型转换、`++` `--`、`!` 逻辑非、`~` 按位取反、`-` 负号、`*` 解引用、`&` 取地址、`new` 创建 |
| 乘除模 | `*` `/` `%` |
| 加减 | `+` `-` |
| 移位 | `<<` `>>` |
| 关系 | `<` `>` `<=` `>=` |
| 相等 | `==` `!=` |
| 按位 | `&` `^` `\|` |
| 逻辑 | `&&` `\|\|` |
| 三目 | `条件 ? Expr : Expr` |

要点:

- `(Type)` 为前缀类型转换,如 `(number)x`。括号内容为类型时按类型转换解析,与括号
  表达式由文法分支顺序天然区分,无歧义。
- 调用可显式给出泛型实参:`f<number>(x)`。
- 数组字面量 `[1,2,3]`;Map 字面量的键必须是标识符:`[type:'print',data:data]`。
- Lambda(函数字面量):`(a:number,b:number)=>number{return a+b;}`。
- 列表均可为空:`[]`、`f()`、`<>` 等皆合法。

## 命令

`命令` 恰好匹配**一条**命令——函数体、`if` 分支、循环体等都只接受一条命令,
多条语句写成复合块 `{ … }`(块本身也是一条命令,内部可含任意多条命令)。

```
Command      ::= BlockCommand | BasicCommand ;
BlockCommand ::= IfStatement | WhileStatement | DoWhileStatement | ForStatement
               | ForeachStatement | SwitchStatement | TryStatement
               | "{" { 命令 } "}" ;
BasicCommand ::= VarDecl | Assign | ExprCommand | Await | Return | Break | Continue
               | Throw | VM ;
VarDecl      ::= "var" Identifier ":" Type [ "=" Expression ] ";" ;
Assign       ::= 表达式 ("="|"+="|"-="|"*="|"/="|"%="|"&="|"|="|"^="|"<<="|">>=") 表达式 ";" ;
ExprCommand  ::= 表达式 ";" ;
Await        ::= "await" 命令 ;
Return       ::= "return" [表达式] ";" ;
Break        ::= "break" ";" ;
Continue     ::= "continue" ";" ;
Throw        ::= "throw" 表达式 ";" ;
VM           ::= "vm" "(" String [ "," 表达式 ]* ")" ";" ;
```

基本命令都以 `;` 结尾。

流程控制:

```
If      ::= "if" "(" 表达式 ")" 命令 [ "else" 命令 ] ;
While   ::= "while" "(" 表达式 ")" 命令 ;
DoWhile ::= "do" 命令 "while" "(" 表达式 ")" ";" ;
For     ::= "for" "(" { VarDecl } 表达式 ";" { BasicCommand } ")" 命令 ;
Foreach ::= "foreach" "(" Identifier ":" 表达式 ")" 命令 ;
Switch  ::= "switch" "(" 表达式 ")" "{" { "case" 表达式 "=>" 命令 } [ "default" "=>" 命令 ] "}" ;
Try     ::= "try" 命令 "catch" "(" Identifier ":" Type ")" 命令 [ "finally" 命令 ] ;
```

- `for` 的初始化只能是若干条 `var` 声明(自带分号);条件不能省略;步进是若干条
  基本命令,每条自带结尾分号。
- `switch` 的分支体是一条命令,用 `=>` 引出;`default` 可省。

```slang
public static pow:number(a:number,b:number){
    var ret:number=1;
    for(var i:number=0;i<b;i+=1;){ ret*=a; }
    return ret;
}
```

```slang
switch(x){
    case 1=>{ io.print("one"); }
    default=>{ io.print("other"); }
}
try{ /* ... */ }catch(e:string){ /* ... */ }finally{ /* ... */ }
foreach(c:s){ n+=1; }
```

- 内联 VM 指令带括号:`vm("out %s",x);`

> **迁移提示**:旧写法 `vm "out %d";` 已不被当前文法支持。

## value 块:重定义运算与转换

```
Value      ::= "value" BasicType "{" { Operation | Cast } "}" ;
Operation  ::= "operation" 运算符 Lambda ;
运算符     ::= "+" | "-" | "*" | "/" | "%" | "&" | "|" | "&&" | "||" | "^"
             | ">>" | "<<" | "!" | ">" | "<" | ">=" | "<=" | "!=" | "==" | "=" | "~" | ":"
             | "new" | "++" | "--" | "[]" | "()" ;
Cast       ::= "cast" Type Lambda ;
```

`value` 块只能出现在文件顶层,**重定义**指定类型上的运算符;参数类型不必与该类型
一致,可实现异构运算(如给 `string` 定义 `*`,支持 `"abc"*3`):

```slang
value number{
    operation + (a:number,b:number)=>number{ return a; }
    operation [] (a:number)=>number{ return a; }   // 下标运算
    operation () (a:number)=>number{ return a; }   // 调用运算
}
```

注意:**后缀** `++`/`--` 的 lambda 参数表末尾要追加一个无用的 `number` 参数,
用于与前缀形式区分:

```slang
operation ++ (x:number,post:number)=>number{ /* ... */ }
```

`cast` 定义类型转换:`cast number(s:string)=>number{ return 0; }`。
