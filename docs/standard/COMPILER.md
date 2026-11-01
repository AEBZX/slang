# 此文档定义什么
此文档定义对于实现的Compiler,对源文件集合输入时的行为,对语法的规定,以及对扩展接口的规范  
此文档的目的是为了统一不同实现之间的行为,确保它们在处理相同输入时产生相同输出
# 暴露接口
应当暴露一个默认导出的JavaScript或TypeScript函数,具有如下签名
```typescript
export default function (source: string[],
                         plugin: (pipeline: PeepholeTool[]) => PeepholeTool[])
                        :Buffer;
```
|参数|语义|例子|
|--|--|--|
|source|所有被编译的.sl文件的集合|[a.sl的内容,b的sl的内容]|
|plugin|插件集合|[APlugin,BPlugin]|
|返回值|生成的二进制产物|无|
## PeepholeTool实现
应当保证如下接口,以实现管线
```typescript
export type peephole_type='lexer'|'parser'|'check'|'desugar'|'hir'|'ir'|'optimize'|'generate'
export default class PeepholeTool{
    constructor(public name:peephole_type) {
    }
    run(param:any):any{
    }
    use(data:any):PeepholeTool{
        return null
    }
}
```
|函数|作用|
|--|--|
|构造函数|区分类型|
|run|传入参数,用于产生返回值,用于下一级|
|use|传入数据,返回自身|
- 特殊语义

|条件|语义|
|--|--|
|为lexer|必须接受string[]|
|为generate|必须返回Buffer|
## 运行
应当保证如下结构或与其等价的运行:

```typescript
for (var i of plugin)
    pipeline = i(pipeline)
let ret = pipeline[lexer].run(source)
ret = pipiline[parser].run(ret)
ret = pipeline[check].run(ret)
ret = pipeline[desugar].run(ret)
ret = pipeline[hir].run(ret)
ret = pipeline[ir].run(ret)
ret = pipeline[optimize].run(ret)
ret = pipeline[generate].run(ret)
return ret
```
# 