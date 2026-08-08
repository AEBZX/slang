/**
 * 命令文档:
 * reg的含义:直接取ID作为值,value:取ID存储的值
 * mov a b:a=b
 * add等二元运算: a b:a=a xxx b
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
 * mov,push,pop,add等二元运算,not,cmp,offset_xxx等类似的都需要传入a的id(reg a)而不是a的值
 */
import command from './command'
import expr from './expr'
import block from './block'
import {ASMFactory, HBlock} from '../utils'
export default function (index:number,HIR:HBlock[]){
    return new ASMFactory(index,new Map([...command,...expr,...block])).run(HIR)
}