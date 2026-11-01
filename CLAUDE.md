# CLAUDE.md

> 你作为一个测试员进行参与,生成测试,也会生成部分代码
> 禁止停止,任何问题不可以通过输出->下一步要干什么什么来停止,通过对话框工具来询问,而不是停止
## 项目画像
- 项目名:slang
- 定位:一个跨平台编程语言
- 技术栈:C/C++,Typescript,Vitest

## 常用命令
- 运行测试:
```shell
npm run test
```
## 架构分层
- 目录结构说明
~~~
slang->
     compiler->编译器,由Typescript编写
             utils->库
                 lexer.ts:分词器
                 data.ts:数据结构定义
                 model.ts->节点定义
                         ast->ast节点定义
                            command.ts:命令类节点
                            expr.ts:表达式类节点
                            block.ts:块类节点
                            identifier.ts:标识符类节点
                            index.ts:入口
                         hir->hir节点定义
                            command.ts:命令hir节点
                            expr.ts:表达式hir节点
                            block.ts:块hir节点
                            index.ts:hir节点入口
                         ir.ts:字节码节点
                 lib->对于其他模块的库实现
                    check.ts
                    cli.ts
                    desugar.ts
                    ir.ts
                    parser.ts
                    optimize.ts
                 index.ts:库入口
             optimize->优化器
             check->语法检查
             desugar->语法糖转换
             ir->ir生成
             generate.ts:生成字节码
             parser->解析器:tokens[]->ast
                   cst-> tokens[]->ast_data
                      command.ts:命令解析
                      expr.ts:表达式解析
                      block.ts:块解析
                      identifier.ts:标识解析
                      index.ts:入口
                   ast-> ast_data->ASTTree
                      command.ts:命令解析
                      expr.ts:表达式解析
                      block.ts:块解析
                      identifier.ts:标识解析
                      index.ts:入口
                   index.ts:入口
             index.ts:引用库入口
             test->测试
                 unit:单元测试,文件命名要求:功能所属功能集-功能.test.ts,如desugar-command.test.ts
                 integration:集成测试,文件命名要求:功能所属功能集.test.ts,如parser-ast.test.ts,parser.test.ts
                 system:系统测试,文件命名要求:测试代码项目名称.test.ts,如book-store.test.ts
     vm->虚拟机
         main.h:封装接口
         main.cpp:主函数入口
         test->同compiler
         lib->虚拟机运行时
                runtime.h:虚拟机运行时
                utils.cpp:IO命令处理
                instruction.cpp:命令处理
                decode.cpp:解码
                data.cpp:数据结构
~~~
## 编码规范
- 变量命名约定:变量采用下划线命名法,如identifier_type_parser
- 函数命名约定:函数采用下划线命名法,如get_identifier_type
- 类命名约定:类采用首字母大写命名法,如IdentifierTypeParser
- 库引用规范:对于默认导出,import $ from 'xxx'
- import统一使用单引号
- 不要写分号
## 其他
- 暂时没有作者能实现o3优化的风险