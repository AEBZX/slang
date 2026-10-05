# SPM(Slang Package Manager)

SPM 是 Slang 的包管理与分发系统。它分发的不只是源码包——**虚拟机本体和编译器本体也通过 SPM 分发**,并且以"项目级虚拟环境"的方式锁定在每个项目里。

SPM 由三部分组成:

- **CLI 命令**:`slang install/uninstall/publish/config/register`(见 [CLI 文档](cli.md));
- **项目清单**:`slang.json`;
- **SPM Server**:统一注册/发布/下载的 REST 服务,官方实例与自建实例均可(见 [SPM Server 文档](server.md))。

## 三类制品

| 制品 | 版本模型 | 内容 | 去向 |
|------|----------|------|------|
| 模块 module | `name@version`,可声明依赖 | 源码包(tar + LZMA) | 安装到项目 `lib/<包名>/`,编译时与项目源码一起静态编译进 `.sbin` |
| 虚拟机 vm | `version`,附带 `isa`(指令集)与 `license` | VM 可执行文件 | `slang init` 时下载到项目 `venv/` |
| 编译器 compiler | 大版本 → 小版本的树 | `compiler.js` | `slang init` 时下载到项目 `venv/`,由 node 执行 |

**项目级虚拟环境(venv)**:每个项目在 `init` 时从 SPM 选择并下载指定版本的编译器和 VM,版本锁定在 `slang.json` 的 `venv` 字段里。不同项目可以用不同的 Slang 版本,互不干扰。

## 快速上手

```shell
# 1. 注册账号(token 会发送到邮箱,服务端需配置 SMTP)
slang register --username <用户名> --email <邮箱>

# 2. 配置全局信息(~/.slang/config.json,不存在会自动创建)
slang config set server <SPM服务器地址>
slang config set token <邮箱收到的token>
slang config verify        # 校验 server/username/token

# 3. 初始化项目:交互式选择编译器/VM 版本,下载到 venv/,生成 slang.json
slang init

# 4. 安装依赖 / 编译运行
slang install --name <库名> --version <版本号>
slang go                   # = compiler + run
```

## CLI 命令

| 命令 | 说明 |
|------|------|
| `slang init` | 交互式生成 `slang.json`;下载编译器/VM 到 `venv/`(下载后逐个做 sha256 校验) |
| `slang compiler` | 用 `venv/compiler.js` 编译当前项目,输出 `output.sbin` |
| `slang run` | 用 `venv/vm(.exe)` 运行 `output.sbin` |
| `slang go` | `compiler` + `run` |
| `slang install --name <n> --version <v>` | 安装模块到 `lib/<n>/` |
| `slang uninstall <n>` | 卸载模块,连带清理不再被引用的传递依赖 |
| `slang publish module` | 把当前项目发布为模块(需先 `config verify` 通过) |
| `slang publish vm --path <p> --version <v> --isa <isa> --license <l>` | 发布 VM |
| `slang publish compiler --path <p> --large <大版本> --small <小版本>` | 发布编译器小版本 |
| `slang create compiler --version <大版本> --license <l>` | 创建编译器大版本(维护者流程) |
| `slang register --username <u> --email <e>` | 注册账号 |
| `slang config set <key> <value>` | `key` ∈ `server` / `username` / `password` / `token` |
| `slang config verify` | 校验凭据(先识别 `/api/health`,再 `/api/verify`) |

## 项目清单 slang.json

```json
{
    "name": "my-app",
    "version": "1.0.0",
    "author": "BZX",
    "license": "MIT",
    "optimize": 2,
    "output": "my-app.sbin",
    "ignore": ["lib"],
    "venv": {
        "dir": "venv",
        "compiler": "1.0",
        "compiler_version": "1.0.2",
        "vm": "1.2",
        "vm_version": "1.2.0"
    },
    "dependency": [
        { "name": "some-lib", "version": "1.0.0" }
    ],
    "lib": {
        "local": "lib",
        "data": [
            { "name": "some-lib", "version": "1.0.0" }
        ]
    },
    "lock": []
}
```

| 字段 | 说明 |
|------|------|
| `name` / `version` / `author` / `license` | 项目元信息;发布时用 `name@version` 查重,**同名模块必须同一作者、版本不得重复** |
| `optimize` | 优化级别:`0` 不优化 / `1` 普通 / `2` 激进 |
| `output` | `.sbin` 输出名(带不带后缀均可,`run` 会自动补) |
| `ignore` | 发布打包时排除的路径(子串匹配;`venv` 目录编译时始终排除) |
| `venv` | 虚拟环境锁定:`dir` 目录、`compiler`+`compiler_version` 编译器大小版本、`vm`+`vm_version` VM 版本 |
| `dependency` | **直接依赖**列表 `{name,version}` |
| `lib.local` | 库安装目录(默认 `lib`) |
| `lib.data` | 实际安装的模块清单(含传递依赖) |
| `lock` | 安装时记录的依赖来源,卸载时用于判定哪些传递依赖已孤立 |

### 依赖解析规则

- 安装前先在服务端确认 `name@version` 存在;已安装同名包会拒绝重复安装。
- **依赖冲突**:待装包的依赖与已装包同名但版本不同 → 报错,不做覆盖。
- 传递依赖自动递归安装:记入 `lib.data` 与 `lock`,但**不会**写进顶层 `dependency`。
- 卸载直接依赖时,不再被任何其他依赖引用的传递依赖会被一并删除。

## 包格式

模块发布/下载的载荷是一个压缩包:

1. 按 `ignore` 过滤后,把项目打成 **tar**(不 gzip);
2. 用 **LZMA**(preset 9)压缩;
3. `hex` = **压缩后数据**的 sha256。下载侧先校验 `hex` 再解压;
4. 解压目标:`<lib.local>/<模块名>/`,目录名即包名。

## sbin 容器格式

`slang compiler` 输出的 `.sbin` 由常量池(POOL)与指令流(CODE)拼接而成,以 ASCII 标记分段,全部小端:

```
"POOL_START"
  常量条目 × N:
    head(9 字节):id u32 | type u8(1 = number,0 = string) | 长度 u32
    data(按 head 长度):number → f64;string → utf-8
"POOL_END"
"CODE_START"
  指令 × N,每条 13 字节:op u8 | a u32 | b u32 | c u32
"CODE_END"
```

指令的语义按 VM 指令集定义(见[指令集文档](vi.md))。

## 服务端

SPM Server 开源随仓库提供,`node server.ts` 即可启动;官方公共实例持续建设中,欢迎赞助或自建(自建完全等价,客户端只需 `config set server` 指向自己的实例)。部署细节、配置项与接口速查见 [SPM Server 文档](server.md),要点:

- 统一响应格式 `{"message":"...","data":...,"code":200}`;
- 账号:注册后 token 通过邮件发送,发布类接口凭 `author+token` 鉴权;
- 发布校验:作者已注册且 token 匹配、`hex` 与载荷 sha256 一致、同名模块作者一致、版本唯一;
- 数据文件:`data/` 下的 `user.json` / `module.json` / `vm.json` / `compiler.json` 及二进制目录;
- 限流:60 秒 300 请求;请求体上限 1024 MB;数据目录可用环境变量 `SPM_CONFIG_DIR` 指定。
