# Slang指令集
## 指令格式
每条指令定长13字节:opcode(1字节)+操作数A/B/C(各4字节uint32小端),未使用的操作数填0

| 字段   | 大小 | 说明     |
|--------|------|----------|
| opcode | 1    | 指令编号 |
| A      | 4    | 操作数A  |
| B      | 4    | 操作数B  |
| C      | 4    | 操作数C  |
## 操作数形式
| 形式  | 含义                               |
|-------|------------------------------------|
| reg   | 数值原样使用:字面量/变量槽号/常量池id |
| value | 解引用:var[操作数]取出槽内值        |

同一条指令按操作数形式组合细分opcode,偏移量固定:
- 2参:regreg=+0,regvalue=+1,valuereg=+2,valuevalue=+3
- 3参:regregreg=+0,regregvalue=+1,regvaluereg=+2,regvaluevalue=+3,valueregerg=+4,valueregvalue=+5,valuevaluereg=+6,valuevaluevalue=+7
## 指令表
| opcode    | 指令        | 参数 | 说明                                             |
|-----------|-------------|------|--------------------------------------------------|
| 0-3       | mov         | 2    | var[A]=src(B),变量赋值                           |
| 4-11      | add         | 3    | var[A]=B+C,加法                                  |
| 12-19     | sub         | 3    | var[A]=B-C,减法                                  |
| 20-27     | mul         | 3    | var[A]=B*C,乘法                                  |
| 28-35     | div         | 3    | var[A]=B/C,除法                                  |
| 36-43     | mod         | 3    | var[A]=B%C,取模                                  |
| 44-51     | shr         | 3    | var[A]=B>>C,右移                                 |
| 52-59     | shl         | 3    | var[A]=B<<C,左移                                 |
| 60-67     | and         | 3    | var[A]=B&C,按位与                                |
| 68-75     | or          | 3    | var[A]=B\|C,按位或                               |
| 76-83     | xor         | 3    | var[A]=B^C,按位异或                              |
| 84-87     | load        | 2    | var[A]=B(B为池id原样),常量加载                  |
| 88-91     | cz          | 3    | cond真时压帧跳块,C=帧类型(0块帧/1函数帧/2循环帧) |
| 92-95     | jz          | 2    | cond真时跳块                                     |
| 96-99     | tz          | 2    | cond真时新建线程跑块                             |
| 100-101   | call        | 2    | 无条件压帧跳块,B=1函数帧/0块帧                   |
| 102-103   | jmp         | 1    | 无条件跳块                                       |
| 104-105   | thread      | 1    | 新建线程跑块                                     |
| 106-107   | not         | 1    | 逻辑非                                           |
| 108-109   | bit_not     | 1    | 按位取反                                         |
| 110-117   | cmp         | 3    | 比较var[A]与B,C指定运算(0=,1!=,2>,3<,4>=,5<=),结果写回var[A] |
| 118       | push        | 1    | var[A]压操作数栈                                 |
| 120       | pop         | 1    | 弹栈写入var[A]                                   |
| 122       | ret         | 0    | break:弹帧直到最近循环帧                         |
| 123       | gc          | 0    | 触发垃圾回收                                     |
| 124-131   | offset_set  | 3    | offset[A][B]=新建槽,槽值=src(C),写数组/Map成员  |
| 132-139   | offset_get  | 3    | var[A]=var[offset[B][C]],越界返回null            |
| 140-147   | offset_addr | 3    | var[A]=offset[B][C]的槽号,取地址                 |
| 148-151   | in          | 2    | GCPI输入:端口名=A,结果写入var[B]                |
| 152-155   | out         | 2    | GCPI输出:端口名=A,对象句柄=B                    |
| 156       | block_start | 1    | 块开始,B=块号                                    |
| 158       | block_end   | 0    | 块结束                                           |
| 159-162   | param_set   | 2    | param[A]=src(B),传参                             |
| 163-166   | param_load  | 2    | var[A]=param[B],取参                             |
| 167-168   | delete      | 1    | 释放槽指向常量的引用                             |
| 169       | retn        | 0    | 返回:弹到最近函数帧                              |
## 块结构
指令以块为单位组织,块内顺序执行,块间通过跳转/压帧指令转移:
- `block_start` 标记块开始(块号为B),`block_end` 标记块结束
- 块执行完自动弹帧返回;无帧可弹则程序结束
- 入口为块0
## 帧机制
cz/call 压帧记录返回位置,ret/retn 弹帧:
| 帧类型 | 压入指令 | 弹出指令 | 语义           |
|--------|----------|----------|----------------|
| 块帧   | cz       | ret(级联弹) | if/while分支 |
| 函数帧 | cz/call  | retn      | 函数调用       |
| 循环帧 | cz       | ret       | while循环     |
