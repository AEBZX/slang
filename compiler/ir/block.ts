import {asm_factory, HClass, HIdentifierExpr, HLambdaExpr, HListCommand, HNumberLiteral, HReturn, HVariable} from '../utils'
const I_Class:asm_factory=(data:HClass,tool)=>{
    if(data.constructor_id==-1){
        let id=tool.id()
        data.children.push(new HVariable(id,new HLambdaExpr([],new HListCommand([]))))
        data.constructor_id=id
    }
    //类槽初始化:load 类槽=构造块id(与顶层函数lambda的函数槽初始化一致)
    //构造块id用tool.id()显式分配;类槽是HIR的HClass.name(HFile的children是裸HClass,无HVariable包装,
    //此前不push类槽,gen(HNumberLiteral)的cache.pop()拿到空槽→load var0,而 new 读 var[类槽]=0,call跳块0死循环)
    let class_block_id=tool.id()
    tool.cache.push(data.name)
    tool.gen(new HNumberLiteral(class_block_id))
    let child=(data.children as HVariable[]).filter(i=>i.name!=data.constructor_id)
    let cons=((data.children as HVariable[]).find(i => i.name == data.constructor_id).value as HLambdaExpr)
    //成员槽初始化(load 成员槽=方法块id)生成在根块(tool.code=调用者块,此时未push类块)
    //顶层函数的函数槽初始化同样在根块;此前在类块生成,main 成员访问读成员槽=0,call 跳块0死循环
    for(let i of child){
        if(i.entry)tool.entry=true
        tool.cache.push(i.name)
        tool.gen(i.value)
        tool.entry=false
    }
    //构造函数块,param为构造参数
    tool.push(class_block_id)
    //构造块:this 经 param[1] 传入(与成员方法一致),此处注入到 this_id 槽
    tool.code.push(['param_load',['reg',data.this_id],['reg',1],['value',0]])
    //初始化所有成员:非static的方法/变量值挂到 this 对象(target 用 value 读 var[this])
    //键也用 value 读 var[成员槽](成员槽存方法块id/初始值),与成员访问 c.inc() 的 offset_get 键(var[成员槽])一致
    //此前键用 reg 槽号(5/7/8),成员访问键=槽值(块id),错位导致方法调用读到0
    for(let i of child.filter(i=>i.unstatic)){
        tool.code.push(['offset_set',['value',data.this_id],['value',i.name],['value',i.name]])
    }
    //装填构造参数:param[1]已被this占用,构造实参从param[2]起
    for(let i=1;i<cons.params.length+1;i++)
        tool.code.push(['param_load',['reg',cons.params[i-1]],['reg',i+1],['value',0]])
    tool.gen(cons.commands)
    tool.gen(new HReturn(new HIdentifierExpr(data.this_id)))
    tool.pop()
}
const I_Variable:asm_factory=(data:HVariable,tool)=>{
    //入口main的lambda块独占id 0
    if(data.entry)tool.entry=true
    tool.cache.push(data.name)
    tool.gen(data.value)
    tool.entry=false
}
export default new Map<any,asm_factory>([
    [HClass,I_Class],
    [HVariable,I_Variable]
])
