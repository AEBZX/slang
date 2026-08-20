# SLANG CLI 命令行
## 1. 命令总览

| 命令                                         | 说明                                                      |
|----------------------------------------------|-----------------------------------------------------------|
| `slang init`                                 | 初始化项目：交互式生成 `slang.json`                       |
| `slang compiler`                             | 编译当前项目：收集 `.sl` 源文件 → 编译优化 → 输出 `.sbin` |
| `slang run`                                  | 编译项目后，在独立窗口启动 VM 运行产物                    |
| `slang start [file]`                         | 直接用全局配置中的 VM 运行指定 sbin 文件（独立窗口）      |
| `slang install [name] [version]`             | 在slang中安装name@version                                 |
| `slang uninstall [name]`                     | 在slang中卸载name                                         |
| `slang publish`                              | 将项目上传到SPMServer                                     |
| `slang pvm [path] [isa] [version] [license]` | 将path当作vm发布,isa表示指令集                            |
| `slang config server/username/password data` | 设置SPMServer服务器地址/用户名/密码/数据                  |
## 2. 命令细节
### `slang compiler`

1. 从当前目录递归收集所有 `.sl` 文件（跳过 `ignore` 中的文件/目录）
2. 读取源码内容，调用编译器（按项目 `optimize` 等级优化），得到常量池 POOL 与指令流 BIN
3. 按 [sbin 格式](spm.md) 序列化，写入 `{output}.sbin`

### `slang run`

等价于 `slang compiler` + `slang start {output}.sbin`（VM 路径取项目配置的 `vm` 字段）。

### `slang start [file]`

以独立窗口方式启动 VM：`cmd /c start "" {vm} run {file}`，VM 路径取全局配置。

## 3. 配置文件

### 全局配置 `~/.slang/config.json`

不存在时自动创建并写入默认值：

| 字段       | 默认值 | 说明                |
|------------|--------|---------------------|
| `username` | `''`     | 用户名              |
| `password` | `''`   | 密码                |
| `server`   | `''`   | SPMServer服务器地址 |

### 项目配置 `slang.json`

`compiler` / `run` 要求当前目录存在该文件，否则报错退出。

| 字段 | 说明 |
|------|------|
| `name` / `version` / `author` / `license` | 项目元信息 |
| `ignore` | 编译时忽略的 `.sl` 文件名（不含扩展名）或目录名 |
| `optimize` | 优化等级：0 / 1 / 2 |
| `output` | 输出文件名（不含 `.sbin` 后缀） |
| `vm` | 项目使用的 VM 路径 |
| `lib` | 库配置：`local` 本地库目录，`data` 依赖列表 `{name, version}` |
