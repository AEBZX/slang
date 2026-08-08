import {asm_factory, HClass, HIdentifierExpr, HLambdaExpr, HListCommand, HReturn, HVariable} from '../utils'
const I_Class:asm_factory=(data:HClass,tool)=>{
    if(data.constructor_id==-1){
        let id=tool.id()
        data.children.push(new HVariable(id,new HLambdaExpr([],new HListCommand([]))))
        data.constructor_id=id
    }
    let child=(data.children as HVariable[]).filter(i=>i.name!=data.constructor_id)
    let cons=((data.children as HVariable[]).find(i => i.name == data.constructor_id).value as HLambdaExpr)
    //构造函数块,param为构造参数
    tool.push(data.name)
    tool.param=cons.params
    //static成员:main标记入口生成块,其余static生成独立块但不挂实例槽
    for(let i of child.filter(i=>!i.unstatic)){
        if(i.entry)tool.entry=true
        tool.cache.push(i.name)
        tool.gen(i.value)
        tool.entry=false
    }
    //初始化所有成员:非static的方法/变量值挂到实例槽
    for(let i of child.filter(i=>i.unstatic)){
        tool.cache.push(i.name)
        tool.gen(i.value)
        tool.code.push(['offset_set',['reg',data.constructor_id],['reg',i.name],['value',i.name]])
    }
    //装填构造参数
    for(let i=1;i<cons.params.length+1;i++)
        tool.code.push(['param_load',['reg',cons.params[i-1]],['reg',i],['value',0]])
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