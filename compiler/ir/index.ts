/**
 * 命令文档:
 * reg的含义:直接取ID作为值,value:取ID存储的值
 * mov a b:a=b
 * add等二元运算: a b c:a=b xxx c
 * not a:!a
 * cmp a b c,比较a和b,以c为操作符,c为操作符ID,结果存储在a
 * jmp a b,当b==1,跳转到a
 * call:同理
 * thread:同call,只不过会新建线程运行
 * ret:跳出当前块返回
 * push a:压入栈
 * pop a:出栈
 * offset_set a b c:a[b]=c
 * offset_get a b c:a=b[c]
 * mov,push,pop,add等二元运算,not,cmp,offset_xxx等类似的都需要传入a的id(reg a)而不是a的值,如果是操作除外
 * in,out,gc:除了vm内嵌就不需要管
 * load a id:加载id对应的常量到a
 * param_set number data:设param[number]=data
 * param_get a number:设a=param[number]
 */
import command from './command'
import expr from './expr'
import block from './block'
import {asm_command, ASMFactory, HBlock} from '../utils'
export default function (index:number,HIR:HBlock[]){
    let factory=new ASMFactory(index,new Map([...command,...expr,...block]))
    let data=factory.run(HIR)
    let ret=new Map<number,asm_command[]>()
    for(let [k,v] of data.code)
        ret.set(k,v[0])
    return {
        pool:data.pool,
        code:ret,
        id:factory.tool.index
    }
}