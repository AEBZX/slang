import {describe, expect, it} from 'vitest'
import {parse_commands, parse_function, render} from './helper'

//解析一段函数体,把每条命令渲染出来
const C = (body: string) => parse_commands(body).map(render)

describe('parser/命令·基本命令', () => {
    it('var 声明:带初值', () => {
        expect(C('var a:number=1;')).toEqual(['var a:number=1;'])
    })

    it('var 声明:不带初值', () => {
        expect(C('var a:number;')).toEqual(['var a:number;'])
    })

    it('var 声明的类型可以是复合类型', () => {
        expect(C('var a:std.math.Item[];')).toEqual(['var a:std.math.Item[];'])
    })

    it('赋值:每个复合赋值运算符各有对应节点', () => {
        expect(C('a=1;')).toEqual(['a=1;'])
        expect(C('a+=1;')).toEqual(['a+=1;'])
        expect(C('a-=1;')).toEqual(['a-=1;'])
        expect(C('a*=1;')).toEqual(['a*=1;'])
        expect(C('a/=1;')).toEqual(['a/=1;'])
        expect(C('a%=1;')).toEqual(['a%=1;'])
        expect(C('a&=1;')).toEqual(['a&=1;'])
        expect(C('a|=1;')).toEqual(['a|=1;'])
        expect(C('a^=1;')).toEqual(['a^=1;'])
        expect(C('a<<=1;')).toEqual(['a<<=1;'])
        expect(C('a>>=1;')).toEqual(['a>>=1;'])
    })

    it('赋值右侧是完整表达式', () => {
        expect(C('a=b+c*d;')).toEqual(['a=(b+(c*d));'])
    })

    it('表达式语句', () => {
        expect(C('f();')).toEqual(['(f());'])
        expect(C('a.b;')).toEqual(['(a.b);'])
    })

    it('return:带值与不带值', () => {
        expect(C('return;')).toEqual(['return ;'])
        expect(C('return a+b;')).toEqual(['return (a+b);'])
    })

    it('break / continue', () => {
        expect(C('while(true){break;}')).toEqual(['while(true)break;'])
        expect(C('while(true){continue;}')).toEqual(['while(true)continue;'])
    })

    it('throw', () => {
        expect(C('throw e;')).toEqual(['throw e;'])
    })

    it('await', () => {
        expect(C('await g();')).toEqual(['await (g());'])
    })

    it('vm:内联指令不带参数', () => {
        expect(C('vm("out %oper %d");')).toEqual(['vm("out %oper %d");'])
    })

    it('每条基本命令都必须以分号结尾', () => {
        expect(() => parse_function('var a:number=1')).toThrow()
        expect(() => parse_function('return')).toThrow()
    })

    it('vm 带一个参数', () => {
        expect(C('vm("out %s",x);')).toEqual(['vm("out %s",x);'])
    })

    it('vm 带多个参数', () => {
        expect(C('vm("a",x,y);')).toEqual(['vm("a",x,y);'])
    })
})

describe('parser/命令·选择与循环', () => {
    it('if', () => {
        expect(C('if(a)b;')).toEqual(['if(a)b;'])
    })

    it('if-else', () => {
        expect(C('if(a)b;else c;')).toEqual(['if(a)b;else c;'])
    })

    it('if 的分支是单条命令,复合块要写花括号', () => {
        expect(C('if(a){b;c;}')).toEqual(['if(a)b; c;'])
    })

    it('条件必须带括号', () => {
        expect(() => parse_function('if a b;')).toThrow()
    })

    it('while', () => {
        expect(C('while(a)b;')).toEqual(['while(a)b;'])
    })

    it('do-while:结尾需要分号', () => {
        expect(C('do b;while(a);')).toEqual(['do b;while(a);'])
        expect(() => parse_function('do b;while(a)')).toThrow()
    })

    it('for:初始化 + 条件 + 步进', () => {
        //步进里的 i++ 是一条表达式语句,所以渲染出来带分号
        expect(C('for(var i:number=0;i<10;i++;){x;}'))
            .toEqual(['for(var i:number=0;(i<10);(i++);)x;'])
    })

    it('for 的初始化可以是多条 var 声明', () => {
        expect(C('for(var i:number=0;var j:number=0;i<10;i++;){x;}'))
            .toEqual(['for(var i:number=0;var j:number=0;(i<10);(i++);)x;'])
    })

    it('for 的步进可以是多条基本命令', () => {
        expect(C('for(var i:number=0;i<10;i++;j++;){x;}'))
            .toEqual(['for(var i:number=0;(i<10);(i++);(j++);)x;'])
    })

    it('for 的步进必须自带分号', () => {
        expect(() => parse_function('for(var i:number=0;i<10;i++){x;}')).toThrow()
    })

    it('foreach', () => {
        expect(C('foreach(c:s){n+=1;}')).toEqual(['foreach(c:s)n+=1;'])
    })

    it('switch:case 用 => 引出命令体,default 可省', () => {
        expect(C('switch(x){case 1=>{a;}default=>{b;}}')).toEqual(['switch(x){case 1=>a;default=>b;}'])
        expect(C('switch(x){case 1=>{a;}}')).toEqual(['switch(x){case 1=>a;}'])
    })

    it('switch 可以没有 case', () => {
        expect(C('switch(x){}')).toEqual(['switch(x){}'])
    })

    it('try-catch-finally', () => {
        expect(C('try{a;}catch(e:string){b;}finally{c;}'))
            .toEqual(['try{a;}catch(e:string){b;}finally{c;}'])
    })

    it('try-catch 可以没有 finally', () => {
        expect(C('try{a;}catch(e:string){b;}')).toEqual(['try{a;}catch(e:string){b;}'])
    })

    it('catch 必须写明标识符与类型', () => {
        expect(() => parse_function('try{a;}catch(e){b;}')).toThrow()
    })
})

describe('parser/命令·复合块', () => {
    it('花括号块本身是一条命令', () => {
        expect(C('{a;b;}')).toEqual(['a; b;'])
    })

    it('块可以嵌套', () => {
        expect(C('{{a;}}')).toEqual(['a;'])
    })

    it('函数体可以有多条命令', () => {
        expect(C('a;b;c;')).toEqual(['a;', 'b;', 'c;'])
    })

    it('空函数体合法', () => {
        expect(C('')).toEqual([])
    })

    it('块级命令可以混用', () => {
        expect(C('var a:number;if(a)b;while(a){c;}'))
            .toEqual(['var a:number;', 'if(a)b;', 'while(a)c;'])
    })
})
