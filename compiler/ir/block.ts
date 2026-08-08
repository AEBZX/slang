import {asm_factory, HClass, HIdentifierExpr, HLambdaExpr, HListCommand, HReturn, HVariable} from '../utils'
const I_Class:asm_factory=(data:HClass,tool)=>{
    if(data.constructor_id==-1){
        let id=tool.id()
        data.children.push(new HVariable(id,new HLambdaExpr([],new HListCommand([]))))
        data.constructor_id=id
    }
    let child=(data.children as HVariable[]).filter(i=>i.name!=data.constructor_id)
    let cons=((data.children as HVariable[]).find(i => i.name == data.constructor_id).value as HLambdaExpr)
    //构造函数
    tool.push(data.name)
    //初始化所有Variable
    let ls_id=tool.id()
    for(let i of child){
        tool.cache.push(ls_id)
        tool.gen(i.value)
        tool.code.push(['offset_set',['reg',data.constructor_id],['reg',i.name],['value',ls_id]])
    }
    //装填参数
    for(let i=1;i<cons.params.length+1;i++)
        tool.code.push(['param_load',['reg',i++],['value',tool.param[i-1]],['value',0]])
    tool.gen(cons.commands)
    tool.gen(new HReturn(new HIdentifierExpr(data.this_id)))
    tool.pop()
}
const I_Variable:asm_factory=(data:HVariable,tool)=>{
    tool.cache.push(data.name)
    tool.gen(data.value)
}
export default new Map<any,asm_factory>([
    [HClass,I_Class],
    [HVariable,I_Variable]
])