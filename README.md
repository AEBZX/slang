# Slang
Slang是一个跨平台的面向对象编程语言   
一些实用链接:   
[语言文档](https://www.github.com/AEBZX/slang/blob/master/docs/study.md)   
[加入光荣的贡献](https://www.github.com/AEBZX/slang/master/docs/spm.md)   
[官方维护的SPM Server](https://www.github.com/AEBZX/slang/master/server.md)   
# 搭建环境
在开始前,请确保已经找到了值得信任的SPM Server,建议使用官方的SPM Server   
在~.slang/slang.json下配置:
```json
{
  "local": "~/.slang",
  "default_optimize": 2,
  "server": "你的SPM Server服务器"
}
```
下载slang工具链以进行开发工作
```shell
npm install -g @aebzx/slang-cli
```
## 创建项目
