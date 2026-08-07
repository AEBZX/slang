import {asm_factory, HClass, HLambdaExpr, HListCommand, HVariable} from '../utils'
const I_Class:asm_factory=(data:HClass,tool)=>{
    if(data.constructor_id==-1){
        let id=tool.id()
        data.children.push(new HVariable(id,new HLambdaExpr([],new HListCommand([]))))
        data.constructor_id=id
    }
    let child=(data.children as HVariable[]).filter(i=>i.name!=data.constructor_id)
    tool.push(data.name)
    tool.pop()
}