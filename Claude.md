# CLAUDE.md

> 你作为一个测试员进行参与,生成测试,也会生成部分代码

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
                 lib->对于其他模块的库实现
                    check.ts
                    cli.ts
                    desugar.ts
                    ir.ts
                    parser.ts
                 index.ts:库入口
             check->语法检查
                  command.ts:命令语法检查
                  expr.ts:表达式语法检查
                  block.ts:块语法检查
                  identifier.ts:标识语法检查
                  index.ts:入口
             cli->脚手架入口
                compiler.ts:编译器命令入口
                config.ts:配置命令入口
                download.ts:拉取/下载类命令入口
                index.ts:入口
             desugar->语法糖转换
                  command.ts:命令语法糖转换
                  expr.ts:表达式语法糖转换
                  block.ts:块语法糖转换
                  identifier.ts:标识语法糖转换
                  index.ts:入口
             ir->vm字节码生成
                 command.ts:命令字节码生成
                 expr.ts:表达式字节码生成
                 block.ts:块字节码生成
                 identifier.ts:标识字节码生成
                 index.ts:入口
             parser->解析器
                   cst->将代码解析为CST
                        command.ts:命令cst解析
                        expr.ts:表达式cst解析
                        block.ts:块cst解析
                        identifier.ts:标识cst解析
                        index.ts:入口
                   ast->将CST解析为AST
                        command.ts:命令ast解析
                        expr.ts:表达式ast解析
                        block.ts:块ast解析
                        identifier.ts:标识ast解析
                        index.ts:入口
                   index.ts:入口
             test->测试
                 unit:单元测试,文件命名要求:功能所属功能集-功能.test.ts,如desugar-command.test.ts
                 integration:集成测试,文件命名要求:功能所属功能集.test.ts,如parser-ast.test.ts,parser.test.ts
                 system:系统测试,文件命名要求:测试代码项目名称.test.ts,如book-store.test.ts
     vm->虚拟机
         main.cpp:主函数入口
         utils->虚拟机工具类
              win_api.h:windows系统api封装
              linux_api.h:linux系统api封装
              utils.h:根据操作系统导入win_api.h或linux_api.h
         pool->内存以及gc管理
             pool.h:内存管理,内存池定义
             gc.cpp:gc管理
             memory.cpp:内存管理
         runtime->虚拟机运行时
                runtime.h:虚拟机运行时定义
                command.cpp:命令分发
                io.cpp:IO命令处理
                math.cpp:数学命令处理
                thread.cpp:线程类命令处理
                basic.cpp:基础命令处理
~~~
## 编码规范
- 变量命名约定:变量采用下划线命名法,如identifier_type_parser
- 函数命名约定:函数采用下划线命名法,如get_identifier_type
- 类命名约定:类采用首字母大写命名法,如IdentifierTypeParser
- 库引用规范:对于默认导出,import $ from 'xxx'
- 导出规范:所有函数默认导出
- import统一使用单引号
- 不要写分号
