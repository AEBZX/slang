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
    //装填参数
    for(let i=1;i<cons.params.length+1;i++)
        tool.code.push(['param_load',['reg',i++],['value',tool.param[i-1]],['value',0]])
    tool.gen(cons.commands)
    tool.gen(new HReturn(new HIdentifierExpr(data.this_id)))
    tool.pop()
}