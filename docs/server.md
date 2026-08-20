# SPM Server
SPM Server是Slang的模块/VM分发服务器,提供注册、发布、下载REST API,前端页面随服务一并托管
## 启动
```shell
node server.ts
```
首次启动交互式生成`config.json`,并初始化`user.json`/`module.json`/`vm.json`
数据目录默认取当前目录,可用环境变量`SPM_CONFIG_DIR`指定
## 配置 config.json
| 字段       | 默认值         | 说明              |
|------------|----------------|-------------------|
| host       | 0.0.0.0        | 监听地址          |
| port       | 2319           | 监听端口          |
| username   | Admin          | 管理员用户名      |
| password   | password       | 管理员密码        |
| email      | -              | SMTP发件邮箱      |
| token      | -              | SMTP授权码        |
| smtp       | -              | SMTP服务器地址    |
## API
统一响应格式:
```json
{"message":"...","data":null,"code":200}
```
### 用户
| 接口            | 方法 | 参数                   | 说明                        |
|-----------------|------|------------------------|-----------------------------|
| `/api/register` | POST | username,email        | 注册,生成token并邮件发送   |
| `/api/login`    | POST | username,password     | 校验token(即密码)          |
| `/api/verify`   | POST | username,token        | 校验token                  |
### 模块
| 接口                  | 方法 | 参数                        | 说明                          |
|-----------------------|------|-----------------------------|-------------------------------|
| `/api/publish/module` | POST | author,token,name,module,data | 发布模块(data为base64)     |
| `/api/list/module`    | GET  | -                           | 模块列表(含所有版本信息)      |
| `/api/download/module`| POST | name,version                | 下载模块(base64)              |
### VM
| 接口              | 方法 | 参数                  | 说明                    |
|-------------------|------|-----------------------|-------------------------|
| `/api/publish/vm` | POST | author,token,module,data | 发布VM(data为base64) |
| `/api/list/vm`    | GET  | -                     | VM列表                  |
| `/api/download/vm`| POST | version               | 下载VM(base64)          |
## 发布校验
1. author必须已注册,且token匹配
2. `module.hex`必须等于data的sha256
3. 同名模块作者必须一致,版本不得重复
## 数据文件
| 文件        | 说明                              |
|-------------|-----------------------------------|
| user.json   | 用户列表`{username,email,token}` |
| module.json | 模块列表,含各版本元信息          |
| vm.json     | VM列表                           |
| data/       | 模块/VM二进制文件,文件名即source |
## 限制
- 限流:60秒最多300请求
- 请求体上限:1024mb
