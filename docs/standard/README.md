# Standard是什么
Standard为VM,编译器,标准库行为规范,也就是对于任意输入,对应的行为   
开发Slang标准或基于Slang语法进行扩展的compiler和VM,应当遵循此规范  
为Slang实现标准库的,应该遵循此规范   
示例:   
1. 张三写了一个Slang插件,将pipeline全部替换,实现了Brainfuck,张三不需要遵循该标准   
2. 李四用Rust重构了Slang的编译器,则他应该遵循此标准
3. 王五写了一个Slang插件,让Slang支持了条件编译和宏,则王五应该保证在标准Slang行为集合内的行为满足标准
4. 赵六写了一个VM,支持了native,那么赵六应该保证vm语句其他行为,其他指令的所有行为均满足该标准
5. 孙七为Slang实现了标准库,那么孙七应当遵循该标准   
**根据项目使用的GPL协议,如果你的项目构成衍生作品,你就应该开源**
# 内容
1. [COMPILER规范](COMPILER.md)
2. [VM规范](VM.md)
3. [标准库规范](STD.md)