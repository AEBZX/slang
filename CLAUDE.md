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
                     constant.ts:常量折叠,常量传播
                     cp.ts:赋值传播
                     peephole.ts:窥孔优化
                     dce.ts:DCE优化
                     cfg.ts:块优化
                     index.ts:优化以及bin生成
             check->语法检查
                  censor.ts:检查
                  symbol.ts:符号表构建
                  type.ts:类型标注
                  index.ts:入口
             cli->脚手架入口
                command.ts:命令入口
                config.ts:配置类
                download.ts:拉取/下载类功能支持
                entry.ts:入口
             desugar->语法糖转换
                  command.ts:命令语法糖转换
                  expr.ts:表达式语法糖转换
                  block.ts:块语法糖转换
                  index.ts:入口
             ir->vm字节码生成
                 command.ts:命令字节码生成
                 expr.ts:表达式字节码生成
                 block.ts:块字节码生成
                 index.ts:入口
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
         model.h:模型
         utils.h:标准跨平台操作库
         pool->内存以及gc管理
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
- import统一使用单引号
- 不要写分号
## 其他
- 暂时没有作者能实现o3优化的风险
- 暂时没有实现CLI的云端包管理的风险